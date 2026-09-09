"""匿名月影会话：征求同意、中转消息、结束结算。"""

from __future__ import annotations

from aiogram import Bot, F, Router
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message

from bot.keyboards import consent_kb, session_end_kb
from bot.services import anti_brush, credit_service, matchmaker_service, session_service

router = Router(name="session")


@router.callback_query(F.data.startswith("moon_chat:"))
async def start_moon_chat(callback: CallbackQuery, bot: Bot) -> None:
    user = callback.from_user
    lamp_id = callback.data.split(":", 1)[1]
    lamp = await matchmaker_service.get_lamp(lamp_id)
    if not lamp or lamp.get("status") != "active":
        await callback.answer("该灯笼不可用", show_alert=True)
        return

    owner_id = int(lamp["user_id"])
    if owner_id == user.id:
        await callback.answer("不能与自己的灯笼私语", show_alert=True)
        return

    shadowed, days, _ = await credit_service.is_shadowed(user.id)
    if shadowed:
        await callback.answer(f"你处于月影遮蔽中（剩余 {days} 天），无法发起会话", show_alert=True)
        return

    u = await credit_service.ensure_user(user.id)
    ok, msg = anti_brush.can_start_session(user.id, int(u.get("lanhua_score") or 0))
    if not ok:
        await callback.answer(msg, show_alert=True)
        return

    existing = await session_service.get_active_session_for_user(user.id)
    if existing:
        await callback.answer("你已有进行中的月影会话，请先 /end 结束", show_alert=True)
        return

    session = await session_service.create_pending_session(lamp_id, user.id, owner_id)

    await callback.message.answer(
        "🌕 月光温柔，我已代你向灯笼主人传话。\n请稍候，等待对方同意或婉拒…"
    )
    try:
        await bot.send_message(
            owner_id,
            f"🌕 **月影秘境来客**\n\n"
            f"有人被你的灯笼「{lamp.get('title', '')}」吸引，想与你匿名月下私语。\n"
            f"会话 24 小时后自动消散，双方身份全程隐藏。\n\n"
            f"是否同意？",
            reply_markup=consent_kb(session["session_id"]),
            parse_mode="Markdown",
        )
    except Exception:
        await callback.message.answer("无法联系灯笼主人（对方可能未启动过机器人）。")
        await session_service.reject_session(session["session_id"])
    await callback.answer()


@router.callback_query(F.data.startswith("consent_yes:"))
async def consent_yes(callback: CallbackQuery, bot: Bot) -> None:
    session_id = callback.data.split(":", 1)[1]
    session = await session_service.get_session(session_id)
    if not session or session.get("status") != "pending":
        await callback.answer("会话已失效", show_alert=True)
        return
    if callback.from_user.id != session["user_b_id"]:
        await callback.answer("无权操作", show_alert=True)
        return

    session = await session_service.activate_session(session_id)
    text = (
        "✨ **月影会话已开启**\n\n"
        "你现在的身份是匿名月影人。\n"
        "所有消息由我（月影媒婆）代为转达。\n"
        "随时输入 /end 结束今夜私语。\n"
        "输入 /praise 可点赞对方。"
    )
    for uid in (session["user_a_id"], session["user_b_id"]):
        try:
            await bot.send_message(uid, text, reply_markup=session_end_kb(), parse_mode="Markdown")
        except Exception:
            pass
    await callback.answer("已同意")


@router.callback_query(F.data.startswith("consent_no:"))
async def consent_no(callback: CallbackQuery, bot: Bot) -> None:
    session_id = callback.data.split(":", 1)[1]
    session = await session_service.get_session(session_id)
    if not session:
        await callback.answer()
        return
    await session_service.reject_session(session_id)
    try:
        await bot.send_message(
            session["user_a_id"],
            "🌙 灯笼主人婉拒了今夜的月下私语。愿下次仍有缘。",
        )
    except Exception:
        pass
    await callback.message.edit_text("已婉拒该请求。")
    await callback.answer()


@router.message(Command("end"))
@router.callback_query(F.data == "session_end")
async def end_cmd(event: Message | CallbackQuery, bot: Bot) -> None:
    user = event.from_user
    session = await session_service.get_active_session_for_user(user.id)
    if not session:
        if isinstance(event, CallbackQuery):
            await event.answer("没有进行中的会话", show_alert=True)
        else:
            await event.answer("没有进行中的月影会话。")
        return

    delta_a, delta_b = await session_service.end_session(session["session_id"], early_end=True)
    for uid in (session["user_a_id"], session["user_b_id"]):
        try:
            d = delta_a if uid == session["user_a_id"] else delta_b
            await bot.send_message(
                uid,
                f"🌕 今夜的月影会话已圆满落幕。\n你获得了 **{d}** 兰花令。\n愿你们在秘境中都找到了想要的光。",
                parse_mode="Markdown",
            )
        except Exception:
            pass
    if isinstance(event, CallbackQuery):
        await event.answer()


@router.message(Command("praise"))
@router.callback_query(F.data == "session_praise")
async def praise_cmd(event: Message | CallbackQuery) -> None:
    user = event.from_user
    session = await session_service.get_active_session_for_user(user.id)
    if not session:
        if isinstance(event, CallbackQuery):
            await event.answer("无进行中的会话", show_alert=True)
        return
    await session_service.mark_praise(session["session_id"])
    if isinstance(event, CallbackQuery):
        await event.answer("已点赞，结算时会加成")
    else:
        await event.answer("已记录点赞，结束会话时双方积分将获得加成。")


@router.message(F.chat.type == "private")
async def relay_session_messages(message: Message, bot: Bot, state: FSMContext) -> None:
    if not message.from_user:
        return
    if message.text and message.text.startswith("/"):
        return
    current = await state.get_state()
    if current is not None:
        return

    session = await session_service.get_active_session_for_user(message.from_user.id)
    if not session:
        return

    peer_id, prefix = session_service.peer_and_prefix(session, message.from_user.id)
    is_media = bool(message.photo or message.video or message.voice or message.document)
    await session_service.record_message(
        session["session_id"], message.from_user.id, is_media=is_media
    )

    try:
        if message.text:
            await bot.send_message(peer_id, f"**{prefix}**\n{message.text}", parse_mode="Markdown")
        elif message.photo:
            await bot.send_photo(
                peer_id,
                message.photo[-1].file_id,
                caption=f"{prefix}" + (f"\n{message.caption}" if message.caption else ""),
            )
        elif message.video:
            await bot.send_video(
                peer_id,
                message.video.file_id,
                caption=f"{prefix}" + (f"\n{message.caption}" if message.caption else ""),
            )
        elif message.voice:
            await bot.send_message(peer_id, f"**{prefix}** 发来一段语音", parse_mode="Markdown")
            await bot.send_voice(peer_id, message.voice.file_id)
        elif message.document:
            await bot.send_document(peer_id, message.document.file_id, caption=f"{prefix}")
        else:
            await bot.send_message(peer_id, f"**{prefix}** 发来一条消息", parse_mode="Markdown")
    except Exception:
        await message.answer("对方暂时无法接收消息。")
