"""媒体上传与 Telegram file_id 预览代理。"""

from __future__ import annotations

import logging
import mimetypes
from typing import Any, Dict, List
from urllib.parse import quote

import httpx
from aiogram.types import BufferedInputFile
from fastapi import Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from bot.api.deps import get_current_user_id
from bot.api.routes_core import router
from bot.config import get_settings

logger = logging.getLogger(__name__)

MAX_FILES = 9
MAX_BYTES = 20 * 1024 * 1024


def _guess_type(filename: str, content_type: str | None) -> str:
    ct = (content_type or "").lower()
    name = (filename or "").lower()
    if ct.startswith("video/") or name.endswith((".mp4", ".mov", ".webm", ".mkv")):
        return "video"
    return "image"


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
    chat_id = settings.media_storage_chat_id
    if not chat_id:
        raise HTTPException(status_code=503, detail="未配置 STORAGE_CHAT_ID / ADMIN_IDS，无法存媒体")

    from bot.main import bot

    results: List[Dict[str, str]] = []
    for uf in files:
        data = await uf.read()
        if not data:
            continue
        if len(data) > MAX_BYTES:
            raise HTTPException(status_code=400, detail=f"文件过大：{uf.filename or 'unknown'}（≤20MB）")
        kind = _guess_type(uf.filename or "", uf.content_type)
        safe_name = (uf.filename or ("video.mp4" if kind == "video" else "image.jpg")).replace("/", "_")
        buf = BufferedInputFile(data, filename=safe_name)
        try:
            if kind == "video":
                msg = await bot.send_video(chat_id, buf, disable_notification=True)
                file_id = msg.video.file_id if msg.video else None
            else:
                msg = await bot.send_photo(chat_id, buf, disable_notification=True)
                file_id = msg.photo[-1].file_id if msg.photo else None
            try:
                await bot.delete_message(chat_id, msg.message_id)
            except Exception:
                logger.info("storage message left in chat %s", chat_id)
        except Exception as exc:
            logger.exception("media upload send failed")
            raise HTTPException(status_code=502, detail=f"上传到 Telegram 失败：{exc}") from exc
        if not file_id:
            raise HTTPException(status_code=502, detail="未能获取 file_id")
        preview = f"/api/media/file/{quote(file_id, safe='')}"
        results.append({"type": kind, "file_id": file_id, "preview_url": preview, "url": preview})

    if not results:
        raise HTTPException(status_code=400, detail="没有有效文件")
    return {"ok": True, "items": results, "count": len(results)}


@router.get("/media/file/{file_id:path}")
async def api_media_file(file_id: str):
    settings = get_settings()
    if not settings.bot_token:
        raise HTTPException(status_code=503, detail="BOT_TOKEN 未配置")
    from bot.main import bot

    try:
        tg_file = await bot.get_file(file_id)
    except Exception as exc:
        logger.warning("get_file failed: %s", exc)
        raise HTTPException(status_code=404, detail="文件不存在或已失效") from exc
    path = tg_file.file_path
    if not path:
        raise HTTPException(status_code=404, detail="无 file_path")
    url = f"https://api.telegram.org/file/bot{settings.bot_token}/{path}"
    mime, _ = mimetypes.guess_type(path)
    mime = mime or "application/octet-stream"

    client = httpx.AsyncClient(timeout=60.0)
    try:
        req = client.build_request("GET", url)
        resp = await client.send(req, stream=True)
    except Exception as exc:
        await client.aclose()
        raise HTTPException(status_code=502, detail="拉取 Telegram 文件失败") from exc

    if resp.status_code != 200:
        await resp.aclose()
        await client.aclose()
        raise HTTPException(status_code=502, detail="拉取 Telegram 文件失败")

    async def stream():
        try:
            async for chunk in resp.aiter_bytes(64 * 1024):
                yield chunk
        finally:
            await resp.aclose()
            await client.aclose()

    return StreamingResponse(
        stream(),
        media_type=mime,
        headers={"Cache-Control": "private, max-age=3600"},
    )
