"""分享深链：先加机器人、强制订阅，再进对应资料。"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple

from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo

from bot.config import get_settings
from bot.services import home_service

logger = logging.getLogger(__name__)


def parse_share_payload(arg: str) -> Optional[str]:
    raw = (arg or "").strip()
    if raw.startswith("s_"):
        raw = raw[2:]
    raw = raw.replace("-", "")
    if len(raw) == 32:
        return f"{raw[0:8]}-{raw[8:12]}-{raw[12:16]}-{raw[16:20]}-{raw[20:32]}"
    return None


async def missing_required(user_id: int) -> List[Dict[str, Any]]:
    site = await home_service.get_or_create_settings()
    chats = list(site.get("required_chats") or [])
    if not chats:
        return []
    from bot.main import bot

    missing: List[Dict[str, Any]] = []
    for c in chats:
        chat_id = c.get("chat_id") or c.get("id") or c.get("username")
        if not chat_id:
            continue
        try:
            member = await bot.get_chat_member(chat_id, user_id)
            status = getattr(member, "status", "") or ""
            if status in ("left", "kicked"):
                missing.append(c)
        except Exception:
            logger.warning("membership check failed %s", chat_id)
            missing.append(c)
    return missing


def join_kb(chats: List[Dict[str, Any]], lamp_id: str) -> InlineKeyboardMarkup:
    rows = []
    for c in chats:
        title = c.get("title") or c.get("name") or "频道"
        url = c.get("url") or ""
        uname = str(c.get("username") or c.get("chat_id") or "").lstrip("@")
        if not url and uname and not str(uname).lstrip("-").isdigit():
            url = f"https://t.me/{uname}"
        if url:
            rows.append([InlineKeyboardButton(text=f"加入 {title}", url=url)])
    rows.append([InlineKeyboardButton(text="我已关注，查看资料", callback_data=f"share_go:{lamp_id}")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def open_card_kb(lamp_id: str) -> Optional[InlineKeyboardMarkup]:
    webapp = get_settings().normalized_webapp_url
    if not webapp:
        return None
    sep = "&" if "?" in webapp else "?"
    url = f"{webapp}{sep}lamp={lamp_id}"
    return InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text="打开资料", web_app=WebAppInfo(url=url))]]
    )
