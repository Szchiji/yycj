"""用户代称、拉黑与搜索（挂到 credit_service）。"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List

from sqlalchemy import or_, select

from bot.db import session_scope
from bot.models import User
from bot.services import credit_service
from bot.services.credit_service import _user_to_dict, ensure_user


async def set_guest_alias(user_id: int, alias: str) -> Dict[str, Any]:
    alias = (alias or "").strip()[:16]
    await ensure_user(user_id)
    async with session_scope() as s:
        res = await s.execute(select(User).where(User.user_id == user_id))
        user = res.scalar_one_or_none()
        if not user:
            raise RuntimeError("用户不存在")
        user.guest_alias = alias or None
        user.updated_at = datetime.utcnow()
        await s.flush()
        return _user_to_dict(user)


async def set_banned(user_id: int, banned: bool, reason: str = "") -> Dict[str, Any]:
    await ensure_user(user_id)
    async with session_scope() as s:
        res = await s.execute(select(User).where(User.user_id == user_id))
        user = res.scalar_one_or_none()
        if not user:
            raise RuntimeError("用户不存在")
        user.is_banned = bool(banned)
        user.ban_reason = (reason or "")[:256] if banned else None
        user.updated_at = datetime.utcnow()
        await s.flush()
        return _user_to_dict(user)


async def search_users(q: str = "", limit: int = 50) -> List[Dict[str, Any]]:
    q = (q or "").strip().lstrip("@")
    async with session_scope() as s:
        stmt = select(User).order_by(User.updated_at.desc()).limit(max(1, min(limit, 200)))
        if q:
            if q.isdigit() or (q.startswith("-") and q[1:].isdigit()):
                stmt = select(User).where(User.user_id == int(q)).limit(20)
            else:
                like = f"%{q}%"
                stmt = (
                    select(User)
                    .where(or_(User.username.ilike(like), User.full_name.ilike(like)))
                    .order_by(User.updated_at.desc())
                    .limit(max(1, min(limit, 200)))
                )
        res = await s.execute(stmt)
        return [_user_to_dict(x) for x in res.scalars().all()]


credit_service.set_guest_alias = set_guest_alias  # type: ignore[attr-defined]
credit_service.set_banned = set_banned  # type: ignore[attr-defined]
credit_service.search_users = search_users  # type: ignore[attr-defined]
