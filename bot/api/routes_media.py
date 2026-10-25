"""媒体上传与 Telegram file_id 预览代理。"""
from __future__ import annotations

import hashlib
import logging
import mimetypes
import time
from pathlib import Path
from typing import Any, Dict, List, Tuple

import httpx
from aiogram.types import BufferedInputFile
from fastapi import Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, RedirectResponse, StreamingResponse

from bot.api.deps import get_current_user_id
from bot.api.routes_core import router
from bot.config import get_settings

logger = logging.getLogger(__name__)

MAX_FILES = 9
MAX_BYTES = 20 * 1024 * 1024
_DISK_MAX = 2 * 1024 * 1024
_DISK_DIR = Path("/tmp/yycj-media")
_PATH_CACHE: Dict[str, Tuple[str, float]] = {}
_PATH_TTL = 50 * 60
_POSTER: Dict[str, str] = {}
_CACHE_HDR = {
    "Cache-Control": "public, max-age=604800, immutable",
    "Accept-Ranges": "bytes",
    "Content-Disposition": "inline",
}


def _guess_type(filename: str, content_type: str | None) -> str:
    ct = (content_type or "").lower()
    name = (filename or "").lower()
    if ct.startswith("video/") or name.endswith((".mp4", ".mov", ".webm", ".mkv")):
        return "video"
    return "image"


_IMAGE_EXT = (".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif")
_VIDEO_EXT = (".mp4", ".mov", ".webm", ".mkv", ".m4v", ".3gp")
_RATE_WINDOW = 600.0
_RATE_MAX_FILES = 60
_RATE: Dict[int, List[float]] = {}


def _allowed_upload(filename: str, content_type: str | None) -> bool:
    ct = (content_type or "").lower().split(";")[0].strip()
    name = (filename or "").lower()
    if ct == "image/svg+xml" or name.endswith(".svg"):
        return False
    if ct.startswith("image/") or ct.startswith("video/"):
        return True
    if ct in ("", "application/octet-stream"):
        return name.endswith(_IMAGE_EXT + _VIDEO_EXT)
    return False


def _rate_ok(user_id: int, n: int) -> bool:
    now = time.monotonic()
    hits = [t for t in _RATE.get(user_id, []) if now - t < _RATE_WINDOW]
    if len(hits) + n > _RATE_MAX_FILES:
        _RATE[user_id] = hits
        return False
    hits.extend([now] * n)
    _RATE[user_id] = hits
    if len(_RATE) > 5000:
        for uid in [u for u, v in _RATE.items() if not v or now - v[-1] >= _RATE_WINDOW]:
            _RATE.pop(uid, None)
    return True


async def _read_capped(uf: UploadFile, limit: int) -> bytes:
    chunks: List[bytes] = []
    total = 0
    while True:
        chunk = await uf.read(1024 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > limit:
            raise HTTPException(status_code=400, detail=f"文件过大：{uf.filename or 'unknown'}（≤20MB）")
        chunks.append(chunk)
    return b"".join(chunks)


async def _require_uploader(user_id: int) -> bool:
    """Only publishers (teacher/merchant) and admins may upload. Returns is_admin."""
    from bot.services.admin_acl import is_admin, warm
    await warm()
    if is_admin(user_id):
        return True
    from bot.services import credit_service
    u = await credit_service.ensure_user(user_id)
    if u.get("role") not in ("teacher", "merchant"):
        raise HTTPException(status_code=403, detail="仅老师或商家可上传，请先在「我的」切换身份")
    return False


def _mime_for(file_id: str, path: str) -> str:
    fid = str(file_id or "")
    low = str(path or "").lower()
    mime, _ = mimetypes.guess_type(path)
    if fid.startswith(("BAAC", "BQAC")) or low.endswith((".mp4", ".mov", ".webm", ".mkv")):
        return "video/mp4"
    if fid.startswith("AgAC") or low.endswith((".jpg", ".jpeg", ".png", ".webp")):
        return mime or "image/jpeg"
    return mime or "application/octet-stream"


def _disk_path(file_id: str) -> Path:
    name = hashlib.sha256(file_id.encode("utf-8")).hexdigest()[:40]
    return _DISK_DIR / name


@router.post("/media/upload")
async def api_media_upload(
    files: List[UploadFile] = File(...),
    user_id: int = Depends(get_current_user_id),
) -> Dict[str, Any]:
    if not files:
        raise HTTPException(status_code=400, detail="请选择文件")
    if len(files) > MAX_FILES:
        raise HTTPException(status_code=400, detail=f"一次最多上传 {MAX_FILES} 个文件")
    admin = await _require_uploader(user_id)
    for uf in files:
        if not _allowed_upload(uf.filename or "", uf.content_type):
            raise HTTPException(status_code=400, detail=f"只支持图片或视频：{uf.filename or 'unknown'}")
    if not admin and not _rate_ok(user_id, len(files)):
        raise HTTPException(status_code=429, detail="上传过于频繁，请稍后再试")
    settings = get_settings()
    from bot.services.broadcast import resolve_media_chat
    chat_id = await resolve_media_chat() or settings.media_storage_chat_id
    if not chat_id:
        raise HTTPException(status_code=503, detail="未配置媒体存储频道，无法存媒体")
    from bot.main import bot
    results: List[Dict[str, str]] = []
    for uf in files:
        data = await _read_capped(uf, MAX_BYTES)
        if not data:
            continue
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
            _POSTER[file_id] = thumb_id
        results.append(item)
    if not results:
        raise HTTPException(status_code=400, detail="没有有效文件")
    return {"ok": True, "items": results, "count": len(results)}


async def _resolve_poster(file_id: str) -> str:
    if file_id in _POSTER:
        return _POSTER[file_id]
    from bot.main import bot
    from bot.services.broadcast import resolve_media_chat
    chat = await resolve_media_chat() or get_settings().media_storage_chat_id
    if not chat:
        raise HTTPException(status_code=404, detail="no media chat")
    msg = await bot.send_video(chat, file_id, disable_notification=True)
    thumb = None
    if msg.video and getattr(msg.video, "thumbnail", None):
        thumb = msg.video.thumbnail.file_id
    if not thumb:
        raise HTTPException(status_code=404, detail="no thumb")
    _POSTER[file_id] = thumb
    return thumb


_POSTER_MISS: Dict[str, float] = {}
_POSTER_HITS: List[float] = []


async def _known_media(file_id: str) -> bool:
    """Poster generation re-sends a video to Telegram, so only do it for media on a real listing/post."""
    from sqlalchemy import text as _sql
    from bot.db import session_scope
    async with session_scope() as s:
        res = await s.execute(
            _sql(
                "SELECT 1 FROM lamps WHERE strpos(CAST(media AS text), :fid) > 0 "
                "UNION ALL SELECT 1 FROM posts WHERE strpos(CAST(lamp_data AS text), :fid) > 0 LIMIT 1"
            ),
            {"fid": file_id},
        )
        return res.first() is not None


@router.get("/media/poster/{file_id:path}")
async def api_media_poster(file_id: str):
    # <img src> cannot carry the Bearer header, so instead of a login check this endpoint only
    # serves file_ids that belong to an existing listing/post, with a global rate limit.
    if file_id not in _POSTER:
        fid = str(file_id or "")
        if not fid or len(fid) > 200 or not all(c.isalnum() or c in "-_" for c in fid):
            raise HTTPException(status_code=404, detail="no poster")
        now = time.monotonic()
        if _POSTER_MISS.get(fid, 0) > now:
            raise HTTPException(status_code=404, detail="no poster")
        _POSTER_HITS[:] = [t for t in _POSTER_HITS if now - t < 60]
        if len(_POSTER_HITS) >= 30:
            raise HTTPException(status_code=429, detail="too many poster requests")
        _POSTER_HITS.append(now)
        try:
            known = await _known_media(fid)
        except Exception:
            logger.warning("poster lookup failed", exc_info=True)
            known = False
        if not known:
            if len(_POSTER_MISS) > 5000:
                _POSTER_MISS.clear()
            _POSTER_MISS[fid] = now + 600
            raise HTTPException(status_code=404, detail="no poster")
    try:
        thumb = await _resolve_poster(file_id)
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("poster failed %s", exc)
        raise HTTPException(status_code=404, detail="no poster") from exc
    return RedirectResponse(url=f"/api/media/file/{thumb}", status_code=307)


@router.get("/media/file/{file_id:path}")
async def api_media_file(file_id: str, request: Request):
    settings = get_settings()
    if not settings.bot_token:
        raise HTTPException(status_code=503, detail="BOT_TOKEN 未配置")
    local = _disk_path(file_id)
    if local.is_file() and local.stat().st_size > 0 and not request.headers.get("range"):
        mime = _mime_for(file_id, str(local))
        return FileResponse(local, media_type=mime, headers=_CACHE_HDR)
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

    length = 0
    try:
        length = int(resp.headers.get("content-length") or 0)
    except ValueError:
        length = 0
    can_store = (
        resp.status_code == 200
        and not rng
        and 0 < length <= _DISK_MAX
        and not file_id.startswith(("BAAC", "BQAC"))
    )
    if can_store:
        try:
            _DISK_DIR.mkdir(parents=True, exist_ok=True)
            tmp = local.with_suffix(".part")
            with tmp.open("wb") as fh:
                async for chunk in resp.aiter_bytes(64 * 1024):
                    fh.write(chunk)
            tmp.replace(local)
        except Exception:
            logger.exception("disk cache write failed")
        finally:
            await resp.aclose()
            await client.aclose()
        if local.is_file():
            return FileResponse(local, media_type=mime, headers=_CACHE_HDR)

    async def stream():
        try:
            async for chunk in resp.aiter_bytes(64 * 1024):
                yield chunk
        finally:
            await resp.aclose()
            await client.aclose()

    out = dict(_CACHE_HDR)
    if resp.headers.get("content-range"):
        out["Content-Range"] = resp.headers["content-range"]
    if resp.headers.get("content-length"):
        out["Content-Length"] = resp.headers["content-length"]
    return StreamingResponse(stream(), status_code=resp.status_code, media_type=mime, headers=out)
