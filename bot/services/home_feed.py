"""首页卡片流置顶与运营配置。"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import select

from bot.db import session_scope
from bot.models import HomepagePin, Lamp, LampStatus

DEFAULT_OPS = {
    "home_feed_page_size": 3,
    "chat_cta_label": "想聊聊",
    "bot_welcome_text": "",
    "media_max_count": 6,
    "review_require_audit": True,
    "listing_days": 30,
    "carousel_interval_sec": 4,
    "show_bot_link": True,
    "show_admin_link": True,
    "bot_btn_label": "机器人",
    "admin_btn_label": "管理员",
    "admin_contact": "",
    "required_chats": [],
    "approve_promo_text": "你的资料已上架。\n欢迎把月影车姬介绍给朋友：在 Telegram 搜索同名机器人，点左下角「首页」开始。",
    "broadcast_channel": "",
    "media_channel_id": "",
    "broadcast_template": "🌙 月影车姬 · 新上架\n{称呼}\n📍 {地点}\n💰 {价位}\n{标签}\n{简介}\n{链接}",
    "listing_fields": [
        {"key": "称呼", "label": "称呼", "form": True},
        {"key": "城市", "label": "城市", "form": True},
        {"key": "简介", "label": "简介", "form": True},
        {"key": "价位", "label": "价位", "form": True},
        {"key": "区域", "label": "区域", "form": True},
        {"key": "大致位置", "label": "大致位置", "form": True},
        {"key": "标签", "label": "标签", "form": True},
        {"key": "地点", "label": "地点", "form": False},
        {"key": "链接", "label": "链接", "form": False},
    ],
}


def _sanitize_listing_fields(fields, fallback=None):
    src = fields if isinstance(fields, list) else list(fallback or [])
    out = []
    seen = set()
    for item in src:
        if not isinstance(item, dict):
            continue
        key = str(item.get("key") or item.get("label") or "").strip()[:16]
        if not key or key in seen:
            continue
        seen.add(key)
        form = False if key in ("地点", "链接") else bool(item.get("form", True))
        out.append({"key": key, "label": str(item.get("label") or key)[:16], "form": form})
    return out or list(fallback or [])


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
    out["approve_promo_text"] = str(out.get("approve_promo_text") or DEFAULT_OPS["approve_promo_text"])[:2000]
    out["broadcast_channel"] = str(out.get("broadcast_channel") or "").strip()[:128]
    out["media_channel_id"] = str(out.get("media_channel_id") or "").strip()[:128]
    out["broadcast_template"] = str(out.get("broadcast_template") or DEFAULT_OPS["broadcast_template"])[:2000]
    raw_fields = raw.get("listing_fields") if isinstance(raw, dict) and "listing_fields" in raw else out.get("listing_fields")
    out["listing_fields"] = _sanitize_listing_fields(raw_fields, fallback=DEFAULT_OPS["listing_fields"])
    out["review_require_audit"] = bool(out.get("review_require_audit", True))
    try:
        out["listing_days"] = max(1, min(365, int(out.get("listing_days") or 30)))
    except (TypeError, ValueError):
        out["listing_days"] = 30
    try:
        out["carousel_interval_sec"] = max(2, min(15, int(out.get("carousel_interval_sec") or 4)))
    except (TypeError, ValueError):
        out["carousel_interval_sec"] = 4
    out["show_bot_link"] = bool(out.get("show_bot_link", True))
    out["show_admin_link"] = bool(out.get("show_admin_link", True))
    out["bot_btn_label"] = str(out.get("bot_btn_label") or "机器人")[:16]
    out["admin_btn_label"] = str(out.get("admin_btn_label") or "管理员")[:16]
    out["admin_contact"] = str(out.get("admin_contact") or "").strip()[:128]
    chats = out.get("required_chats") or []
    out["required_chats"] = chats if isinstance(chats, list) else []
    return out


async def set_feed_pin(lamp_id: str, *, pinned: bool = True, pin_order: int = 0) -> Dict[str, Any]:
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
        return {"lamp_id": lamp.lamp_id, "feed_pinned": bool(lamp.feed_pinned), "feed_pin_order": int(lamp.feed_pin_order or 0), "title": lamp.title, "city": lamp.city}


async def list_feed_pins() -> List[Dict[str, Any]]:
    async with session_scope() as s:
        res = await s.execute(
            select(Lamp)
            .where(Lamp.status == LampStatus.ACTIVE.value, Lamp.feed_pinned.is_(True))
            .order_by(Lamp.feed_pin_order.asc(), Lamp.updated_at.desc())
        )
        lamps = list(res.scalars().all())
    return [{"lamp_id": x.lamp_id, "title": x.title, "city": x.city, "feed_pinned": True, "feed_pin_order": int(x.feed_pin_order or 0)} for x in lamps]


async def list_approved_lamps_brief(limit: int = 100) -> List[Dict[str, Any]]:
    async with session_scope() as s:
        res = await s.execute(
            select(Lamp).where(Lamp.status == LampStatus.ACTIVE.value).order_by(Lamp.updated_at.desc()).limit(max(1, min(limit, 300)))
        )
        lamps = list(res.scalars().all())
    return [{"lamp_id": x.lamp_id, "title": x.title, "city": x.city, "feed_pinned": bool(getattr(x, "feed_pinned", False))} for x in lamps]
