"""已上架资料：下架、重新上架、续期、到期处理。"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import or_, select

from bot.db import session_scope
from bot.models import HomepagePin, Lamp, LampStatus
from bot.services import home_service

logger = logging.getLogger(__name__)


async def _listing_days() -> int:
    settings = await home_service.get_or_create_settings()
    return int(settings.get("listing_days") or 30)


async def set_listing_expiry(lamp_id: str, *, days: Optional[int] = None) -> Dict[str, Any]:
    days = int(days if days is not None else await _listing_days())
    until = datetime.utcnow() + timedelta(days=max(1, days))
    async with session_scope() as s:
        res = await s.execute(select(Lamp).where(Lamp.lamp_id == lamp_id))
        lamp = res.scalar_one_or_none()
        if not lamp:
            raise ValueError("资料不存在")
        lamp.expires_at = until
        lamp.unlist_reason = None
        if lamp.status == LampStatus.HIDDEN.value:
            lamp.status = LampStatus.ACTIVE.value
        lamp.updated_at = datetime.utcnow()
        await s.flush()
        return {"lamp_id": lamp.lamp_id, "expires_at": lamp.expires_at, "status": lamp.status}


async def unlist_lamp(lamp_id: str, *, reason: str = "admin") -> Dict[str, Any]:
    async with session_scope() as s:
        res = await s.execute(select(Lamp).where(Lamp.lamp_id == lamp_id))
        lamp = res.scalar_one_or_none()
        if not lamp:
            raise ValueError("资料不存在")
        lamp.status = LampStatus.HIDDEN.value
        lamp.unlist_reason = (reason or "admin")[:64]
        lamp.feed_pinned = False
        lamp.updated_at = datetime.utcnow()
        pin_res = await s.execute(select(HomepagePin).where(HomepagePin.lamp_id == lamp_id))
        for pin in pin_res.scalars().all():
            s.delete(pin)
        await s.flush()
        return {"lamp_id": lamp.lamp_id, "status": lamp.status, "reason": lamp.unlist_reason}


async def relist_lamp(lamp_id: str) -> Dict[str, Any]:
    async with session_scope() as s:
        res = await s.execute(select(Lamp).where(Lamp.lamp_id == lamp_id))
        lamp = res.scalar_one_or_none()
        if not lamp:
            raise ValueError("资料不存在")
        if lamp.expires_at and lamp.expires_at <= datetime.utcnow():
            raise ValueError("已过期，请先续期")
        lamp.status = LampStatus.ACTIVE.value
        lamp.unlist_reason = None
        lamp.updated_at = datetime.utcnow()
        await s.flush()
        return {"lamp_id": lamp.lamp_id, "status": lamp.status, "expires_at": lamp.expires_at}


async def expire_due_lamps() -> int:
    now = datetime.utcnow()
    n = 0
    async with session_scope() as s:
        res = await s.execute(
            select(Lamp).where(
                Lamp.status == LampStatus.ACTIVE.value,
                Lamp.expires_at.is_not(None),
                Lamp.expires_at <= now,
            )
        )
        lamps = list(res.scalars().all())
        ids = [x.lamp_id for x in lamps]
        for lamp in lamps:
            lamp.status = LampStatus.HIDDEN.value
            lamp.unlist_reason = "expired"
            lamp.feed_pinned = False
            lamp.updated_at = now
            n += 1
        if ids:
            pin_res = await s.execute(select(HomepagePin).where(HomepagePin.lamp_id.in_(ids)))
            for pin in pin_res.scalars().all():
                s.delete(pin)
        await s.flush()
    try:
        from bot.services import listing_flow
        r = await listing_flow.remind_expiring(3)
        if r:
            logger.info("expiry remind sent %s", r)
    except Exception:
        logger.exception("expiry remind failed")
    return n


async def list_listed(limit: int = 100) -> List[Dict[str, Any]]:
    async with session_scope() as s:
        res = await s.execute(
            select(Lamp)
            .where(or_(Lamp.status == LampStatus.ACTIVE.value, Lamp.status == LampStatus.HIDDEN.value))
            .order_by(Lamp.updated_at.desc())
            .limit(max(1, min(limit, 300)))
        )
        rows = list(res.scalars().all())
    return [
        {
            "lamp_id": x.lamp_id,
            "title": x.title,
            "city": x.city,
            "status": x.status,
            "expires_at": x.expires_at,
            "unlist_reason": x.unlist_reason,
            "feed_pinned": bool(x.feed_pinned),
            "user_id": x.user_id,
        }
        for x in rows
    ]
