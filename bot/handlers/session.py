"""匿名月影会话。"""

from __future__ import annotations

from aiogram import Bot, F, Router
from aiogram.types import CallbackQuery, Message

from bot.keyboards import main_menu, session_accept_kb, session_end_kb
from bot.services import anti_brush, search_service, session_service

router = Router(name="session")


@router.callback_query(F.data.startswith("session_request:"))
async def request_session(cb: CallbackQuery, bot: Bot) -> None:
    if not cb.from_user or not cb.data:
        return
    lamp_id = cb.data.split(":", 1)[1]
    lamp = await search_service.get_lamp(lamp_id)
    if not lamp or lamp.get("status") != "active":
        await cb.answer("灯笼不存在或未上架", show_alert=True)
        return
    if lamp["user_id"] == cb.from_user.id:
        await cb.answer("不能与自己发起会话", show_alert=True)
        return
    if not anti_brush.check_session_request_rate(cb.from_user.id):
        await cb.answer("请求过于频繁", show_alert=True)
        return

    existing = await session_service.get_active_for_user(cb.from_user.id)
    if existing:
        await cb.answer("你已有进行中的会话，请先结束", show_alert=True)
        return

    sess = await session_service.create_request(lamp_id, cb.from_user.id, lamp["user_id"])
    await cb.answer("已发送邀请")
    if cb.message:
        await cb.message.answer(
            f"已向灯笼主人发送月影会话邀请。\n会话码：`{sess['session_id'][:8]}`",
            reply_markup=main_menu(),
        )
    try:
        await bot.send_message(
            lamp["user_id"],
            f"🌕 有人想就你的灯笼 **{lamp.get('title')}** 发起匿名月影会话。\n"
            f"对方身份已遮蔽，接受后由机器人中转消息（24h 内有效）。",
            reply_markup=session_accept_kb(sess["session_id"]),
        )
    except Exception:
        pass


@router.callback_query(F.data.startswith("session_accept:"))
async def accept_session(cb: CallbackQuery, bot: Bot) -> None:
    if not cb.from_user or not cb.data:
        return
    sid = cb.data.split(":", 1)[1]
    sess = await session_service.get_session(sid)
    if not sess or sess["user_b_id"] != cb.from_user.id:
        await cb.answer("无效请求", show_alert=True)
        return
    sess = await session_service.accept(sid)
    if not sess:
        await cb.answer("会话已失效", show_alert=True)
        return
    await cb.answer("已接受")
    text = (
        "🌕 月影会话已开启。\n"
        "直接在此对话框发消息即可匿名中转。\n"
        "可用按钮结束会话或好评。"
    )
    kb = session_end_kb(sid)
    if cb.message:
        await cb.message.answer(text, reply_markup=kb)
    try:
        await bot.send_message(sess["user_a_id"], text, reply_markup=kb)
    except Exception:
        pass


@router.callback_query(F.data.startswith("session_reject:"))
async def reject_session(cb: CallbackQuery, bot: Bot) -> None:
    if not cb.data:
        return
    sid = cb.data.split(":", 1)[1]
    sess = await session_service.get_session(sid)
    await session_service.reject(sid)
    await cb.answer("已拒绝")
    if cb.message:
        await cb.message.answer("已拒绝该月影会话。")
    if sess:
        try:
            await bot.send_message(sess["user_a_id"], "对方拒绝了月影会话邀请。")
        except Exception:
            pass


@router.callback_query(F.data.startswith("session_end:"))
async def end_session_cb(cb: CallbackQuery, bot: Bot) -> None:
    if not cb.data:
        return
    sid = cb.data.split(":", 1)[1]
    data = await session_service.end_session(sid, settle=True)
    await cb.answer("会话已结束")
    delta = (data or {}).get("settle_delta", 0)
    text = f"🔚 月影会话已结束。\n本次兰花分变动：`{delta:+d}`"
    if cb.message:
        await cb.message.answer(text, reply_markup=main_menu())
    if data:
        peer = session_service.peer_id(data, cb.from_user.id) if cb.from_user else None
        if peer:
            try:
                await bot.send_message(peer, text, reply_markup=main_menu())
            except Exception:
                pass


@router.callback_query(F.data.startswith("session_praise:"))
async def praise_session(cb: CallbackQuery) -> None:
    if not cb.data:
        return
    sid = cb.data.split(":", 1)[1]
    await session_service.mark_praise(sid)
    await cb.answer("已记录好评，结束时结算加成")


@router.message(F.text | F.photo | F.video | F.document | F.voice | F.sticker)
async def relay_message(message: Message, bot: Bot) -> None:
    user = message.from_user
    if not user:
        return
    if message.text in {
        "🔍 搜索灯笼", "🌕 我的月影", "✨ 点亮灯笼", "📝 月影报告", "🌸 兰花信用", "❓ 帮助", "取消"
    }:
        return

    sess = await session_service.get_active_for_user(user.id)
    if not sess:
        return

    peer = session_service.peer_id(sess, user.id)
    name = session_service.anon_name(sess, user.id)
    media = bool(message.photo or message.video or message.document or message.voice)
    await session_service.bump_activity(sess["session_id"], media=media)

    prefix = f"👤 **{name}**：\n"
    try:
        if message.text:
            await bot.send_message(peer, prefix + message.text)
        elif message.photo:
            await bot.send_photo(peer, message.photo[-1].file_id, caption=prefix + (message.caption or ""))
        elif message.video:
            await bot.send_video(peer, message.video.file_id, caption=prefix + (message.caption or ""))
        elif message.document:
            await bot.send_document(peer, message.document.file_id, caption=prefix + (message.caption or ""))
        elif message.voice:
            await bot.send_voice(peer, message.voice.file_id, caption=prefix)
        elif message.sticker:
            await bot.send_message(peer, prefix + "[贴纸]")
            await bot.send_sticker(peer, message.sticker.file_id)
    except Exception:
        await message.answer("对方暂时无法接收消息。")
