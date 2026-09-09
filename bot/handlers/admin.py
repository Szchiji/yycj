"""管理员审核。"""

from __future__ import annotations

from datetime import datetime
from html import escape

from aiogram import Bot, F, Router
from aiogram.filters import Command
from aiogram.types import CallbackQuery, Message
from sqlalchemy import select

from bot.config import get_settings
from bot.db import session_scope
from bot.models import Post, PostStatus, Report, ReportStatus
from bot.services import credit_service, search_service, session_service

router = Router(name="admin")


def _is_admin(user_id: int) -> bool:
    return get_settings().is_admin(user_id)


@router.message(Command("admin"))
async def admin_help(message: Message) -> None:
    if not message.from_user or not _is_admin(message.from_user.id):
        return
    await message.answer(
        "管理员命令：\n"
        "审核通过投稿/报告请直接点通知按钮。\n"
        "/admin — 本帮助\n"
        "/session_messages <session_id> — 查看会话落库消息（ADMIN_IDS）"
    )


@router.message(Command("session_messages"))
async def session_messages_cmd(message: Message) -> None:
    """ADMIN_IDS only：列出某 session_id 的落库消息。"""
    if not message.from_user or not _is_admin(message.from_user.id):
        return
    parts = (message.text or "").split(maxsplit=1)
    if len(parts) < 2 or not parts[1].strip():
        await message.answer("用法：/session_messages <session_id>")
        return
    sid = parts[1].strip()
    sess = await session_service.get_session(sid)
    if not sess:
        await message.answer("会话不存在。请使用完整 session_id。")
        return
    msgs = await session_service.list_messages_for_admin(sid, limit=100)
    if not msgs:
        await message.answer(f"会话 <code>{escape(sid[:8])}</code>… 暂无落库消息。")
        return
    lines = [
        f"会话 <code>{escape(sid)}</code> 消息 {len(msgs)} 条"
        f"（status={sess.get('status')}）："
    ]
    for m in msgs[:40]:
        ts = m.get("created_at")
        ts_s = ts.strftime("%m-%d %H:%M") if hasattr(ts, "strftime") else str(ts or "")
        role = escape(str(m.get("from_role") or "?"))
        media = m.get("media_type") or "text"
        body = (m.get("content") or "")[:120]
        body = escape(body) if body else ""
        fid = m.get("file_id")
        extra = f" file=<code>{escape(str(fid)[:24])}…</code>" if fid else ""
        lines.append(f"[{ts_s}] {role}/{media}: {body}{extra}")
    if len(msgs) > 40:
        lines.append(f"… 另有 {len(msgs) - 40} 条未展开")
    text = "\n".join(lines)
    if len(text) > 3500:
        text = text[:3500] + "\n…"
    await message.answer(text)


@router.callback_query(F.data.startswith("admin_post_ok:"))
async def post_ok(cb: CallbackQuery, bot: Bot) -> None:
    if not cb.from_user or not _is_admin(cb.from_user.id) or not cb.data:
        await cb.answer("无权限", show_alert=True)
        return
    post_id = cb.data.split(":", 1)[1]
    async with session_scope() as s:
        res = await s.execute(select(Post).where(Post.post_id == post_id))
        post = res.scalar_one_or_none()
        if not post or post.status != PostStatus.PENDING.value:
            await cb.answer("已处理或不存在")
            return
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
    await credit_service.settle_lanhua(user_id, 15, "post_approved", "灯笼审核通过", post_id)
    await cb.answer("已通过")
    if cb.message:
        await cb.message.edit_text((cb.message.text or "") + "\n\n✅ 已通过上架")
    try:
        await bot.send_message(user_id, f"你的灯笼 <b>{lamp['title']}</b> 已通过审核并上架。")
    except Exception:
        pass


@router.callback_query(F.data.startswith("admin_post_no:"))
async def post_no(cb: CallbackQuery, bot: Bot) -> None:
    if not cb.from_user or not _is_admin(cb.from_user.id) or not cb.data:
        await cb.answer("无权限", show_alert=True)
        return
    post_id = cb.data.split(":", 1)[1]
    async with session_scope() as s:
        res = await s.execute(select(Post).where(Post.post_id == post_id))
        post = res.scalar_one_or_none()
        if not post or post.status != PostStatus.PENDING.value:
            await cb.answer("已处理或不存在")
            return
        post.status = PostStatus.REJECTED.value
        post.reviewed_at = datetime.utcnow()
        user_id = post.user_id
    await cb.answer("已拒绝")
    if cb.message:
        await cb.message.edit_text((cb.message.text or "") + "\n\n❌ 已拒绝")
    try:
        await bot.send_message(user_id, "你的灯笼投稿未通过审核。")
    except Exception:
        pass


@router.callback_query(F.data.startswith("admin_report_ok:"))
async def report_ok(cb: CallbackQuery, bot: Bot) -> None:
    if not cb.from_user or not _is_admin(cb.from_user.id) or not cb.data:
        await cb.answer("无权限", show_alert=True)
        return
    report_id = cb.data.split(":", 1)[1]
    async with session_scope() as s:
        res = await s.execute(select(Report).where(Report.report_id == report_id))
        rep = res.scalar_one_or_none()
        if not rep or rep.status != ReportStatus.PENDING.value:
            await cb.answer("已处理或不存在")
            return
        rep.status = ReportStatus.ACCEPTED.value
        rep.reviewed_at = datetime.utcnow()
        lamp_id = rep.lamp_id
        reporter_id = rep.reporter_id

    lamp = await search_service.get_lamp(lamp_id)
    if lamp:
        await search_service.reject_lamp(lamp_id)
        await credit_service.settle_lanhua(
            lamp["user_id"], -30, "report_accepted", "报告成立，灯笼下架", report_id
        )
    await credit_service.settle_lanhua(reporter_id, 10, "report_reward", "有效报告奖励", report_id)
    await cb.answer("已采纳")
    if cb.message:
        await cb.message.edit_text((cb.message.text or "") + "\n\n✅ 已采纳并处理")


@router.callback_query(F.data.startswith("admin_report_no:"))
async def report_no(cb: CallbackQuery) -> None:
    if not cb.from_user or not _is_admin(cb.from_user.id) or not cb.data:
        await cb.answer("无权限", show_alert=True)
        return
    report_id = cb.data.split(":", 1)[1]
    async with session_scope() as s:
        res = await s.execute(select(Report).where(Report.report_id == report_id))
        rep = res.scalar_one_or_none()
        if not rep or rep.status != ReportStatus.PENDING.value:
            await cb.answer("已处理或不存在")
            return
        rep.status = ReportStatus.REJECTED.value
        rep.reviewed_at = datetime.utcnow()
    await cb.answer("已驳回")
    if cb.message:
        await cb.message.edit_text((cb.message.text or "") + "\n\n❌ 已驳回")
