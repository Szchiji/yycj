"""管理员审核（Bot 回调复用 admin_ops 业务逻辑）。"""

from __future__ import annotations

from html import escape

from aiogram import Bot, F, Router
from aiogram.filters import Command
from aiogram.types import CallbackQuery, Message

from bot.config import get_settings
from bot.keyboards import admin_webapp_kb
from bot.services import admin_ops, session_service
from bot.services.admin_ops import AdminActionError

router = Router(name="admin")


def _is_admin(user_id: int) -> bool:
    return get_settings().is_admin(user_id)


async def _in_scope(cb: CallbackQuery, kind: str, target: str) -> bool:
    """City-scoped operators can't act on other cities from bot buttons either."""
    from fastapi import HTTPException
    from bot.services import city_scope
    try:
        await city_scope.guard(cb.from_user.id, kind, target)
    except HTTPException as exc:
        await cb.answer(str(exc.detail), show_alert=True)
        return False
    return True


@router.message(Command("admin"))
async def admin_help(message: Message) -> None:
    if not message.from_user:
        return
    if not _is_admin(message.from_user.id):
        await message.answer("这个命令只有管理员能用。")
        return
    kb = admin_webapp_kb()
    if not kb:
        await message.answer("还没配 WEBAPP_URL，无法打开后台。")
        return
    await message.answer("点下方打开管理后台。", reply_markup=kb)


@router.message(Command("session_messages"))
async def session_messages_cmd(message: Message) -> None:
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
    if not await _in_scope(cb, "post", post_id):
        return
    try:
        await admin_ops.approve_post(post_id, notify=True)
    except AdminActionError as exc:
        await cb.answer(str(exc))
        return
    await cb.answer("已通过")
    if cb.message:
        await cb.message.edit_text((cb.message.text or "") + "\n\n✅ 已通过上架")


@router.callback_query(F.data.startswith("admin_post_no:"))
async def post_no(cb: CallbackQuery, bot: Bot) -> None:
    if not cb.from_user or not _is_admin(cb.from_user.id) or not cb.data:
        await cb.answer("无权限", show_alert=True)
        return
    post_id = cb.data.split(":", 1)[1]
    if not await _in_scope(cb, "post", post_id):
        return
    try:
        await admin_ops.reject_post(post_id, notify=True)
    except AdminActionError as exc:
        await cb.answer(str(exc))
        return
    await cb.answer("已拒绝")
    if cb.message:
        await cb.message.edit_text((cb.message.text or "") + "\n\n❌ 已拒绝")


@router.callback_query(F.data.startswith("admin_report_ok:"))
async def report_ok(cb: CallbackQuery, bot: Bot) -> None:
    if not cb.from_user or not _is_admin(cb.from_user.id) or not cb.data:
        await cb.answer("无权限", show_alert=True)
        return
    report_id = cb.data.split(":", 1)[1]
    if not await _in_scope(cb, "report", report_id):
        return
    try:
        await admin_ops.accept_report(report_id, notify=True)
    except AdminActionError as exc:
        await cb.answer(str(exc))
        return
    await cb.answer("已采纳")
    if cb.message:
        await cb.message.edit_text((cb.message.text or "") + "\n\n✅ 已采纳并处理")


@router.callback_query(F.data.startswith("admin_report_no:"))
async def report_no(cb: CallbackQuery, bot: Bot) -> None:
    if not cb.from_user or not _is_admin(cb.from_user.id) or not cb.data:
        await cb.answer("无权限", show_alert=True)
        return
    report_id = cb.data.split(":", 1)[1]
    if not await _in_scope(cb, "report", report_id):
        return
    try:
        await admin_ops.reject_report(report_id, notify=True)
    except AdminActionError as exc:
        await cb.answer(str(exc))
        return
    await cb.answer("已驳回")
    if cb.message:
        await cb.message.edit_text((cb.message.text or "") + "\n\n❌ 已驳回（举报人信用已结算）")


_REV_ACTIONS = {
    "admin_rev_ok:": ("approved", "已通过"),
    "admin_rev_no:": ("rejected", "已拒绝"),
    "admin_rev_brush:": ("brush", "已判为刷评"),
}


@router.callback_query(F.data.startswith("admin_rev_"))
async def review_action(cb: CallbackQuery, bot: Bot) -> None:
    """评价审核按钮：超管 + 后台运营号（按负责城市）都能用；处理后同步所有管理员的那条消息。"""
    from bot.services import admin_acl, home_service, review_notify
    data = cb.data or ""
    prefix = next((k for k in _REV_ACTIONS if data.startswith(k)), None)
    if not cb.from_user or not prefix:
        await cb.answer("无效操作", show_alert=True)
        return
    await admin_acl.warm()
    if not admin_acl.is_admin(cb.from_user.id):
        await cb.answer("无权限", show_alert=True)
        return
    review_id = data[len(prefix):]
    if not await _in_scope(cb, "review", review_id):
        return
    status, label = _REV_ACTIONS[prefix]
    try:
        await home_service.set_review_status(review_id, status, note="拒绝刷评" if status == "brush" else None)
    except LookupError:
        await cb.answer("评价不存在", show_alert=True)
        return
    except RuntimeError:
        await cb.answer("这条已经处理过了", show_alert=True)
        try:
            from bot.db import session_scope
            from bot.models import Review
            from sqlalchemy import select
            async with session_scope() as s:
                cur = (await s.execute(select(Review.status).where(Review.review_id == review_id))).scalar_one_or_none()
            if cur:
                await review_notify.sync_handled([review_id], cur)
        except Exception:
            pass
        return
    await cb.answer(label)
    await review_notify.sync_handled([review_id], status, cb.from_user.id)
