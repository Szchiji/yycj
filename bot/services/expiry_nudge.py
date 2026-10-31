"""上架到期提醒：剩 3 天、剩 1 天各提醒老师一次（每个到期日各一次）。"""
from __future__ import annotations

from html import escape as _h

import logging
from datetime import datetime, timedelta
from typing import Any, Dict

from sqlalchemy import select

from bot.db import session_scope
from bot.models import Lamp, LampStatus
from bot.services.extras_store import load_extras, save_extras

logger = logging.getLogger(__name__)


def _stage(hours_left: float, days: int, last_day: int) -> str | None:
    """Which reminder is due: "1d" inside the last day, "3d" inside the first window, else None."""
    if hours_left <= last_day * 24:
        return "1d"
    if hours_left <= days * 24:
        return "3d"
    return None


async def nudge_expiring(days: int = 3, last_day: int = 1) -> int:
    now = datetime.utcnow()
    until = now + timedelta(days=days)
    sent = 0
    async with session_scope() as s:
        rows = (
            await s.execute(
                select(Lamp).where(
                    Lamp.status == LampStatus.ACTIVE.value,
                    Lamp.expires_at.is_not(None),
                    Lamp.expires_at <= until,
                    Lamp.expires_at > now,
                )
            )
        ).scalars().all()
        items = [r.__dict__.copy() for r in rows]
    if not items:
        return 0
    try:
        from bot.main import bot
    except Exception:
        return 0
    admin_url = ""
    try:
        from bot.services import home_service
        admin_url = str((await home_service.get_or_create_settings()).get("admin_contact") or "").strip()
    except Exception:
        admin_url = ""
    markup = None
    if admin_url.startswith(("https://", "tg://")):
        from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup
        markup = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="联系管理员续期", url=admin_url)]])
    for lamp in items:
        lid = str(lamp.get("lamp_id") or "")
        uid = lamp.get("user_id")
        exp = lamp.get("expires_at")
        hours_left = (exp - now).total_seconds() / 3600 if exp else days * 24
        stage = _stage(hours_left, days, last_day)
        if not stage:
            continue
        extras: Dict[str, Any] = await load_extras(lid)
        mark = f"nudge-{str(exp)[:10]}"
        key = "_expiry_nudge_1d" if stage == "1d" else "_expiry_nudge"
        if extras.get(key) == mark:
            continue
        title = _h(str(lamp.get("title") or ""))
        if stage == "1d":
            text = f"「{title}」明天就到期了（剩不到 24 小时），到期后会自动下架。联系管理员续期即可继续展示。"
        else:
            text = f"「{title}」还有约 {max(1, int(hours_left // 24))} 天到期。联系管理员续费后可以继续展示。"
        try:
            await bot.send_message(int(uid), text, reply_markup=markup)
            extras[key] = mark
            if stage == "1d":
                extras.setdefault("_expiry_nudge", mark)  # never send the 3-day one after the 1-day one
            await save_extras(lid, extras)
            sent += 1
        except Exception:
            logger.exception("expiry nudge failed %s", lid)
    return sent
