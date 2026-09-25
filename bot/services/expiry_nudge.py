"""上架剩 3 天时提醒老师。"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, Dict

from sqlalchemy import select

from bot.db import session_scope
from bot.models import Lamp, LampStatus
from bot.services.extras_store import load_extras, save_extras

logger = logging.getLogger(__name__)


async def nudge_expiring(days: int = 3) -> int:
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
    for lamp in items:
        lid = str(lamp.get("lamp_id") or "")
        uid = lamp.get("user_id")
        extras: Dict[str, Any] = await load_extras(lid)
        mark = f"nudge-{str(lamp.get('expires_at'))[:10]}"
        if extras.get("_expiry_nudge") == mark:
            continue
        left = max(0, (lamp.get("expires_at") - now).days) if lamp.get("expires_at") else days
        try:
            await bot.send_message(
                int(uid),
                f"「{lamp.get('title') or ''}」还有约 {left} 天到期。联系管理员续费后可以继续展示。",
            )
            extras["_expiry_nudge"] = mark
            await save_extras(lid, extras)
            sent += 1
        except Exception:
            logger.exception("expiry nudge failed %s", lid)
    return sent
