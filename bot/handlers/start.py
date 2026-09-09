""" /start。Bot 薄门：欢迎 + 清键盘 + 提醒点左下角首页。"""

from __future__ import annotations

from aiogram import Router
from aiogram.filters import CommandStart
from aiogram.types import Message

from bot.config import get_settings
from bot.keyboards import admin_webapp_kb, remove_kb
from bot.services import credit_service, home_service

router = Router(name="start")


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
    welcome = f"欢迎使用 <b>月影车姬</b>\n{tip}\n也可在首页里搜索与发布。"
    try:
        site = await home_service.get_or_create_settings()
        custom = (site.get("bot_welcome_text") or "").strip()
        if custom:
            welcome = custom
    except Exception:
        pass
    await message.answer(welcome, reply_markup=remove_kb())
    if settings.is_admin(user.id):
        kb = admin_webapp_kb()
        await message.answer("管理员可点下方打开后台，或发 /admin。", reply_markup=kb)
