"""兰花信用分：结算、等级、遮蔽、恢复。"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import or_, select

from bot.db import session_scope
from bot.models import CreditHistory, CreditTier, User, tier_from_score

DELTA_POST_APPROVED = 15
DELTA_REPORT_VALID_REPORTER = 10
DELTA_REPORT_VALID_TARGET = -30
DELTA_MALICIOUS_REPORT = -15
SESSION_DELTA_MAX = 28
SESSION_DELTA_MIN = -15
SHADOW_MIN_DAYS = 3
DAILY_RECOVERY_POINTS = 5
DEFAULT_SCORE = 320  # 新月中段；新用户不是暗月，也不自动遮蔽

TIER_RANGES = [
    {"tier": CreditTier.DARK.value, "min": 0, "max": 199, "label": "暗月"},
    {"tier": CreditTier.NEW.value, "min": 200, "max": 399, "label": "新月"},
    {"tier": CreditTier.SILVER.value, "min": 400, "max": 599, "label": "银月"},
    {"tier": CreditTier.GOLD.value, "min": 600, "max": 799, "label": "金月"},
    {"tier": CreditTier.FULL.value, "min": 800, "max": 1000, "label": "满月"},
]


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
        "role": getattr(u, "role", None),
        "guest_alias": getattr(u, "guest_alias", None),
        "is_banned": getattr(u, "is_banned", False),
        "created_at": u.created_at,
        "updated_at": u.updated_at,
        "last_recovery_at": u.last_recovery_at,
    }


def _apply_shadow_rules(user: User, reason: str, *, delta: int = 0) -> None:
    """只有扣分跌破 200 才入影；新号低分不等于惩罚。"""
    score = int(user.lanhua_score)
    if int(delta) < 0 and score < 200:
        user.is_shadowed = True
        user.shadow_days = max(int(user.shadow_days or 0), SHADOW_MIN_DAYS)
        if reason:
            user.shadow_reason = reason[:256]
    elif user.is_shadowed and int(user.shadow_days or 0) <= 0 and score >= 200:
        user.is_shadowed = False
        user.shadow_reason = None


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
            lanhua_score=DEFAULT_SCORE,
            tier=tier_from_score(DEFAULT_SCORE).value,
            is_shadowed=False,
            shadow_days=0,
        )
        s.add(user)
        await s.flush()
        return _user_to_dict(user)


async def set_user_role(user_id: int, role: str) -> Dict[str, Any]:
    from bot.models import UserRole

    allowed = {UserRole.TEACHER.value, UserRole.GUEST.value, UserRole.MERCHANT.value}
    if role not in allowed:
        raise ValueError("role 须为 teacher / guest / merchant")
    await ensure_user(user_id)
    async with session_scope() as s:
        res = await s.execute(select(User).where(User.user_id == user_id))
        user = res.scalar_one_or_none()
        if not user:
            raise RuntimeError("用户不存在")
        user.role = role
        user.updated_at = datetime.utcnow()
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
            user = User(
                user_id=user_id,
                lanhua_score=DEFAULT_SCORE,
                tier=tier_from_score(DEFAULT_SCORE).value,
                is_shadowed=False,
                shadow_days=0,
            )
            s.add(user)
            await s.flush()

        old_score = int(user.lanhua_score)
        new_score = max(0, min(1000, old_score + int(delta)))
        tier = tier_from_score(new_score)

        user.lanhua_score = new_score
        user.tier = tier.value
        user.updated_at = datetime.utcnow()
        if delta > 0:
            user.total_earned = int(user.total_earned or 0) + delta
        elif delta < 0:
            user.total_deducted = int(user.total_deducted or 0) + (-delta)

        _apply_shadow_rules(user, reason, delta=int(delta))

        s.add(
            CreditHistory(
                user_id=user_id,
                action=action,
                delta=int(delta),
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
    """每日遮蔽倒计时 + 低分缓慢恢复。不会因低分把正常新用户拉进遮蔽。"""
    async with session_scope() as s:
        res = await s.execute(
            select(User).where(
                or_(User.is_shadowed.is_(True), User.lanhua_score < 200)
            )
        )
        users = list(res.scalars().all())
        count = 0
        for u in users:
            if u.is_shadowed:
                days = max(0, int(u.shadow_days or 0) - 1)
                u.shadow_days = days
            if int(u.lanhua_score) < 200:
                u.lanhua_score = min(200, int(u.lanhua_score) + DAILY_RECOVERY_POINTS)
                u.tier = tier_from_score(u.lanhua_score).value
                u.total_earned = int(u.total_earned or 0) + DAILY_RECOVERY_POINTS
                s.add(
                    CreditHistory(
                        user_id=u.user_id,
                        action="daily_recovery",
                        delta=DAILY_RECOVERY_POINTS,
                        reason="日恢复（低分缓慢回升）",
                        related_id=None,
                    )
                )
            if u.is_shadowed and int(u.lanhua_score) >= 200 and int(u.shadow_days or 0) <= 0:
                u.is_shadowed = False
                u.shadow_reason = None
            u.last_recovery_at = datetime.utcnow()
            u.updated_at = datetime.utcnow()
            count += 1
        await s.flush()
        return count


def format_credit_card(user: Dict[str, Any]) -> str:
    score = user.get("lanhua_score", DEFAULT_SCORE)
    tier = user.get("tier", "新月")
    shadowed = user.get("is_shadowed")
    lines = [
        f"🌸 <b>兰花令 · {tier}</b>",
        f"信用分：<code>{score}</code> / 1000",
        f"累计获得：{user.get('total_earned', 0)}  ·  累计扣除：{user.get('total_deducted', 0)}",
    ]
    if shadowed:
        lines.append(f"🌑 月影遮蔽中 · 剩余 {user.get('shadow_days', 0)} 天")
        if user.get("shadow_reason"):
            lines.append(f"原因：{user['shadow_reason']}")
    return "\n".join(lines)


def compute_heuristic_q(
    message_count: int,
    media_count: int,
    duration_minutes: float = 0.0,
    reply_balance: float | None = None,
) -> int:
    i = max(0, int(message_count or 0))
    m = max(0, int(media_count or 0))
    d = max(0.0, float(duration_minutes or 0.0))
    bal = 0.5 if reply_balance is None else max(0.0, min(1.0, float(reply_balance)))
    base = min(70, 2 * i + 5 * m)
    dur_bonus = min(15.0, d / 8.0)
    bal_bonus = min(15.0, 15.0 * bal)
    q = int(round(base + dur_bonus + bal_bonus))
    return max(0, min(100, q))


def calc_session_delta(
    message_count: int,
    media_count: int,
    duration_minutes: float,
    has_praise: bool,
    reported: bool,
    brush_factor: float = 0.0,
    reply_balance: float | None = None,
    quality_score: int | None = None,
) -> int:
    i = min(int(message_count or 0), 80)
    d = min(float(duration_minutes or 0), 120.0)
    if quality_score is not None:
        q = max(0, min(100, int(quality_score)))
    else:
        q = compute_heuristic_q(
            message_count=i,
            media_count=int(media_count or 0),
            duration_minutes=d,
            reply_balance=reply_balance,
        )
    bonus = 12 if has_praise else 0
    penalty = 40 if reported else 0
    f = max(0.0, min(0.9, float(brush_factor or 0.0)))
    raw = (8 + 0.18 * i + 0.12 * d + 0.25 * q + bonus) * (1 - f) - penalty
    clamped = int(round(raw))
    return max(SESSION_DELTA_MIN, min(SESSION_DELTA_MAX, clamped))
