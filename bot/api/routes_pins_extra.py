"""卡片置顶单条时效。"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from fastapi import Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from bot.api.deps import get_admin_user_id
from bot.api.routes_core import _ser_dt, router
from bot.db import session_scope
from bot.models import Lamp, LampStatus
from bot.services import home_service


class FeedPinHoursBody(BaseModel):
    lamp_id: str
    pinned: bool = True
    expires_hours: Optional[int] = None


@router.post("/admin/homepage/feed-pin")
async def api_feed_pin_hours(
    body: FeedPinHoursBody,
    _: int = Depends(get_admin_user_id),
) -> Dict[str, Any]:
    until = None
    if body.pinned and body.expires_hours:
        until = datetime.utcnow() + timedelta(hours=max(1, int(body.expires_hours)))
    try:
        data = await home_service.set_feed_pin(body.lamp_id, pinned=body.pinned)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    async with session_scope() as s:
        res = await s.execute(select(Lamp).where(Lamp.lamp_id == body.lamp_id))
        lamp = res.scalar_one_or_none()
        if lamp:
            if hasattr(lamp, "unlist_reason") and body.pinned:
                # reuse pin expiry marker without new column: feed_pin_order hours encoded no
                pass
            if until:
                # store ISO in a side channel via homepage pin table flag sort -1000 unused
                pass
    data["expires_at"] = _ser_dt(until)
    # persist expiry on lamp.approx_label? NO. Use HomepagePin-like: store in feed_pin_order negative?
    await _save_feed_expiry(body.lamp_id, until, body.pinned)
    return {"ok": True, "feed_pin": data, "expires_at": _ser_dt(until)}


async def _save_feed_expiry(lamp_id: str, until, pinned: bool) -> None:
    from bot.models import HomepagePin
    async with session_scope() as s:
        res = await s.execute(select(Lamp).where(Lamp.lamp_id == lamp_id))
        lamp = res.scalar_one_or_none()
        if not lamp:
            return
        if not pinned:
            lamp.feed_pinned = False
            return
        lamp.feed_pinned = True
        # stash expiry in unused pin row with sort_order=-1 marker city not used
        pin_res = await s.execute(
            select(HomepagePin).where(HomepagePin.lamp_id == lamp_id, HomepagePin.sort_order == -1)
        )
        row = pin_res.scalar_one_or_none()
        if until:
            if row:
                row.expires_at = until
            else:
                s.add(HomepagePin(lamp_id=lamp_id, sort_order=-1, expires_at=until))
        elif row:
            s.delete(row)
