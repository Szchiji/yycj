""" /start 与帮助。Bot 薄门：欢迎 + 清键盘 + 提醒点左下角首页。"""

from __future__ import annotations

from aiogram import F, Router
from aiogram.filters import Command, CommandStart
from aiogram.types import Message

from bot.config import get_settings
from bot.keyboards import admin_webapp_kb, remove_kb
from bot.services import credit_service

router = Router(name="start")

HELP_TEXT = """🌕 <b>月影车姬</b>
月下寻花，影中见真

<b>怎么用</b>
• 点左下角「首页」进入 Mini App（搜索 / 发布 / 我的）
• 💬 月影会话 — 在 Bot 内匿名中转，结束后结算兰花分
• 管理员发送 /admin 打开管理后台

也可直接发送城市或关键词搜索，例如：
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
    settings = get_settings()
    tip = "请点左下角「首页」打开 Mini App。" if settings.normalized_webapp_url else "请配置 WEBAPP_URL 后使用 Mini App。"
    await message.answer(
        "欢迎来到 <b>月影车姬</b> 🌕\n月下寻花，影中见真。\n\n"
        f"{tip}\n也可直接发送搜索词。",
        reply_markup=remove_kb(),
    )
    if settings.is_admin(user.id):
        kb = admin_webapp_kb()
        await message.answer(
            "🛠 管理员：点下方「管理后台」打开控制台，或发送 /admin。",
            reply_markup=kb,
        )


@router.message(Command("help"))
@router.message(F.text.in_({"❓ 帮助"}))
async def cmd_help(message: Message) -> None:
    await message.answer(HELP_TEXT, reply_markup=remove_kb())


@router.message(F.text.in_({"🌕 我的", "🌕 我的月影", "📱 打开首页", "打开首页"}))
async def remind_miniapp(message: Message) -> None:
    """旧键盘按钮兼容：引导回 Mini App。"""
    user = message.from_user
    if user:
        u = await credit_service.ensure_user(user.id, username=user.username, full_name=user.full_name)
        await message.answer(
            credit_service.format_credit_card(u)
            + "\n\n请点左下角「首页」进入 Mini App 查看更多。",
            reply_markup=remove_kb(),
        )
    else:
        await message.answer("请点左下角「首页」进入 Mini App。", reply_markup=remove_kb())
