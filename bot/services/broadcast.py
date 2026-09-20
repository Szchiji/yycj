"""审核通过后按模板推送到频道，尽量发相册。"""
from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from aiogram.types import InputMediaPhoto, InputMediaVideo

from bot.services import home_service
from bot.services.media_urls import enrich_media, is_http

logger = logging.getLogger(__name__)

DEFAULT_TPL = "🌙 月影车姬 · 新上架\n{称呼}\n📍 {地点}\n💰 {价位}\n{标签}\n{简介}\n{链接}"


def normalize_chat(chat: str) -> str:
    raw = (chat or "").strip()
    if not raw:
        return ""
    if raw.startswith("https://t.me/"):
        tail = raw.split("?")[0].rstrip("/").rsplit("/", 1)[-1]
        return tail if tail.lstrip("-").isdigit() else "@" + tail.lstrip("@")
    return raw


def album_link(chat: str, message_id: int) -> str:
    raw = normalize_chat(chat)
    if raw.startswith("@"):
        return f"https://t.me/{raw[1:]}/{message_id}"
    digits = raw.lstrip("-")
    if digits.startswith("100") and len(digits) > 6:
        digits = digits[3:]
    return f"https://t.me/c/{digits}/{message_id}"


def fill_template(tpl: str, lamp: Dict[str, Any], extras: Optional[Dict[str, Any]], link: str) -> str:
    extras = extras or {}
    city = str(lamp.get("city") or "")
    district = str(lamp.get("district") or "")
    loc = " · ".join(x for x in (city, district) if x)
    tags = " ".join("#" + str(t) for t in (lamp.get("tags") or []) if t)
    mapping = {
        "称呼": lamp.get("title") or "",
        "title": lamp.get("title") or "",
        "花名": lamp.get("title") or "",
        "城市": city,
        "简介": (lamp.get("description") or "").strip(),
        "desc": (lamp.get("description") or "").strip(),
        "价位": lamp.get("price_text") or "面议",
        "price": lamp.get("price_text") or "面议",
        "区域": district,
        "地区": loc or district or city,
        "大致位置": lamp.get("approx_label") or "",
        "标签": tags,
        "tags": tags,
        "地点": loc,
        "loc": loc,
        "链接": link or "",
        "link": link or "",
    }
    for key, val in extras.items():
        if key and not str(key).startswith("_"):
            mapping[str(key)] = "" if val is None else str(val)
    if mapping.get("联系") and not mapping.get("微信"):
        mapping["微信"] = mapping["联系"]
    if mapping.get("微信") and not mapping.get("联系"):
        mapping["联系"] = mapping["微信"]
    text = tpl or DEFAULT_TPL
    for key, val in mapping.items():
        text = text.replace("{" + key + "}", str(val))
    text = re.sub(r"\{[^}]{1,20}\}", "", text)
    cleaned = []
    for line in text.splitlines():
        s = line.rstrip()
        if s.endswith("：") or s.endswith(":"):
            continue
        cleaned.append(s)
    return "\n".join(cleaned).strip()[:1024]


def _media_items(lamp: Dict[str, Any]) -> List[Tuple[str, str]]:
    items: List[Tuple[str, str]] = []
    for m in enrich_media(lamp.get("media"), lamp.get("photos"))[:10]:
        raw = str(m.get("file_id") or m.get("url") or "").strip()
        if not raw or is_http(raw):
            continue
        items.append(((m.get("type") or "image"), raw))
    return items


async def resolve_media_chat() -> Optional[str]:
    try:
        site = await home_service.get_or_create_settings()
        raw = normalize_chat(str(site.get("media_channel_id") or ""))
        if raw:
            return raw
    except Exception:
        logger.exception("resolve media chat from settings failed")
    from bot.config import get_settings
    chat = get_settings().media_storage_chat_id
    return str(chat) if chat else None


async def _remember(lamp_id: str, chat: str, mid: int) -> None:
    if not lamp_id or not mid:
        return
    try:
        from bot.services.extras_store import load_extras, save_extras
        cur = await load_extras(lamp_id)
        cur["_bc_chat"] = chat
        cur["_bc_mid"] = str(mid)
        await save_extras(lamp_id, cur)
    except Exception:
        logger.exception("remember broadcast ref failed")


async def _caption(lamp: Dict[str, Any], extras: Optional[Dict[str, Any]]) -> tuple[str, str]:
    site = await home_service.get_or_create_settings()
    chat = normalize_chat(str(site.get("broadcast_channel") or ""))
    from bot.services import bot_info
    ident = await bot_info.get_bot_identity()
    link = bot_info.bot_tme_url(ident.get("username") or "")
    merged = {}
    if isinstance(lamp.get("extras"), dict):
        merged.update(lamp.get("extras") or {})
    merged.update(extras or {})
    merged.setdefault("聊天按钮", site.get("chat_cta_label") or "想聊聊")
    caption = fill_template(str(site.get("broadcast_template") or ""), lamp, merged, link)
    return chat, caption


async def broadcast_listing(lamp: Dict[str, Any], extras: Optional[Dict[str, Any]] = None) -> Optional[str]:
    chat, caption = await _caption(lamp, extras)
    if not chat:
        return None
    from bot.main import bot
    items = _media_items(lamp)
    try:
        msg = None
        if len(items) >= 2:
            group = []
            for i, (kind, raw) in enumerate(items):
                cap = caption if i == 0 else None
                if kind == "video":
                    group.append(InputMediaVideo(media=raw, caption=cap))
                else:
                    group.append(InputMediaPhoto(media=raw, caption=cap))
            msgs = await bot.send_media_group(chat, media=group)
            msg = msgs[0] if msgs else None
        elif len(items) == 1:
            kind, raw = items[0]
            if kind == "video":
                msg = await bot.send_video(chat, raw, caption=caption)
            else:
                msg = await bot.send_photo(chat, raw, caption=caption)
        else:
            msg = await bot.send_message(chat, caption)
        mid = getattr(msg, "message_id", None)
        if mid:
            await _remember(str(lamp.get("lamp_id") or ""), chat, int(mid))
            return album_link(chat, int(mid))
        return None
    except Exception:
        logger.exception("broadcast to %s failed", chat)
        return None


async def update_broadcast(lamp: Dict[str, Any], extras: Optional[Dict[str, Any]] = None) -> Optional[str]:
    """只改原频道帖文案，不新发。"""
    from bot.services.extras_store import load_extras
    from bot.main import bot
    lid = str(lamp.get("lamp_id") or "")
    stored = await load_extras(lid)
    chat = stored.get("_bc_chat") or ""
    mid = stored.get("_bc_mid") or ""
    if not chat or not str(mid).isdigit():
        return None
    _chat, caption = await _caption(lamp, extras)
    try:
        await bot.edit_message_caption(chat_id=chat, message_id=int(mid), caption=caption)
        return album_link(chat, int(mid))
    except Exception:
        try:
            await bot.edit_message_text(chat_id=chat, message_id=int(mid), text=caption)
            return album_link(chat, int(mid))
        except Exception:
            logger.exception("edit original broadcast failed")
            return None
