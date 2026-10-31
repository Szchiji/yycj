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
    "show_chat_cta": True,
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
    "extra_admin_ids": [],
    # {"<operator user_id>": ["深圳", ...]}: operators listed here only see / act on those cities.
    "operator_cities": {},
    # {"深圳": {"text": "...", "enabled": true}}: overrides the global announcement on that city's home.
    "city_announcements": {},
    # {"深圳": {"broadcast_channel": "@sz_ch", ...}}: per-city overrides; missing/empty = site-wide value.
    "city_overrides": {},
    "approve_promo_text": "你的资料已上架。\n欢迎把月影车姬介绍给朋友：在 Telegram 搜索同名机器人，点左下角「首页」开始。",
    "broadcast_channel": "",
    "media_channel_id": "",
    "broadcast_template": "🌙 月影车姬 · 新上架\n{称呼}\n📍 {地点}\n💰 {价位}\n{标签}\n{简介}\n{链接}",
    "broadcast_reviews": False,  # 精选评价推送到频道（默认关）
    "review_proof_required": False,  # 约课凭证必传（默认关）
    "channel_directory": False,  # 频道按区目录（每天 12:00 刷新同一条，默认关）
    "review_public_photos": True,  # 保留公开晒图（≤3）；关 = 只收私密凭证
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
        {"key": "聊天按钮", "label": "聊天按钮", "form": False},
    ],
}


# Settings a city may override (key, label, type, extra). Everything else stays site-wide.
# "super": only the super admin may set it (a scoped operator sees it read-only).
CITY_KEYS = [
    {"key": "broadcast_channel", "label": "推送频道", "type": "text", "max": 128, "super": True,
     "hint": "新上架资料推送到这个频道（@频道名 或 -100…）；空 = 用全站频道"},
    {"key": "broadcast_template", "label": "推送文案模板", "type": "textarea", "max": 2000},
    {"key": "review_proof_required", "label": "评价必须上传约课凭证", "type": "bool",
     "hint": "开 = 客人写评价必须附 1–5 张凭证（仅管理员可见）"},
    {"key": "review_public_photos", "label": "评价允许公开晒图", "type": "bool",
     "hint": "关 = 只收私密约课凭证，不再显示公开晒图"},
    {"key": "channel_directory", "label": "频道按区目录", "type": "bool",
     "hint": "开 = 每天 12:00 在推送频道更新一条按区目录，花名直达详情（默认关）"},
    {"key": "broadcast_reviews", "label": "精选评价推送到频道", "type": "bool",
     "hint": "开 = 带图且审核通过的评价同步发到该城推送频道（默认关）"},
    {"key": "approve_promo_text", "label": "上架通过后发给老师的话", "type": "textarea", "max": 2000},
    {"key": "chat_cta_label", "label": "聊天按钮文字", "type": "text", "max": 32},
    {"key": "admin_contact", "label": "管理员联系链接", "type": "text", "max": 128,
     "hint": "首页「管理员」按钮打开的链接，https://t.me/用户名 或 @用户名"},
    {"key": "admin_btn_label", "label": "管理员按钮文字", "type": "text", "max": 16},
    {"key": "show_admin_link", "label": "首页显示管理员按钮", "type": "bool"},
    {"key": "review_require_audit", "label": "评价需审核", "type": "bool",
     "hint": "关 = 这个城市的新评价直接发布，不进待审"},
    {"key": "home_feed_page_size", "label": "首页每次加载卡片数", "type": "int", "min": 1, "max": 50},
    {"key": "carousel_interval_sec", "label": "轮播间隔（秒）", "type": "int", "min": 2, "max": 15},
    {"key": "listing_days", "label": "上架天数", "type": "int", "min": 1, "max": 365, "super": True},
]
CITY_KEY_MAP = {x["key"]: x for x in CITY_KEYS}


def audit_on(value: Any) -> bool:
    """评价需审核: only an explicit off turns it off; missing / null / junk keeps today's behaviour (ON)."""
    if value is False or value == 0:
        return False
    if isinstance(value, str) and value.strip().lower() in ("false", "0", "off", "no"):
        return False
    return True


def clean_override_value(key: str, value: Any) -> Any:
    """Return the cleaned override value, or None when it means 'use the site-wide value'."""
    meta = CITY_KEY_MAP.get(key)
    if meta is None or value is None:
        return None
    t = meta["type"]
    if t == "bool":
        if isinstance(value, str):
            v = value.strip().lower()
            if v in ("", "inherit"):
                return None
            return v in ("1", "true", "on", "yes")
        return bool(value)
    if t == "int":
        if isinstance(value, str) and not value.strip():
            return None
        try:
            n = int(value)
        except (TypeError, ValueError):
            return None
        return max(meta["min"], min(meta["max"], n))
    text = str(value)
    if t == "text":
        text = text.strip()
    text = text[: meta.get("max", 2000)]
    return text if text.strip() else None


def clean_city_overrides(raw: Any) -> Dict[str, Dict[str, Any]]:
    out: Dict[str, Dict[str, Any]] = {}
    if not isinstance(raw, dict):
        return out
    for city, vals in list(raw.items())[:50]:
        c = str(city or "").strip()[:32]
        if not c or not isinstance(vals, dict):
            continue
        clean = {}
        for k, v in vals.items():
            cv = clean_override_value(str(k), v)
            if cv is not None:
                clean[str(k)] = cv
        if clean:
            out[c] = clean
    return out


def ops_for_city(settings: Dict[str, Any], city: Optional[str]) -> Dict[str, Any]:
    """Site settings with that city's overrides applied. No city / unknown city = site-wide."""
    over = (settings.get("city_overrides") or {}).get(str(city or "").strip()) if city else None
    if not over:
        return settings
    out = dict(settings)
    for k, v in over.items():
        if k in CITY_KEY_MAP and v is not None:
            out[k] = v
    return out


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
        form = False if key in ("地点", "链接", "聊天按钮") else bool(item.get("form", True))
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
    out["show_chat_cta"] = bool(out.get("show_chat_cta", True))
    out["bot_welcome_text"] = str(out.get("bot_welcome_text") or "")[:2000]
    out["approve_promo_text"] = str(out.get("approve_promo_text") or DEFAULT_OPS["approve_promo_text"])[:2000]
    out["broadcast_channel"] = str(out.get("broadcast_channel") or "").strip()[:128]
    out["media_channel_id"] = str(out.get("media_channel_id") or "").strip()[:128]
    out["broadcast_template"] = str(out.get("broadcast_template") or DEFAULT_OPS["broadcast_template"])[:2000]
    out["broadcast_reviews"] = bool(out.get("broadcast_reviews"))
    out["review_proof_required"] = bool(out.get("review_proof_required"))
    out["channel_directory"] = bool(out.get("channel_directory"))
    out["review_public_photos"] = out.get("review_public_photos") is not False
    raw_fields = raw.get("listing_fields") if isinstance(raw, dict) and "listing_fields" in raw else out.get("listing_fields")
    out["listing_fields"] = _sanitize_listing_fields(raw_fields, fallback=DEFAULT_OPS["listing_fields"])
    out["review_require_audit"] = audit_on(out.get("review_require_audit"))
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
    ids = []
    for x in out.get("extra_admin_ids") or []:
        try:
            n = int(x)
        except (TypeError, ValueError):
            continue
        if n and n not in ids:
            ids.append(n)
    out["extra_admin_ids"] = ids[:200]
    chats = out.get("required_chats") or []
    out["required_chats"] = chats if isinstance(chats, list) else []
    from bot.services.city_scope import clean_operator_cities
    out["operator_cities"] = clean_operator_cities(out.get("operator_cities"))
    anns = {}
    raw_anns = out.get("city_announcements")
    if isinstance(raw_anns, dict):
        for city, v in list(raw_anns.items())[:50]:
            c = str(city or "").strip()[:32]
            if not c or not isinstance(v, dict):
                continue
            text = str(v.get("text") or "")[:2000]
            if text.strip() or v.get("enabled"):
                anns[c] = {"text": text, "enabled": bool(v.get("enabled")) and bool(text.strip())}
    out["city_announcements"] = anns
    out["city_overrides"] = clean_city_overrides(out.get("city_overrides"))
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
