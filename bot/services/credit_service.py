"""兰花信用分：结算、等级、遮蔽、恢复。"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import select, update

from bot.db import session_scope
from bot.models import CreditHistory, CreditTier, User, tier_from_score


def _user_to_dict(u: User) -> Dict[str, Any]:
    return {
        "user_id": u.user_id,
        "username": u.username,
        "full_name": u.full_name,
        "lanhua_score": u.lanhua_score,
        "tier": u.tier,
        "shadow_days": u.shadow_days,
        "shadow_reason": u.shadow_reason,
        "recovery_progress": u.recovery_progress,
        "total_earned": u.total_earned,
        "total_deducted": u.total_deducted,
        "is_shadowed": u.is_shadowed,
        "created_at": u.created_at,
        "updated_at": u.updated_at,
        "last_recovery_at": u.last_recovery_at,
    }


async def ensure_user(
    user_id: int,
    username: str | None = None,
    full_name: str | None = None,
) -> Dict[str, Any]:
    async with session_scope() as s:
        res = await s.execute(select(User).where(User.user_id == user_id))
        user = res.scalar_one_or_none()
        if user:
            if username is not None:
                user.username = username
            if full_name is not None:
                user.full_name = full_name
            user.updated_at = datetime.utcnow()
            await s.flush()
            return _user_to_dict(user)

        user = User(
            user_id=user_id,
            username=username,
            full_name=full_name,
            lanhua_score=100,
            tier=CreditTier.NEW.value,
        )
        s.add(user)
        await s.flush()
        return _user_to_dict(user)


async def get_user(user_id: int) -> Optional[Dict[str, Any]]:
    async with session_scope() as s:
        res = await s.execute(select(User).where(User.user_id == user_id))
        user = res.scalar_one_or_none()
        return _user_to_dict(user) if user else None


async def settle_lanhua(
    user_id: int,
    delta: int,
    action: str,
    reason: str,
    related_id: str | None = None,
) -> Dict[str, Any]:
    async with session_scope() as s:
        res = await s.execute(select(User).where(User.user_id == user_id))
        user = res.scalar_one_or_none()
        if not user:
            user = User(user_id=user_id, lanhua_score=100, tier=CreditTier.NEW.value)
            s.add(user)
            await s.flush()

        old_score = int(user.lanhua_score)
        new_score = max(0, min(1000, old_score + delta))
        tier = tier_from_score(new_score)

        user.lanhua_score = new_score
        user.tier = tier.value
        user.updated_at = datetime.utcnow()
        if delta > 0:
            user.total_earned = int(user.total_earned or 0) + delta
        elif delta < 0:
            user.total_deducted = int(user.total_deducted or 0) + (-delta)

        if new_score < 200 and not user.is_shadowed:
            user.is_shadowed = True
            user.shadow_days = max(int(user.shadow_days or 0), 3)
            user.shadow_reason = reason
        if new_score >= 200 and user.is_shadowed and int(user.shadow_days or 0) <= 0:
            user.is_shadowed = False
            user.shadow_reason = None

        s.add(
            CreditHistory(
                user_id=user_id,
                action=action,
                delta=delta,
                reason=reason,
                related_id=related_id,
            )
        )
        await s.flush()
        return _user_to_dict(user)


async def history(user_id: int, limit: int = 20) -> List[Dict[str, Any]]:
    async with session_scope() as s:
        res = await s.execute(
            select(CreditHistory)
            .where(CreditHistory.user_id == user_id)
            .order_by(CreditHistory.time.desc())
            .limit(limit)
        )
        rows = res.scalars().all()
        return [
            {
                "user_id": r.user_id,
                "time": r.time,
                "action": r.action,
                "delta": r.delta,
                "reason": r.reason,
                "related_id": r.related_id,
            }
            for r in rows
        ]


async def tick_shadow_daily() -> int:
    """每日遮蔽倒计时 + 低分缓慢恢复。"""
    async with session_scope() as s:
        res = await s.execute(select(User).where(User.is_shadowed.is_(True)))
        users = list(res.scalars().all())
        count = 0
        for u in users:
            days = max(0, int(u.shadow_days or 0) - 1)
            u.shadow_days = days
            if days <= 0 and u.lanhua_score >= 200:
                u.is_shadowed = False
                u.shadow_reason = None
            elif u.lanhua_score < 200:
                u.lanhua_score = min(200, int(u.lanhua_score) + 5)
                u.tier = tier_from_score(u.lanhua_score).value
            u.last_recovery_at = datetime.utcnow()
            u.updated_at = datetime.utcnow()
            count += 1
        await s.flush()
        return count


def format_credit_card(user: Dict[str, Any]) -> str:
    score = user.get("lanhua_score", 100)
    tier = user.get("tier", "新月")
    shadowed = user.get("is_shadowed")
    lines = [
        f"🌸 **兰花令 · {tier}**",
        f"信用分：`{score}` / 1000",
        f"累计获得：{user.get('total_earned', 0)}  ·  累计扣除：{user.get('total_deducted', 0)}",
    ]
    if shadowed:
        lines.append(f"🌑 月影遮蔽中 · 剩余 {user.get('shadow_days', 0)} 天")
        if user.get("shadow_reason"):
            lines.append(f"原因：{user['shadow_reason']}")
    return "\n".join(lines)


def calc_session_delta(
    message_count: int,
    media_count: int,
    duration_minutes: float,
    has_praise: bool,
    reported: bool,
    brush_factor: float = 0.0,
) -> int:
    """
    Δ = (8 + 0.18I + 0.12D + 0.25Q + Bonus) × (1 - F) - Penalty
    """
    i = min(message_count, 80)
    d = min(duration_minutes, 120)
    q = min(100, message_count * 2 + media_count * 5)
    bonus = 12 if has_praise else 0
    penalty = 40 if reported else 0
    f = max(0.0, min(0.9, brush_factor))
    raw = (8 + 0.18 * i + 0.12 * d + 0.25 * q + bonus) * (1 - f) - penalty
    return int(round(raw))
