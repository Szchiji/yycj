"""首页卡片流置顶与运营配置（与精选轮播 HomepagePin 独立）。"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import select

from bot.db import session_scope
from bot.models import Lamp, LampStatus, SiteSettings

DEFAULT_OPS = {
    "home_feed_page_size": 3,
    "chat_cta_label": "想聊聊",
    "bot_welcome_text": "",
    "media_max_count": 9,
    "review_require_audit": True,
}


def merge_ops(raw) -> Dict[str, Any]:
    out = dict(DEFAULT_OPS)
    if isinstance(raw, dict):
        for k, v in raw.items():
            if k in DEFAULT_OPS:
                out[k] = v
    try:
        out["home_feed_page_size"] = max(1, min(50, int(out.get("home_feed_page_size") or 3)))
    except (TypeError, ValueError):
        out["home_feed_page_size"] = 3
    try:
        out["media_max_count"] = max(1, min(9, int(out.get("media_max_count") or 9)))
    except (TypeError, ValueError):
        out["media_max_count"] = 9
    out["chat_cta_label"] = str(out.get("chat_cta_label") or "想聊聊")[:32]
    out["bot_welcome_text"] = str(out.get("bot_welcome_text") or "")[:2000]
    out["review_require_audit"] = bool(out.get("review_require_audit", True))
    return out


async def set_feed_pin(lamp_id: str, *, pinned: bool = True, pin_order: int = 0) -> Dict[str, Any]:
    """卡片流置顶（非轮播）。"""
    async with session_scope() as s:
        res = await s.execute(select(Lamp).where(Lamp.lamp_id == lamp_id))
        lamp = res.scalar_one_or_none()
        if not lamp:
            raise ValueError("资料不存在")
        if lamp.status != LampStatus.ACTIVE.value:
            raise ValueError("仅已上架资料可置顶")
        lamp.feed_pinned = bool(pinned)
        lamp.feed_pin_order = int(pin_order) if pinned else 0
        lamp.updated_at = datetime.utcnow()
        await s.flush()
        return {
            "lamp_id": lamp.lamp_id,
            "feed_pinned": bool(lamp.feed_pinned),
            "feed_pin_order": int(lamp.feed_pin_order or 0),
            "title": lamp.title,
            "city": lamp.city,
        }


async def list_feed_pins() -> List[Dict[str, Any]]:
    async with session_scope() as s:
        res = await s.execute(
            select(Lamp)
            .where(Lamp.status == LampStatus.ACTIVE.value, Lamp.feed_pinned.is_(True))
            .order_by(Lamp.feed_pin_order.asc(), Lamp.updated_at.desc())
        )
        lamps = list(res.scalars().all())
    return [
        {
            "lamp_id": x.lamp_id,
            "title": x.title,
            "city": x.city,
            "feed_pinned": True,
            "feed_pin_order": int(x.feed_pin_order or 0),
        }
        for x in lamps
    ]


async def list_approved_lamps_brief(limit: int = 100) -> List[Dict[str, Any]]:
    """管理端下拉：已上架资料简表。"""
    async with session_scope() as s:
        res = await s.execute(
            select(Lamp)
            .where(Lamp.status == LampStatus.ACTIVE.value)
            .order_by(Lamp.updated_at.desc())
            .limit(max(1, min(limit, 300)))
        )
        lamps = list(res.scalars().all())
    return [
        {
            "lamp_id": x.lamp_id,
            "title": x.title,
            "city": x.city,
            "feed_pinned": bool(getattr(x, "feed_pinned", False)),
        }
        for x in lamps
    ]
