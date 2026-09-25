"""审核通过后写入上架有效期；搜索结果补 preview_url。"""
from __future__ import annotations

import logging
from datetime import datetime

from bot.services import listing_ops, search_service
from bot.services.media_urls import enrich_media

logger = logging.getLogger(__name__)

_orig_approve = search_service.approve_lamp
_orig_search = search_service.search_lamps
_orig_get = search_service.get_lamp
_orig_to_dict = search_service._lamp_to_dict


def _with_preview(d):
    if not d:
        return d
    out = dict(d)
    media = enrich_media(out.get("media"), out.get("photos"))
    out["media"] = media
    out["photos"] = [m.get("preview_url") or m.get("url") for m in media if m.get("type") == "image"]
    return out


async def approve_lamp(lamp_id: str, *, days=None):
    await _orig_approve(lamp_id)
    try:
        await listing_ops.set_listing_expiry(lamp_id, days=days)
    except Exception:
        logger.exception("set expiry after approve failed")


async def search_lamps(**kwargs):
    items = await _orig_search(**kwargs)
    now = datetime.utcnow()
    out = []
    for x in items:
        x = _with_preview(x)
        exp = x.get("expires_at")
        if exp is not None and hasattr(exp, "tzinfo"):
            exp = exp.replace(tzinfo=None) if exp.tzinfo else exp
        if exp is not None and exp <= now:
            continue
        out.append(x)
    return out


async def get_lamp(lamp_id: str):
    return _with_preview(await _orig_get(lamp_id))


def _lamp_to_dict(lamp):
    return _with_preview(_orig_to_dict(lamp))


search_service.approve_lamp = approve_lamp  # type: ignore[assignment]
search_service.search_lamps = search_lamps  # type: ignore[assignment]
search_service.get_lamp = get_lamp  # type: ignore[assignment]
search_service._lamp_to_dict = _lamp_to_dict  # type: ignore[assignment]
