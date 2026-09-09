"""匿名月影会话：创建、中转、结束、结算。"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Tuple

from bot.db import get_db
from bot.models import SessionStatus
from bot.services import anti_brush, credit_service

SESSION_HOURS = 24


async def create_pending_session(
    lamp_id: str,
    user_a_id: int,
    user_b_id: int,
) -> Dict[str, Any]:
    db = get_db()
    session_id = str(uuid.uuid4())
    doc = {
        "session_id": session_id,
        "lamp_id": lamp_id,
        "user_a_id": user_a_id,
        "user_b_id": user_b_id,
        "anonymous_a": "月影人 A",
        "anonymous_b": "月影人 B",
        "status": SessionStatus.PENDING.value,
        "message_count": 0,
        "media_count": 0,
        "has_praise": False,
        "reported": False,
        "created_at": datetime.utcnow(),
        "expire_at": datetime.utcnow() + timedelta(hours=SESSION_HOURS),
        "last_activity": datetime.utcnow(),
        "ended_at": None,
        "ai_quality_score": 50,
        "a_messages": 0,
        "b_messages": 0,
    }
    await db.sessions.insert_one(doc)
    anti_brush.record_session(user_a_id)
    return doc


async def activate_session(session_id: str) -> Optional[Dict[str, Any]]:
    db = get_db()
    await db.sessions.update_one(
        {"session_id": session_id, "status": SessionStatus.PENDING.value},
        {
            "$set": {
                "status": SessionStatus.ACTIVE.value,
                "last_activity": datetime.utcnow(),
                "expire_at": datetime.utcnow() + timedelta(hours=SESSION_HOURS),
            }
        },
    )
    return await db.sessions.find_one({"session_id": session_id})


async def reject_session(session_id: str) -> None:
    db = get_db()
    await db.sessions.update_one(
        {"session_id": session_id},
        {"$set": {"status": SessionStatus.ENDED.value, "ended_at": datetime.utcnow()}},
    )


async def get_active_session_for_user(user_id: int) -> Optional[Dict[str, Any]]:
    db = get_db()
    return await db.sessions.find_one(
        {
            "status": SessionStatus.ACTIVE.value,
            "$or": [{"user_a_id": user_id}, {"user_b_id": user_id}],
        }
    )


async def get_session(session_id: str) -> Optional[Dict[str, Any]]:
    return await get_db().sessions.find_one({"session_id": session_id})


async def record_message(session_id: str, from_user_id: int, is_media: bool = False) -> None:
    db = get_db()
    session = await get_session(session_id)
    if not session:
        return
    inc: Dict[str, int] = {"message_count": 1}
    if is_media:
        inc["media_count"] = 1
    if from_user_id == session["user_a_id"]:
        inc["a_messages"] = 1
    else:
        inc["b_messages"] = 1
    await db.sessions.update_one(
        {"session_id": session_id},
        {"$inc": inc, "$set": {"last_activity": datetime.utcnow()}},
    )


async def mark_praise(session_id: str) -> None:
    await get_db().sessions.update_one(
        {"session_id": session_id},
        {"$set": {"has_praise": True}},
    )


async def mark_reported(session_id: str) -> None:
    await get_db().sessions.update_one(
        {"session_id": session_id},
        {"$set": {"reported": True}},
    )


async def end_session(session_id: str, early_end: bool = False) -> Tuple[int, int]:
    db = get_db()
    session = await get_session(session_id)
    if not session or session.get("status") == SessionStatus.ENDED.value:
        return 0, 0

    now = datetime.utcnow()
    created = session.get("created_at") or now
    if isinstance(created, str):
        created = datetime.fromisoformat(created.replace("Z", ""))
    duration = max(0.0, (now - created).total_seconds() / 60.0)

    a_msg = int(session.get("a_messages") or 0)
    b_msg = int(session.get("b_messages") or 0)
    total = max(1, a_msg + b_msg)
    reply_rate = min(a_msg, b_msg) / max(a_msg, b_msg, 1)

    ai_q = int(session.get("ai_quality_score") or 50)
    ai_q = min(100, ai_q + min(30, total // 2))

    brush_a = anti_brush.brush_factor_for_session(session["user_a_id"], duration, total, 400)
    brush_b = anti_brush.brush_factor_for_session(session["user_b_id"], duration, total, 400)

    delta = credit_service.calc_moon_session_delta(
        message_count=total,
        reply_rate=reply_rate,
        duration_minutes=duration,
        ai_quality=ai_q,
        has_praise=bool(session.get("has_praise")),
        media_count=int(session.get("media_count") or 0),
        reported=bool(session.get("reported")),
        early_end=early_end and total < 6,
        brush_factor=max(brush_a, brush_b),
    )

    await db.sessions.update_one(
        {"session_id": session_id},
        {
            "$set": {
                "status": SessionStatus.ENDED.value,
                "ended_at": now,
                "ai_quality_score": ai_q,
            }
        },
    )

    await credit_service.settle_lanhua(
        session["user_a_id"], delta, "moon_chat", "月影会话结算", session_id
    )
    await credit_service.settle_lanhua(
        session["user_b_id"], delta, "moon_chat", "月影会话结算", session_id
    )
    return delta, delta


async def expire_old_sessions() -> int:
    db = get_db()
    now = datetime.utcnow()
    cursor = db.sessions.find(
        {
            "status": {"$in": [SessionStatus.ACTIVE.value, SessionStatus.PENDING.value]},
            "expire_at": {"$lte": now},
        }
    )
    count = 0
    async for s in cursor:
        await end_session(s["session_id"], early_end=False)
        count += 1
    return count


def peer_and_prefix(session: Dict[str, Any], from_user_id: int) -> Tuple[int, str]:
    if from_user_id == session["user_a_id"]:
        return session["user_b_id"], session.get("anonymous_a", "月影人 A")
    return session["user_a_id"], session.get("anonymous_b", "月影人 B")
