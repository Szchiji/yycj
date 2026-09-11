"""媒体上传与 Telegram file_id 预览代理。"""
from __future__ import annotations

import logging
import mimetypes
import time
from typing import Any, Dict, List, Tuple

import httpx
from aiogram.types import BufferedInputFile
from fastapi import Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse

from bot.api.deps import get_current_user_id
from bot.api.routes_core import router
from bot.config import get_settings

logger = logging.getLogger(__name__)

MAX_FILES = 9
MAX_BYTES = 20 * 1024 * 1024
_PATH_CACHE: Dict[str, Tuple[str, float]] = {}
_PATH_TTL = 50 * 60


def _guess_type(filename: str, content_type: str | None) -> str:
    ct = (content_type or "").lower()
    name = (filename or "").lower()
    if ct.startswith("video/") or name.endswith((".mp4", ".mov", ".webm", ".mkv")):
        return "video"
    return "image"


def _mime_for(file_id: str, path: str) -> str:
    fid = str(file_id or "")
    low = str(path or "").lower()
    mime, _ = mimetypes.guess_type(path)
    if fid.startswith(("BAAC", "BQAC")) or low.endswith((".mp4", ".mov", ".webm", ".mkv")):
        return "video/mp4"
    if fid.startswith("AgAC") or low.endswith((".jpg", ".jpeg", ".png", ".webp")):
        return mime or "image/jpeg"
    return mime or "application/octet-stream"


@router.post("/media/upload")
async def api_media_upload(
    files: List[UploadFile] = File(...),
    user_id: int = Depends(get_current_user_id),
) -> Dict[str, Any]:
    if not files:
        raise HTTPException(status_code=400, detail="请选择文件")
    if len(files) > MAX_FILES:
        raise HTTPException(status_code=400, detail=f"一次最多上传 {MAX_FILES} 个文件")
    settings = get_settings()
    from bot.services.broadcast import resolve_media_chat
    chat_id = await resolve_media_chat() or settings.media_storage_chat_id
    if not chat_id:
        raise HTTPException(status_code=503, detail="未配置媒体存储频道，无法存媒体")
    from bot.main import bot
    results: List[Dict[str, str]] = []
    for uf in files:
        data = await uf.read()
        if not data:
            continue
        if len(data) > MAX_BYTES:
            raise HTTPException(status_code=400, detail=f"文件过大：{uf.filename or 'unknown'}（≤20MB）")
        thumb_id = None
        kind = _guess_type(uf.filename or "", uf.content_type)
        safe_name = (uf.filename or ("video.mp4" if kind == "video" else "image.jpg")).replace("/", "_")
        buf = BufferedInputFile(data, filename=safe_name)
        try:
            if kind == "video":
                try:
                    msg = await bot.send_video(chat_id, buf, disable_notification=True)
                    file_id = (msg.video.file_id if msg.video else None) or (
                        msg.document.file_id if msg.document else None
                    )
                    if msg.video and getattr(msg.video, "thumbnail", None):
                        thumb_id = msg.video.thumbnail.file_id
                except Exception:
                    msg = await bot.send_document(chat_id, buf, disable_notification=True)
                    file_id = msg.document.file_id if msg.document else None
            else:
                msg = await bot.send_photo(chat_id, buf, disable_notification=True)
                file_id = msg.photo[-1].file_id if msg.photo else None
                if msg.photo:
                    thumb_id = msg.photo[0].file_id
        except Exception as exc:
            logger.exception("upload to telegram failed")
            raise HTTPException(status_code=502, detail=f"上传失败：{exc}") from exc
        if not file_id:
            continue
        item = {"type": kind, "file_id": file_id, "url": file_id, "preview_url": f"/api/media/file/{file_id}"}
        if thumb_id:
            item["thumb_file_id"] = thumb_id
            item["preview_url"] = f"/api/media/file/{thumb_id}"
        results.append(item)
    if not results:
        raise HTTPException(status_code=400, detail="没有有效文件")
    return {"ok": True, "items": results, "count": len(results)}


@router.get("/media/file/{file_id:path}")
async def api_media_file(file_id: str, request: Request):
    settings = get_settings()
    if not settings.bot_token:
        raise HTTPException(status_code=503, detail="BOT_TOKEN 未配置")
    now = time.time()
    cached = _PATH_CACHE.get(file_id)
    path = cached[0] if cached and cached[1] > now else ""
    if not path:
        from bot.main import bot
        try:
            tg_file = await bot.get_file(file_id)
        except Exception as exc:
            logger.warning("get_file failed: %s", exc)
            raise HTTPException(status_code=404, detail="文件不存在或已失效") from exc
        path = tg_file.file_path or ""
        if not path:
            raise HTTPException(status_code=404, detail="无 file_path")
        _PATH_CACHE[file_id] = (path, now + _PATH_TTL)
    url = f"https://api.telegram.org/file/bot{settings.bot_token}/{path}"
    mime = _mime_for(file_id, path)
    headers = {}
    rng = request.headers.get("range")
    if rng:
        headers["Range"] = rng
    client = httpx.AsyncClient(timeout=60.0, follow_redirects=True)
    try:
        req = client.build_request("GET", url, headers=headers)
        resp = await client.send(req, stream=True)
    except Exception as exc:
        await client.aclose()
        raise HTTPException(status_code=502, detail="拉取 Telegram 文件失败") from exc
    if resp.status_code not in (200, 206):
        await resp.aclose()
        await client.aclose()
        _PATH_CACHE.pop(file_id, None)
        raise HTTPException(status_code=502, detail="拉取 Telegram 文件失败")

    async def stream():
        try:
            async for chunk in resp.aiter_bytes(64 * 1024):
                yield chunk
        finally:
            await resp.aclose()
            await client.aclose()

    out = {
        "Cache-Control": "public, max-age=604800, immutable",
        "Accept-Ranges": "bytes",
        "Content-Disposition": "inline",
    }
    if resp.headers.get("content-range"):
        out["Content-Range"] = resp.headers["content-range"]
    if resp.headers.get("content-length"):
        out["Content-Length"] = resp.headers["content-length"]
    return StreamingResponse(stream(), status_code=resp.status_code, media_type=mime, headers=out)
