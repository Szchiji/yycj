"""频道按区目录（可选，默认关）：每城一条消息，列出各区在架资料，花名直达小程序详情。

开关：城市设置「频道按区目录」(channel_directory)。每天 12:00（北京时间）刷新一次：
第一次发新消息，之后只编辑同一条，不刷屏。失败只记日志。
"""
from __future__ import annotations

import html
import logging
from typing import Dict, List

from sqlalchemy import select

from bot.db import session_scope
from bot.models import Lamp, LampStatus
from bot.models_extra import ChannelDirectory
from bot.services import home_service

logger = logging.getLogger(__name__)
MAX_PER_AREA = 30


def render(city: str, lamps: List[Dict], bot_name: str) -> str:
    from bot.services.broadcast import start_url as startapp_url
    from bot.services.search_service import district_key
    groups: Dict[str, List[Dict]] = {}
    for x in lamps:
        groups.setdefault(district_key(x.get("district")) or "其他", []).append(x)
    lines = [f"📖 <b>{html.escape(city)} · 按区目录</b>（点花名直达详情）"]
    for area in sorted(groups, key=lambda k: (-len(groups[k]), k)):
        items = groups[area][:MAX_PER_AREA]
        names = " · ".join(
            f'<a href="{startapp_url(bot_name, x["lamp_id"], "s")}">{html.escape(str(x.get("title") or "")[:12])}</a>'
            for x in items if startapp_url(bot_name, x["lamp_id"], "s")
        )
        lines.append(f"\n🌺 <b>{html.escape(area)}</b>（{len(groups[area])}）\n{names}")
    text = "\n".join(lines)
    return text[:4000]


async def refresh_city(city: str) -> bool:
    from bot.services.broadcast import normalize_chat
    from bot.services.home_feed import ops_for_city
    site = ops_for_city(await home_service.get_or_create_settings(), city)
    if not site.get("channel_directory"):
        return False
    chat = normalize_chat(str(site.get("broadcast_channel") or ""))
    if not chat:
        return False
    from bot.services import bot_info
    bot_name = (await bot_info.get_bot_identity()).get("username") or ""
    async with session_scope() as s:
        rows = (await s.execute(
            select(Lamp.lamp_id, Lamp.title, Lamp.district)
            .where(Lamp.status == LampStatus.ACTIVE.value, Lamp.city == city)
            .order_by(Lamp.created_at.desc()).limit(400)
        )).all()
        ref = (await s.execute(select(ChannelDirectory).where(ChannelDirectory.city == city))).scalar_one_or_none()
        ref_chat, ref_mid = (ref.chat, ref.message_id) if ref else ("", 0)
    if not rows:
        return False
    text = render(city, [{"lamp_id": a, "title": b, "district": c} for a, b, c in rows], bot_name)
    from bot.main import bot
    try:
        if ref_mid and ref_chat == chat:
            try:
                await bot.edit_message_text(text=text, chat_id=chat, message_id=ref_mid, disable_web_page_preview=True)
                return True
            except Exception as exc:
                if "not modified" in str(exc).lower():
                    return True
                logger.warning("directory edit failed (%s), posting new", str(exc)[:80])
        msg = await bot.send_message(chat, text, disable_web_page_preview=True)
        async with session_scope() as s:
            ref = (await s.execute(select(ChannelDirectory).where(ChannelDirectory.city == city))).scalar_one_or_none()
            if ref:
                ref.chat, ref.message_id = chat, int(msg.message_id)
            else:
                s.add(ChannelDirectory(city=city, chat=chat, message_id=int(msg.message_id)))
        return True
    except Exception:
        logger.exception("channel directory for %s failed", city)
        return False


async def job_refresh_all() -> int:
    n = 0
    try:
        site = await home_service.get_or_create_settings()
        for city in site.get("enabled_cities") or []:
            if await refresh_city(city):
                n += 1
    except Exception:
        logger.exception("channel directory job failed")
    return n
