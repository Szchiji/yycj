"""匿名月影会话：创建、中转映射、过期与结算。"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import or_, select

from bot.db import session_scope
from bot.models import Session, SessionStatus
from bot.services import credit_service


def _to_dict(row: Session) -> Dict[str, Any]:
    return {
        "session_id": row.session_id,
        "lamp_id": row.lamp_id,
        "user_a_id": row.user_a_id,
        "user_b_id": row.user_b_id,
        "anonymous_a": row.anonymous_a,
        "anonymous_b": row.anonymous_b,
        "status": row.status,
        "message_count": row.message_count,
        "media_count": row.media_count,
        "has_praise": row.has_praise,
        "reported": row.reported,
        "created_at": row.created_at,
        "expire_at": row.expire_at,
        "last_activity": row.last_activity,
        "ended_at": row.ended_at,
        "quality_score": row.quality_score,
    }


async def create_request(lamp_id: str, user_a_id: int, user_b_id: int) -> Dict[str, Any]:
    sid = str(uuid.uuid4())
    async with session_scope() as s:
        row = Session(
            session_id=sid,
            lamp_id=lamp_id,
            user_a_id=user_a_id,
            user_b_id=user_b_id,
            status=SessionStatus.PENDING.value,
            expire_at=datetime.utcnow() + timedelta(hours=24),
            last_activity=datetime.utcnow(),
        )
        s.add(row)
        await s.flush()
        return _to_dict(row)


async def get_session(session_id: str) -> Optional[Dict[str, Any]]:
    async with session_scope() as s:
        res = await s.execute(select(Session).where(Session.session_id == session_id))
        row = res.scalar_one_or_none()
        return _to_dict(row) if row else None


async def get_active_for_user(user_id: int) -> Optional[Dict[str, Any]]:
    async with session_scope() as s:
        res = await s.execute(
            select(Session)
            .where(
                Session.status == SessionStatus.ACTIVE.value,
                or_(Session.user_a_id == user_id, Session.user_b_id == user_id),
            )
            .order_by(Session.last_activity.desc())
            .limit(1)
        )
        row = res.scalar_one_or_none()
        return _to_dict(row) if row else None


async def accept(session_id: str) -> Optional[Dict[str, Any]]:
    async with session_scope() as s:
        res = await s.execute(select(Session).where(Session.session_id == session_id))
        row = res.scalar_one_or_none()
        if not row or row.status != SessionStatus.PENDING.value:
            return None
        row.status = SessionStatus.ACTIVE.value
        row.last_activity = datetime.utcnow()
        row.expire_at = datetime.utcnow() + timedelta(hours=24)
        await s.flush()
        return _to_dict(row)


async def reject(session_id: str) -> None:
    async with session_scope() as s:
        res = await s.execute(select(Session).where(Session.session_id == session_id))
        row = res.scalar_one_or_none()
        if row and row.status == SessionStatus.PENDING.value:
            row.status = SessionStatus.ENDED.value
            row.ended_at = datetime.utcnow()


async def bump_activity(session_id: str, *, media: bool = False) -> None:
    async with session_scope() as s:
        res = await s.execute(select(Session).where(Session.session_id == session_id))
        row = res.scalar_one_or_none()
        if not row:
            return
        row.message_count = int(row.message_count or 0) + 1
        if media:
            row.media_count = int(row.media_count or 0) + 1
        row.last_activity = datetime.utcnow()


async def mark_praise(session_id: str) -> None:
    async with session_scope() as s:
        res = await s.execute(select(Session).where(Session.session_id == session_id))
        row = res.scalar_one_or_none()
        if row:
            row.has_praise = True


async def mark_reported(session_id: str) -> None:
    async with session_scope() as s:
        res = await s.execute(select(Session).where(Session.session_id == session_id))
        row = res.scalar_one_or_none()
        if row:
            row.reported = True


async def end_session(session_id: str, settle: bool = True) -> Optional[Dict[str, Any]]:
    async with session_scope() as s:
        res = await s.execute(select(Session).where(Session.session_id == session_id))
        row = res.scalar_one_or_none()
        if not row or row.status == SessionStatus.ENDED.value:
            return None
        row.status = SessionStatus.ENDED.value
        row.ended_at = datetime.utcnow()
        data = _to_dict(row)

    if settle:
        created = data.get("created_at") or datetime.utcnow()
        ended = data.get("ended_at") or datetime.utcnow()
        duration = max(0.0, (ended - created).total_seconds() / 60.0)
        delta = credit_service.calc_session_delta(
            message_count=int(data.get("message_count") or 0),
            media_count=int(data.get("media_count") or 0),
            duration_minutes=duration,
            has_praise=bool(data.get("has_praise")),
            reported=bool(data.get("reported")),
        )
        for uid in (data["user_a_id"], data["user_b_id"]):
            await credit_service.settle_lanhua(
                uid,
                delta,
                action="session_end",
                reason=f"月影会话结算 ({data['session_id'][:8]})",
                related_id=data["session_id"],
            )
        data["settle_delta"] = delta
    return data


async def expire_old_sessions() -> int:
    now = datetime.utcnow()
    async with session_scope() as s:
        res = await s.execute(
            select(Session).where(
                Session.status.in_([SessionStatus.PENDING.value, SessionStatus.ACTIVE.value]),
                Session.expire_at.is_not(None),
                Session.expire_at < now,
            )
        )
        rows = list(res.scalars().all())
        ids = [r.session_id for r in rows]
        for r in rows:
            r.status = SessionStatus.ENDED.value
            r.ended_at = now
        await s.flush()

    for sid in ids:
        await end_session(sid, settle=True)
    return len(ids)


def peer_id(session: Dict[str, Any], user_id: int) -> int:
    if session["user_a_id"] == user_id:
        return session["user_b_id"]
    return session["user_a_id"]


def anon_name(session: Dict[str, Any], user_id: int) -> str:
    if session["user_a_id"] == user_id:
        return session.get("anonymous_a") or "月影人 A"
    return session.get("anonymous_b") or "月影人 B"
