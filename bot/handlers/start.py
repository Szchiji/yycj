""" /start 与主菜单。"""

from __future__ import annotations

from aiogram import F, Router
from aiogram.filters import Command, CommandStart
from aiogram.types import Message

from bot.keyboards import main_menu
from bot.services import credit_service

router = Router(name="start")

HELP_TEXT = """🌕 <b>月影车姬</b>
月下寻花，影中见真

<b>功能</b>
• 🔍 搜索灯笼 — 城市 / 价位 / 关键词
• ✨ 点亮灯笼 — 投稿，管理员审核后上架
• 💬 月影会话 — 匿名中转，结束后结算兰花分
• 📝 月影报告 — 异常反馈
• 🌸 兰花信用 — 等级与遮蔽状态

发送城市或关键词即可直接搜索，例如：
<code>台北 大学生</code> / <code>深圳 5000</code>
"""


@router.message(CommandStart())
async def cmd_start(message: Message) -> None:
    user = message.from_user
    if not user:
        return
    await credit_service.ensure_user(
        user.id,
        username=user.username,
        full_name=user.full_name,
    )
    await message.answer(
        "欢迎来到 <b>月影车姬</b> 🌕\n月下寻花，影中见真。\n\n请选择功能，或直接发送搜索词。",
        reply_markup=main_menu(),
    )


@router.message(Command("help"))
@router.message(F.text == "❓ 帮助")
async def cmd_help(message: Message) -> None:
    await message.answer(HELP_TEXT, reply_markup=main_menu())


@router.message(F.text == "🌕 我的月影")
async def my_profile(message: Message) -> None:
    user = message.from_user
    if not user:
        return
    u = await credit_service.ensure_user(user.id, username=user.username, full_name=user.full_name)
    await message.answer(credit_service.format_credit_card(u), reply_markup=main_menu())
