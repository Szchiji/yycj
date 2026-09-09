"""管理侧只读列表与运维查询（API / Bot 共用）。"""

from __future__ import annotations

from typing import Any, Dict, List

from sqlalchemy import select

from bot.db import session_scope
from bot.models import Post, PostStatus, Report, ReportStatus, User
from bot.services.credit_service import _user_to_dict


async def list_pending_posts(limit: int = 50) -> List[Dict[str, Any]]:
    async with session_scope() as s:
        res = await s.execute(
            select(Post)
            .where(Post.status == PostStatus.PENDING.value)
            .order_by(Post.created_at.asc())
            .limit(max(1, min(limit, 200)))
        )
        rows = res.scalars().all()
        return [
            {
                "post_id": p.post_id,
                "user_id": p.user_id,
                "lamp_data": dict(p.lamp_data or {}),
                "status": p.status,
                "created_at": p.created_at,
            }
            for p in rows
        ]


async def list_pending_reports(limit: int = 50) -> List[Dict[str, Any]]:
    async with session_scope() as s:
        res = await s.execute(
            select(Report)
            .where(Report.status == ReportStatus.PENDING.value)
            .order_by(Report.created_at.asc())
            .limit(max(1, min(limit, 200)))
        )
        rows = res.scalars().all()
        return [
            {
                "report_id": r.report_id,
                "lamp_id": r.lamp_id,
                "reporter_id": r.reporter_id,
                "reason": r.reason,
                "description": r.description or "",
                "status": r.status,
                "created_at": r.created_at,
            }
            for r in rows
        ]


async def list_shadowed_users(limit: int = 100) -> List[Dict[str, Any]]:
    async with session_scope() as s:
        res = await s.execute(
            select(User)
            .where(User.is_shadowed.is_(True))
            .order_by(User.shadow_days.desc(), User.lanhua_score.asc())
            .limit(max(1, min(limit, 500)))
        )
        return [_user_to_dict(u) for u in res.scalars().all()]
