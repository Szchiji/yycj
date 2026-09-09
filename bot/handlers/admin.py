"""管理员审核投稿与报告。"""

from __future__ import annotations

from datetime import datetime

from aiogram import F, Router
from aiogram.filters import Command
from aiogram.types import CallbackQuery, Message

from bot.config import get_settings
from bot.db import get_db
from bot.services import credit_service, matchmaker_service

router = Router(name="admin")


def _is_admin(user_id: int) -> bool:
    return get_settings().is_admin(user_id)


@router.message(Command("admin"))
async def admin_help(message: Message) -> None:
    if not _is_admin(message.from_user.id):
        return
    await message.answer(
        "管理员命令：\n"
        "/shadow <user_id> <days> <原因> — 手动遮蔽\n"
        "/unshadow <user_id> — 解除遮蔽\n"
        "/score <user_id> — 查看用户信用\n"
        "投稿/报告审核请使用消息下的按钮。"
    )


@router.callback_query(F.data.startswith("admin_post_ok:"))
async def admin_post_ok(callback: CallbackQuery) -> None:
    if not _is_admin(callback.from_user.id):
        await callback.answer("无权限", show_alert=True)
        return
    post_id = callback.data.split(":", 1)[1]
    db = get_db()
    post = await db.posts.find_one({"post_id": post_id})
    if not post:
        await callback.answer("记录不存在", show_alert=True)
        return
    lamp_id = post.get("lamp_id")
    await matchmaker_service.approve_lamp(lamp_id)
    await db.posts.update_one(
        {"post_id": post_id},
        {"$set": {"status": "approved", "reviewed_at": datetime.utcnow()}},
    )
    reward = 55
    await credit_service.settle_lanhua(
        int(post["user_id"]), reward, "post_approved", "优质投稿通过", post_id
    )
    try:
        await callback.bot.send_message(
            int(post["user_id"]),
            f"✨ 你的灯笼已点亮！获得 **{reward}** 兰花令。",
            parse_mode="Markdown",
        )
    except Exception:
        pass
    await callback.message.edit_text((callback.message.text or "") + "\n\n✅ 已通过")
    await callback.answer("已通过")


@router.callback_query(F.data.startswith("admin_post_no:"))
async def admin_post_no(callback: CallbackQuery) -> None:
    if not _is_admin(callback.from_user.id):
        await callback.answer("无权限", show_alert=True)
        return
    post_id = callback.data.split(":", 1)[1]
    db = get_db()
    post = await db.posts.find_one({"post_id": post_id})
    if not post:
        await callback.answer("记录不存在", show_alert=True)
        return
    lamp_id = post.get("lamp_id")
    if lamp_id:
        await matchmaker_service.reject_lamp(lamp_id)
    await db.posts.update_one(
        {"post_id": post_id},
        {"$set": {"status": "rejected", "reviewed_at": datetime.utcnow()}},
    )
    await credit_service.settle_lanhua(
        int(post["user_id"]), -25, "post_rejected", "投稿未通过", post_id
    )
    try:
        await callback.bot.send_message(
            int(post["user_id"]),
            "你的投稿未通过审核，已扣除少量兰花令。请调整后重试。",
        )
    except Exception:
        pass
    await callback.message.edit_text((callback.message.text or "") + "\n\n❌ 已拒绝")
    await callback.answer("已拒绝")


@router.callback_query(F.data.startswith("admin_report_ok:"))
async def admin_report_ok(callback: CallbackQuery) -> None:
    if not _is_admin(callback.from_user.id):
        await callback.answer("无权限", show_alert=True)
        return
    report_id = callback.data.split(":", 1)[1]
    db = get_db()
    report = await db.reports.find_one({"report_id": report_id})
    if not report:
        await callback.answer("记录不存在", show_alert=True)
        return
    await db.reports.update_one(
        {"report_id": report_id},
        {"$set": {"status": "accepted", "reviewed_at": datetime.utcnow()}},
    )
    if report.get("lamp_id"):
        await db.lamps.update_one(
            {"lamp_id": report["lamp_id"]},
            {"$set": {"status": "gray", "updated_at": datetime.utcnow()}},
        )
    reward = 70
    await credit_service.settle_lanhua(
        int(report["reporter_id"]),
        reward,
        "report_accepted",
        "真实报告验证通过",
        report_id,
    )
    try:
        await callback.bot.send_message(
            int(report["reporter_id"]),
            f"你的报告已认定有效，获得 **{reward}** 兰花令。感谢守护月影。",
            parse_mode="Markdown",
        )
    except Exception:
        pass
    await callback.message.edit_text((callback.message.text or "") + "\n\n✅ 已认定有效")
    await callback.answer()


@router.callback_query(F.data.startswith("admin_report_no:"))
async def admin_report_no(callback: CallbackQuery) -> None:
    if not _is_admin(callback.from_user.id):
        await callback.answer("无权限", show_alert=True)
        return
    report_id = callback.data.split(":", 1)[1]
    db = get_db()
    report = await db.reports.find_one({"report_id": report_id})
    if not report:
        await callback.answer("记录不存在", show_alert=True)
        return
    await db.reports.update_one(
        {"report_id": report_id},
        {"$set": {"status": "rejected", "reviewed_at": datetime.utcnow()}},
    )
    await credit_service.settle_lanhua(
        int(report["reporter_id"]),
        -60,
        "report_rejected",
        "报告被驳回（可能恶意）",
        report_id,
    )
    await credit_service.apply_shadow(int(report["reporter_id"]), 3, "报告被驳回")
    try:
        await callback.bot.send_message(
            int(report["reporter_id"]),
            "你的报告被驳回，已扣分并进入短期月影遮蔽。请勿恶意举报。",
        )
    except Exception:
        pass
    await callback.message.edit_text((callback.message.text or "") + "\n\n❌ 已驳回")
    await callback.answer()


@router.message(Command("shadow"))
async def cmd_shadow(message: Message) -> None:
    if not _is_admin(message.from_user.id):
        return
    parts = (message.text or "").split(maxsplit=3)
    if len(parts) < 3:
        await message.answer("用法：/shadow <user_id> <days> [原因]")
        return
    uid = int(parts[1])
    days = int(parts[2])
    reason = parts[3] if len(parts) > 3 else "管理员裁决"
    await credit_service.apply_shadow(uid, days, reason)
    await message.answer(f"已遮蔽用户 {uid}，{days} 天。")


@router.message(Command("unshadow"))
async def cmd_unshadow(message: Message) -> None:
    if not _is_admin(message.from_user.id):
        return
    parts = (message.text or "").split()
    if len(parts) < 2:
        await message.answer("用法：/unshadow <user_id>")
        return
    uid = int(parts[1])
    db = get_db()
    await db.users.update_one(
        {"user_id": uid},
        {"$set": {"is_shadowed": False, "shadow_days": 0, "shadow_reason": None}},
    )
    await message.answer(f"已解除用户 {uid} 的遮蔽。")


@router.message(Command("score"))
async def cmd_score(message: Message) -> None:
    if not _is_admin(message.from_user.id):
        return
    parts = (message.text or "").split()
    if len(parts) < 2:
        await message.answer("用法：/score <user_id>")
        return
    uid = int(parts[1])
    user = await credit_service.ensure_user(uid)
    await message.answer(
        f"用户 {uid}\n分数：{user.get('lanhua_score')}\n等级：{user.get('tier')}\n"
        f"遮蔽：{user.get('is_shadowed')} / {user.get('shadow_days')} 天"
    )
