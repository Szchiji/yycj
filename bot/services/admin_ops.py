"""管理侧列表、审核动作与运维查询（API / Bot 共用同一业务逻辑）。"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import select

from bot.db import session_scope
from bot.models import Post, PostStatus, Report, ReportStatus, User
from bot.services import credit_service, search_service
from bot.services.credit_service import _user_to_dict

logger = logging.getLogger(__name__)


async def notify_user_best_effort(user_id: int, text: str) -> bool:
    """
    尽力通过 Bot 私聊通知用户。
    HTTP 请求上下文可能无 Bot 注入；失败不抛出，避免阻断审核 API。
    """
    try:
        from bot.main import bot

        await bot.send_message(user_id, text)
        return True
    except Exception:
        logger.exception("best-effort notify failed for user_id=%s", user_id)
        return False


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


class AdminActionError(Exception):
    """业务层审核错误（已处理 / 不存在等）。"""

    def __init__(self, message: str, *, code: str = "conflict"):
        super().__init__(message)
        self.code = code


async def approve_post(post_id: str, *, notify: bool = True) -> Dict[str, Any]:
    """通过投稿 → 上架灯笼 + 投稿人 +15。与 Bot admin_post_ok 一致。"""
    async with session_scope() as s:
        res = await s.execute(select(Post).where(Post.post_id == post_id))
        post = res.scalar_one_or_none()
        if not post:
            raise AdminActionError("投稿不存在", code="not_found")
        if post.status != PostStatus.PENDING.value:
            raise AdminActionError("已处理或不在待审状态", code="conflict")
        data = dict(post.lamp_data or {})
        post.status = PostStatus.APPROVED.value
        post.reviewed_at = datetime.utcnow()
        user_id = post.user_id

    lamp = await search_service.create_lamp_from_post(
        user_id=user_id,
        city=data.get("city") or "未知",
        title=data.get("title") or "未命名",
        tags=list(data.get("tags") or []),
        price=data.get("price"),
        price_text=data.get("price_text"),
        description=data.get("description") or "",
        photos=list(data.get("photos") or []),
        authenticity_score=80,
    )
    await search_service.approve_lamp(lamp["lamp_id"])
    await credit_service.settle_lanhua(
        user_id,
        credit_service.DELTA_POST_APPROVED,
        "post_approved",
        "灯笼审核通过",
        post_id,
    )
    if notify:
        await notify_user_best_effort(
            user_id,
            f"你的灯笼 <b>{lamp['title']}</b> 已通过审核并上架。",
        )
    return {
        "ok": True,
        "post_id": post_id,
        "status": PostStatus.APPROVED.value,
        "lamp_id": lamp["lamp_id"],
        "user_id": user_id,
    }


async def reject_post(post_id: str, *, notify: bool = True) -> Dict[str, Any]:
    """拒绝投稿。与 Bot admin_post_no 一致。"""
    async with session_scope() as s:
        res = await s.execute(select(Post).where(Post.post_id == post_id))
        post = res.scalar_one_or_none()
        if not post:
            raise AdminActionError("投稿不存在", code="not_found")
        if post.status != PostStatus.PENDING.value:
            raise AdminActionError("已处理或不在待审状态", code="conflict")
        post.status = PostStatus.REJECTED.value
        post.reviewed_at = datetime.utcnow()
        user_id = post.user_id

    if notify:
        await notify_user_best_effort(user_id, "你的灯笼投稿未通过审核。")
    return {
        "ok": True,
        "post_id": post_id,
        "status": PostStatus.REJECTED.value,
        "user_id": user_id,
    }


async def accept_report(report_id: str, *, notify: bool = True) -> Dict[str, Any]:
    """采纳报告 → 下架灯笼、目标 -30、举报人 +10。与 Bot admin_report_ok 一致。"""
    async with session_scope() as s:
        res = await s.execute(select(Report).where(Report.report_id == report_id))
        rep = res.scalar_one_or_none()
        if not rep:
            raise AdminActionError("报告不存在", code="not_found")
        if rep.status != ReportStatus.PENDING.value:
            raise AdminActionError("已处理或不在待审状态", code="conflict")
        rep.status = ReportStatus.ACCEPTED.value
        rep.reviewed_at = datetime.utcnow()
        lamp_id = rep.lamp_id
        reporter_id = rep.reporter_id

    target_id: Optional[int] = None
    lamp = await search_service.get_lamp(lamp_id)
    if lamp:
        target_id = int(lamp["user_id"])
        await search_service.reject_lamp(lamp_id)
        await credit_service.settle_lanhua(
            target_id,
            credit_service.DELTA_REPORT_VALID_TARGET,
            "report_accepted",
            "报告成立，灯笼下架",
            report_id,
        )
    await credit_service.settle_lanhua(
        reporter_id,
        credit_service.DELTA_REPORT_VALID_REPORTER,
        "report_reward",
        "有效报告奖励",
        report_id,
    )
    if notify:
        await notify_user_best_effort(
            reporter_id,
            f"你的月影报告已采纳，兰花分变动：{credit_service.DELTA_REPORT_VALID_REPORTER:+d}",
        )
        if target_id is not None:
            await notify_user_best_effort(
                target_id,
                f"有报告成立，相关灯笼已下架；兰花分变动：{credit_service.DELTA_REPORT_VALID_TARGET:+d}",
            )
    return {
        "ok": True,
        "report_id": report_id,
        "status": ReportStatus.ACCEPTED.value,
        "lamp_id": lamp_id,
        "reporter_id": reporter_id,
        "target_id": target_id,
    }


async def reject_report(report_id: str, *, notify: bool = True) -> Dict[str, Any]:
    """驳回报告 → 举报人 -15。与 Bot admin_report_no 一致。"""
    async with session_scope() as s:
        res = await s.execute(select(Report).where(Report.report_id == report_id))
        rep = res.scalar_one_or_none()
        if not rep:
            raise AdminActionError("报告不存在", code="not_found")
        if rep.status != ReportStatus.PENDING.value:
            raise AdminActionError("已处理或不在待审状态", code="conflict")
        rep.status = ReportStatus.REJECTED.value
        rep.reviewed_at = datetime.utcnow()
        reporter_id = rep.reporter_id

    await credit_service.settle_lanhua(
        reporter_id,
        credit_service.DELTA_MALICIOUS_REPORT,
        "report_rejected",
        "无效或恶意报告驳回",
        report_id,
    )
    if notify:
        await notify_user_best_effort(
            reporter_id,
            f"你的月影报告未通过审核，兰花分变动：{credit_service.DELTA_MALICIOUS_REPORT:+d}",
        )
    return {
        "ok": True,
        "report_id": report_id,
        "status": ReportStatus.REJECTED.value,
        "reporter_id": reporter_id,
    }
