"""管理员审核（Bot 回调复用 admin_ops 业务逻辑）。"""

from __future__ import annotations

from html import escape

from aiogram import Bot, F, Router
from aiogram.filters import Command
from aiogram.types import CallbackQuery, Message

from bot.config import get_settings
from bot.services import admin_ops, session_service
from bot.services.admin_ops import AdminActionError

router = Router(name="admin")


def _is_admin(user_id: int) -> bool:
    return get_settings().is_admin(user_id)


@router.message(Command("admin"))
async def admin_help(message: Message) -> None:
    if not message.from_user or not _is_admin(message.from_user.id):
        return
    await message.answer(
        "管理员命令：\n"
        "审核可通过 Bot 通知按钮，或 Mini App / HTTP API。\n"
        "/admin — 本帮助\n"
        "/session_messages <session_id> — 查看会话落库消息（ADMIN_IDS）\n"
        "HTTP：\n"
        "· GET  /api/admin/posts/pending\n"
        "· POST /api/admin/posts/{id}/approve|reject\n"
        "· GET  /api/admin/reports/pending\n"
        "· POST /api/admin/reports/{id}/accept|reject\n"
        "· POST /api/admin/credit/adjust\n"
        "· GET  /api/admin/shadow\n"
        "· GET  /api/admin/sessions/{id}/messages\n"
        "控制台：/app/admin.html（仅 ADMIN_IDS）"
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
    try:
        await admin_ops.reject_report(report_id, notify=True)
    except AdminActionError as exc:
        await cb.answer(str(exc))
        return
    await cb.answer("已驳回")
    if cb.message:
        await cb.message.edit_text((cb.message.text or "") + "\n\n❌ 已驳回（举报人信用已结算）")
