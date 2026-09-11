"""file_id → Mini App 可展示的预览地址。"""
from __future__ import annotations

from typing import Any, Dict, List
from urllib.parse import quote


def is_http(url: str) -> bool:
    u = (url or "").strip()
    return u.startswith("http://") or u.startswith("https://") or u.startswith("/")


def preview_url(url: str) -> str:
    u = (url or "").strip()
    if not u:
        return ""
    if is_http(u):
        return u
    return f"/api/media/file/{quote(u, safe='')}"


def enrich_media(media: List[Dict[str, Any]] | None, photos: List[str] | None = None) -> List[Dict[str, str]]:
    out: List[Dict[str, str]] = []
    for m in media or []:
        if not isinstance(m, dict):
            u = str(m).strip()
            if u:
                out.append({"type": "image", "url": u, "preview_url": preview_url(u)})
            continue
        raw = (m.get("url") or m.get("file_id") or "").strip()
        if not raw:
            continue
        kind = (m.get("type") or "image").lower()
        if kind not in ("image", "video"):
            kind = "image"
        item = {"type": kind, "url": raw, "preview_url": m.get("preview_url") or preview_url(raw)}
        if m.get("file_id"):
            item["file_id"] = str(m["file_id"])
        out.append(item)
    if not out:
        for p in photos or []:
            u = str(p).strip()
            if u:
                out.append({"type": "image", "url": u, "preview_url": preview_url(u)})
    return out
