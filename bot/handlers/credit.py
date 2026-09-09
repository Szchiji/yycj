"""信用分 / 兰花令 查询与修行任务。"""

from __future__ import annotations

from aiogram import F, Router
from aiogram.filters import Command
from aiogram.types import CallbackQuery, Message

from bot.keyboards import credit_menu_kb
from bot.services import credit_service

router = Router(name="credit")


def _format_user_card(user: dict) -> str:
    score = int(user.get("lanhua_score") or 0)
    tier = user.get("tier") or "新月"
    lines = [
        f"📜 **我的月相**",
        f"兰花令：**{score}**",
        f"月相等级：**{tier}**",
    ]
    if user.get("is_shadowed"):
        lines.append(f"🌑 月影遮蔽中 · 剩余 **{user.get('shadow_days')}** 天")
        if user.get("shadow_reason"):
            lines.append(f"原因：{user.get('shadow_reason')}")
    else:
        lines.append("状态：月相清朗")
    lines.append(
        f"累计获得：{user.get('total_earned', 0)} · 累计扣除：{user.get('total_deducted', 0)}"
    )
    return "\n".join(lines)


@router.message(Command("credit"))
@router.message(Command("my_lanhua"))
@router.message(F.text == "📜 我的月相")
async def my_credit(message: Message) -> None:
    user = await credit_service.ensure_user(
        message.from_user.id,
        username=message.from_user.username,
        full_name=message.from_user.full_name,
    )
    await message.answer(
        _format_user_card(user),
        reply_markup=credit_menu_kb(),
        parse_mode="Markdown",
    )


@router.callback_query(F.data == "credit_history")
async def credit_history(callback: CallbackQuery) -> None:
    rows = await credit_service.get_history(callback.from_user.id, limit=15)
    if not rows:
        await callback.message.answer("暂无流水记录。")
        await callback.answer()
        return
    lines = ["📋 **最近信用流水**\n"]
    for r in rows:
        sign = "+" if r.get("delta", 0) >= 0 else ""
        t = r.get("time")
        tstr = t.strftime("%m-%d %H:%M") if hasattr(t, "strftime") else str(t)[:16]
        lines.append(
            f"`{tstr}` {sign}{r.get('delta')} · {r.get('reason') or r.get('action')}"
        )
    await callback.message.answer("\n".join(lines), parse_mode="Markdown")
    await callback.answer()


@router.callback_query(F.data == "credit_tasks")
async def credit_tasks(callback: CallbackQuery) -> None:
    text = (
        "✦ **月下修行任务**\n\n"
        "· 真诚灯笼投稿并通过审核 → **+40~80**\n"
        "· 完成 1 场积极月影会话 → **+8~28**\n"
        "· 真实有效报告 → **+40~120**\n"
        "· 每日自动新月重生 → **+8~15**\n\n"
        "恶意行为会扣分并可能进入月影遮蔽。"
    )
    await callback.message.answer(text, parse_mode="Markdown")
    await callback.answer()


@router.callback_query(F.data == "credit_shadow")
async def credit_shadow(callback: CallbackQuery) -> None:
    shadowed, days, reason = await credit_service.is_shadowed(callback.from_user.id)
    if not shadowed:
        await callback.message.answer("你当前没有被月影遮蔽，月相清朗。")
    else:
        await callback.message.answer(
            f"🌑 **月影遮蔽中**\n剩余 **{days}** 天\n原因：{reason or '信用过低'}\n\n"
            "完成投稿/报告/会话等修行可加速恢复；每日仍有减半的新月重生。",
            parse_mode="Markdown",
        )
    await callback.answer()
