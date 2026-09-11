""" /start 与 /help。支持分享深链：先订阅再进卡片。"""

from __future__ import annotations

from aiogram import F, Router
from aiogram.filters import Command, CommandObject, CommandStart
from aiogram.types import CallbackQuery, Message

from bot.config import get_settings
from bot.keyboards import admin_webapp_kb, remove_kb
from bot.services import credit_service, home_service
from bot.services.share_gate import join_kb, missing_required, open_card_kb, parse_share_payload

router = Router(name="start")

HELP_TEXT = """<b>月影车姬</b>
点左下角「首页」打开应用。
管理员可发 /admin。"""


async def _open_shared(message: Message, lamp_id: str) -> None:
    user = message.from_user
    if not user:
        return
    missing = await missing_required(user.id)
    if missing:
        await message.answer(
            "请先加入以下频道/群，再点「我已关注，查看资料」。",
            reply_markup=join_kb(missing, lamp_id),
        )
        return
    kb = open_card_kb(lamp_id)
    await message.answer("订阅已完成，点下方打开这条资料。", reply_markup=kb or remove_kb())


@router.message(CommandStart())
async def cmd_start(message: Message, command: CommandObject | None = None) -> None:
    user = message.from_user
    if not user:
        return
    await credit_service.ensure_user(
        user.id,
        username=user.username,
        full_name=user.full_name,
    )
    arg = (command.args if command else "") or ""
    if not arg and message.text:
        parts = message.text.split(maxsplit=1)
        arg = parts[1] if len(parts) > 1 else ""
    lamp_id = parse_share_payload(arg)
    if lamp_id:
        await _open_shared(message, lamp_id)
        return

    settings = get_settings()
    tip = "点左下角「首页」开始。" if settings.normalized_webapp_url else "请先配置 WEBAPP_URL。"
    welcome = f"欢迎使用 <b>月影车姬</b>\n{tip}\n也可在首页里搜索与上架。"
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


@router.callback_query(F.data.startswith("share_go:"))
async def cb_share_go(query: CallbackQuery) -> None:
    user = query.from_user
    lamp_id = (query.data or "").split(":", 1)[-1]
    if not user or not lamp_id:
        await query.answer()
        return
    missing = await missing_required(user.id)
    if missing:
        await query.answer("还有频道未加入", show_alert=True)
        if query.message:
            await query.message.edit_reply_markup(reply_markup=join_kb(missing, lamp_id))
        return
    await query.answer()
    kb = open_card_kb(lamp_id)
    if query.message:
        await query.message.answer("订阅已完成，点下方打开这条资料。", reply_markup=kb or remove_kb())


@router.message(Command("help"))
async def cmd_help(message: Message) -> None:
    await message.answer(HELP_TEXT, reply_markup=remove_kb())
