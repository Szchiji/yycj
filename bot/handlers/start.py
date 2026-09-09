""" /start 与帮助。Bot 薄门：欢迎 + 清键盘 + 提醒点左下角首页。"""

from __future__ import annotations

from aiogram import F, Router
from aiogram.filters import Command, CommandStart
from aiogram.types import Message

from bot.config import get_settings
from bot.keyboards import admin_webapp_kb, remove_kb
from bot.services import credit_service

router = Router(name="start")

HELP_TEXT = """<b>月影车姬</b>
点左下角「首页」打开应用。
也可直接发城市或关键词搜索。"""


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
    tip = "点左下角「首页」开始。" if settings.normalized_webapp_url else "请先配置 WEBAPP_URL。"
    await message.answer(
        f"欢迎使用 <b>月影车姬</b>\n{tip}\n也可直接发搜索词。",
        reply_markup=remove_kb(),
    )
    if settings.is_admin(user.id):
        kb = admin_webapp_kb()
        await message.answer("管理员可点下方打开后台，或发 /admin。", reply_markup=kb)


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
            + "\n\n点左下角「首页」进入应用。",
            reply_markup=remove_kb(),
        )
    else:
        await message.answer("点左下角「首页」进入应用。", reply_markup=remove_kb())
