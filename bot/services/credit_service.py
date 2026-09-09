"""兰花信用分：结算、等级、遮蔽、恢复（对齐蓝图档位与会话钳制）。"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import or_, select

from bot.db import session_scope
from bot.models import CreditHistory, CreditTier, User, tier_from_score

# ---------- 蓝图高影响 Δ（与 Bot 审核回调、API 共用）----------
DELTA_POST_APPROVED = 15
DELTA_REPORT_VALID_REPORTER = 10
DELTA_REPORT_VALID_TARGET = -30
DELTA_MALICIOUS_REPORT = -15  # 驳回恶意/无效报告时扣举报人
SESSION_DELTA_MAX = 28
SESSION_DELTA_MIN = -15
SHADOW_MIN_DAYS = 3
DAILY_RECOVERY_POINTS = 5

# 档位说明（0–199 / 200–399 / 400–599 / 600–799 / 800+）
TIER_RANGES = [
    {"tier": CreditTier.DARK.value, "min": 0, "max": 199, "label": "暗月 · 月影遮蔽"},
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
        "created_at": u.created_at,
        "updated_at": u.updated_at,
        "last_recovery_at": u.last_recovery_at,
    }


def _apply_shadow_rules(user: User, reason: str) -> None:
    """分数 <200 → 进入/保持遮蔽并保证天数；≥200 且天数耗尽 → 解除。"""
    score = int(user.lanhua_score)
    if score < 200:
        user.is_shadowed = True
        user.shadow_days = max(int(user.shadow_days or 0), SHADOW_MIN_DAYS)
        if reason:
            user.shadow_reason = reason[:256]
    elif user.is_shadowed and int(user.shadow_days or 0) <= 0:
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

        # 起步 100（暗月档）；未发生负向结算前不强制遮蔽，便于新用户试用
        user = User(
            user_id=user_id,
            username=username,
            full_name=full_name,
            lanhua_score=100,
            tier=tier_from_score(100).value,
            is_shadowed=False,
            shadow_days=0,
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
            user = User(
                user_id=user_id,
                lanhua_score=100,
                tier=tier_from_score(100).value,
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

        _apply_shadow_rules(user, reason)

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
    """每日遮蔽倒计时 + 低分缓慢恢复（面向 is_shadowed 或分数 <200）。"""
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
            if int(u.lanhua_score) >= 200 and int(u.shadow_days or 0) <= 0:
                u.is_shadowed = False
                u.shadow_reason = None
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
        f"🌸 <b>兰花令 · {tier}</b>",
        f"信用分：<code>{score}</code> / 1000",
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
    会话结算（无 LLM 时的启发式）：

        Δ = (8 + 0.18·I + 0.12·D + 0.25·Q + Bonus) × (1 - F) - Penalty

    - I：消息条数（封顶 80）
    - D：时长分钟（封顶 120）
    - Q：启发式质量分（无 LLM）。Q = min(100, 2·msg + 5·media)
      有真实 LLM 质量分时可改为传入 quality_score 替换启发式。
    - Bonus：好评 +12；Penalty：被举报 40；F：刷量因子 [0,0.9]
    - 最终钳制到 [{SESSION_DELTA_MIN}, {SESSION_DELTA_MAX}] ≈ [-15, +28]
    """.format(SESSION_DELTA_MIN=SESSION_DELTA_MIN, SESSION_DELTA_MAX=SESSION_DELTA_MAX)
    i = min(int(message_count or 0), 80)
    d = min(float(duration_minutes or 0), 120.0)
    # 启发式 Q（无 LLM）
    q = min(100, i * 2 + int(media_count or 0) * 5)
    bonus = 12 if has_praise else 0
    penalty = 40 if reported else 0
    f = max(0.0, min(0.9, float(brush_factor or 0.0)))
    raw = (8 + 0.18 * i + 0.12 * d + 0.25 * q + bonus) * (1 - f) - penalty
    clamped = int(round(raw))
    return max(SESSION_DELTA_MIN, min(SESSION_DELTA_MAX, clamped))
