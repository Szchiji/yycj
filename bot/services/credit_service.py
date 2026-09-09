"""兰花信用分：结算、等级、遮蔽、恢复。"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from bot.db import get_db
from bot.models import CreditTier, tier_from_score


async def ensure_user(
    user_id: int,
    username: str | None = None,
    full_name: str | None = None,
) -> Dict[str, Any]:
    db = get_db()
    user = await db.users.find_one({"user_id": user_id})
    if user:
        updates: Dict[str, Any] = {"updated_at": datetime.utcnow()}
        if username is not None:
            updates["username"] = username
        if full_name is not None:
            updates["full_name"] = full_name
        await db.users.update_one({"user_id": user_id}, {"$set": updates})
        user.update(updates)
        return user

    doc = {
        "user_id": user_id,
        "username": username,
        "full_name": full_name,
        "lanhua_score": 100,
        "tier": CreditTier.NEW.value,
        "shadow_days": 0,
        "shadow_reason": None,
        "recovery_progress": 0.0,
        "total_earned": 0,
        "total_deducted": 0,
        "is_shadowed": False,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "last_recovery_at": None,
    }
    await db.users.insert_one(doc)
    return doc


async def get_user(user_id: int) -> Optional[Dict[str, Any]]:
    return await get_db().users.find_one({"user_id": user_id})


async def settle_lanhua(
    user_id: int,
    delta: int,
    action: str,
    reason: str,
    related_id: str | None = None,
) -> Dict[str, Any]:
    db = get_db()
    user = await ensure_user(user_id)
    old_score = int(user.get("lanhua_score", 100))
    new_score = max(0, min(1000, old_score + delta))
    tier = tier_from_score(new_score)

    inc: Dict[str, int] = {}
    if delta > 0:
        inc["total_earned"] = delta
    elif delta < 0:
        inc["total_deducted"] = -delta

    set_fields: Dict[str, Any] = {
        "lanhua_score": new_score,
        "tier": tier.value,
        "updated_at": datetime.utcnow(),
    }

    if new_score < 200 and not user.get("is_shadowed"):
        set_fields["is_shadowed"] = True
        set_fields["shadow_days"] = max(int(user.get("shadow_days") or 0), 3)
        set_fields["shadow_reason"] = set_fields.get("shadow_reason") or reason
    if new_score >= 200 and user.get("is_shadowed") and int(user.get("shadow_days") or 0) <= 0:
        set_fields["is_shadowed"] = False
        set_fields["shadow_reason"] = None

    update: Dict[str, Any] = {"$set": set_fields}
    if inc:
        update["$inc"] = inc

    await db.users.update_one({"user_id": user_id}, update)
    await db.credit_history.insert_one(
        {
            "user_id": user_id,
            "time": datetime.utcnow(),
            "action": action,
            "delta": delta,
            "reason": reason,
            "related_id": related_id,
        }
    )
    return await get_user(user_id) or {}


async def apply_shadow(user_id: int, days: int, reason: str) -> Dict[str, Any]:
    db = get_db()
    await ensure_user(user_id)
    await db.users.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "is_shadowed": True,
                "shadow_days": days,
                "shadow_reason": reason,
                "updated_at": datetime.utcnow(),
            }
        },
    )
    return await get_user(user_id) or {}


async def tick_shadow_daily() -> int:
    db = get_db()
    updated = 0
    cursor = db.users.find({"is_shadowed": True, "shadow_days": {"$gt": 0}})
    async for user in cursor:
        days = int(user.get("shadow_days") or 0) - 1
        score = int(user.get("lanhua_score") or 0)
        recover = 8 if days > 0 else 15
        new_score = min(1000, score + recover)
        tier = tier_from_score(new_score)
        fields: Dict[str, Any] = {
            "shadow_days": max(0, days),
            "lanhua_score": new_score,
            "tier": tier.value,
            "updated_at": datetime.utcnow(),
            "last_recovery_at": datetime.utcnow(),
        }
        if days <= 0 and new_score >= 200:
            fields["is_shadowed"] = False
            fields["shadow_reason"] = None
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": fields})
        await db.credit_history.insert_one(
            {
                "user_id": user["user_id"],
                "time": datetime.utcnow(),
                "action": "daily_recovery",
                "delta": recover,
                "reason": "新月重生（日恢复）",
                "related_id": None,
            }
        )
        updated += 1

    cursor2 = db.users.find({"$or": [{"is_shadowed": False}, {"is_shadowed": {"$exists": False}}]})
    async for user in cursor2:
        score = int(user.get("lanhua_score") or 0)
        if score >= 1000:
            continue
        recover = 15 + (score // 100) * 2
        recover = min(recover, 1000 - score)
        if recover <= 0:
            continue
        new_score = score + recover
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {
                "$set": {
                    "lanhua_score": new_score,
                    "tier": tier_from_score(new_score).value,
                    "last_recovery_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                },
                "$inc": {"total_earned": recover},
            },
        )
        await db.credit_history.insert_one(
            {
                "user_id": user["user_id"],
                "time": datetime.utcnow(),
                "action": "daily_recovery",
                "delta": recover,
                "reason": "新月重生（日恢复）",
                "related_id": None,
            }
        )
        updated += 1
    return updated


def calc_moon_session_delta(
    message_count: int,
    reply_rate: float,
    duration_minutes: float,
    ai_quality: int,
    has_praise: bool = False,
    media_count: int = 0,
    reported: bool = False,
    early_end: bool = False,
    brush_factor: float = 0.0,
) -> int:
    """
    Δ = (8 + 0.18*I + 0.12*D + 0.25*Q + Bonus) * (1 - F) - Penalty
    限制在 [-15, 28]
    """
    M = min(message_count, 60)
    R = max(0.0, min(1.0, reply_rate))
    I = M + 1.5 * R
    D = min(duration_minutes / 60.0, 8.0) * 10.0
    Q = max(0, min(100, ai_quality))

    bonus = 0.0
    if has_praise:
        bonus += 15
    if media_count >= 3:
        bonus += 8

    penalty = 0.0
    if reported:
        penalty += 35
    if early_end:
        penalty += 10

    F = max(0.0, min(0.8, brush_factor))
    raw = (8 + 0.18 * I + 0.12 * D + 0.25 * Q + bonus) * (1 - F) - penalty
    return int(max(-15, min(28, round(raw))))


async def get_history(user_id: int, limit: int = 20) -> List[Dict[str, Any]]:
    db = get_db()
    cursor = db.credit_history.find({"user_id": user_id}).sort("time", -1).limit(limit)
    return [doc async for doc in cursor]


async def is_shadowed(user_id: int) -> Tuple[bool, int, str]:
    user = await ensure_user(user_id)
    days = int(user.get("shadow_days") or 0)
    shadowed = bool(user.get("is_shadowed")) and days > 0
    reason = user.get("shadow_reason") or ""
    return shadowed, days, reason
