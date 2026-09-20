"""角色一周锁定。"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, Dict

from sqlalchemy import text

from bot.config import get_settings
from bot.db import session_scope
from bot.services import credit_service

logger = logging.getLogger(__name__)
LOCK_DAYS = 7


async def _ensure_col() -> None:
    try:
        async with session_scope() as s:
            await s.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS role_set_at TIMESTAMP"))
    except Exception:
        logger.exception("ensure role_set_at failed")


async def set_user_role(user_id: int, role: str) -> Dict[str, Any]:
    await _ensure_col()
    role = (role or "").strip().lower()
    from bot.models import UserRole
    allowed = {UserRole.TEACHER.value, UserRole.GUEST.value, UserRole.MERCHANT.value}
    if role not in allowed:
        raise ValueError("请选择客人 / 老师 / 商家")
    await credit_service.ensure_user(user_id)
    admin = get_settings().is_admin(user_id)
    async with session_scope() as s:
        res = await s.execute(
            text("SELECT role, role_set_at FROM users WHERE user_id = :u"),
            {"u": user_id},
        )
        row = res.first()
        current = (row[0] if row else None) or ""
        stamped = row[1] if row else None
        if (not admin) and current and current != role and stamped:
            unlock = stamped + timedelta(days=LOCK_DAYS)
            left = unlock - datetime.utcnow()
            if left.total_seconds() > 0:
                days = max(1, int((left.total_seconds() + 86399) // 86400))
                raise ValueError(f"角色一周内只能换一次，还剩 {days} 天")
        await s.execute(
            text("UPDATE users SET role = :r, role_set_at = :t, updated_at = :t WHERE user_id = :u"),
            {"r": role, "t": datetime.utcnow(), "u": user_id},
        )
    user = await credit_service.get_user(user_id) or await credit_service.ensure_user(user_id)
    user["role"] = role
    user["role_set_at"] = datetime.utcnow()
    return user


credit_service.set_user_role = set_user_role
