"""投稿通知管理员、审核结果通知老师。"""
from __future__ import annotations

import logging
from typing import Any, Dict, List

from aiogram.types import InputMediaPhoto, InputMediaVideo

from bot.config import get_settings
from bot.keyboards import admin_post_kb
from bot.services import credit_service, home_service
from bot.services.media_urls import is_http

logger = logging.getLogger(__name__)


def _role_label(role: str) -> str:
    return {"teacher": "老师", "guest": "客人", "merchant": "商家"}.get(role or "", role or "-")


async def notify_admins_new_post(post_id: str, user_id: int, lamp_data: Dict[str, Any]) -> None:
    from bot.main import bot

    u = await credit_service.ensure_user(user_id)
    uname = u.get("username") or "-"
    nick = u.get("full_name") or "-"
    role = _role_label(lamp_data.get("publisher_role") or u.get("role") or "")
    media = list(lamp_data.get("media") or [])
    photos = list(lamp_data.get("photos") or [])
    caption = (
        f"🆕 新投稿 <code>{post_id[:8]}</code>\n"
        f"用户 ID：<code>{user_id}</code>\n"
        f"用户名：@{uname} · 昵称：{nick}\n"
        f"身份：{role}\n"
        f"城市：{lamp_data.get('city') or ''} {lamp_data.get('district') or ''}\n"
        f"称呼：{lamp_data.get('title') or ''}\n"
        f"价位：{lamp_data.get('price_text') or '面议'}\n"
        f"{(lamp_data.get('description') or '')[:500]}\n"
        f"媒体：{len(media) or len(photos)} 个"
    )
    kb = admin_post_kb(post_id)
    items: List[Dict[str, str]] = media or [{"type": "image", "url": p} for p in photos]
    sent = False
    group = []
    for i, m in enumerate(items[:9]):
        raw = (m.get("file_id") or m.get("url") or "").strip()
        if not raw or is_http(raw):
            continue
        cap = caption if i == 0 else None
        if (m.get("type") or "image") == "video":
            group.append(InputMediaVideo(media=raw, caption=cap))
        else:
            group.append(InputMediaPhoto(media=raw, caption=cap))
    for admin_id in get_settings().admin_id_list:
        try:
            if group:
                await bot.send_media_group(admin_id, media=group)
                await bot.send_message(admin_id, "点下方审核。", reply_markup=kb)
                sent = True
            else:
                await bot.send_message(admin_id, caption, reply_markup=kb)
                sent = True
        except Exception:
            logger.exception("notify admin %s failed", admin_id)
    if not sent:
        logger.warning("no admin received post %s", post_id)


async def notify_publisher_approved(user_id: int, title: str, album_url: str | None = None) -> None:
    from bot.main import bot
    from bot.services import bot_info

    site = await home_service.get_or_create_settings()
    promo = (site.get("approve_promo_text") or "").strip()
    ident = await bot_info.get_bot_identity()
    uname = ident.get("username") or ""
    link = bot_info.bot_tme_url(uname)
    text = f"你的资料「{title}」已通过审核并上架。"
    if promo:
        text = f"{text}\n\n{promo}"
    if album_url:
        text += f"\n\n频道相册：{album_url}"
    if link:
        text += f"\n\n机器人：{link}"
    try:
        await bot.send_message(user_id, text)
    except Exception:
        logger.exception("notify publisher approved failed")
