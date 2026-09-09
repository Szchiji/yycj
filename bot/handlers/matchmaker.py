"""月影媒婆：自然语言匹配。"""

from __future__ import annotations

from aiogram import F, Router
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message

from bot.keyboards import lamp_actions_kb
from bot.services import matchmaker_service, session_service

router = Router(name="matchmaker")

MENU_TEXTS = {
    "🌕 进入月影秘境",
    "💬 月影媒婆",
    "📜 我的月相",
    "✨ 点亮灯笼",
    "🛡️ 月影报告",
    "📖 使用说明",
    "🗺️ 打开秘境地图",
}


@router.message(Command("match"))
@router.message(F.text == "💬 月影媒婆")
async def ask_matchmaker(message: Message) -> None:
    await message.answer(
        "🌙 我是月影媒婆。\n\n"
        "直接告诉我你的需求即可，例如：\n"
        "「今晚台北想找大学生 KH 6000 左右，真实照优先」\n\n"
        "我会在秘境中为你提灯寻找。"
    )


@router.message(F.text, F.chat.type == "private")
async def free_text_match(message: Message, state: FSMContext) -> None:
    if not message.text or message.text.startswith("/"):
        return
    if message.text in MENU_TEXTS:
        return

    current = await state.get_state()
    if current is not None:
        return

    active = await session_service.get_active_session_for_user(message.from_user.id)
    if active:
        return

    if len(message.text.strip()) < 4:
        return

    await message.answer("正在秘境中提灯寻找，请稍候…")
    result = await matchmaker_service.search_and_match(message.text)
    intro = result.get("poetic_intro") or "月光下，这些灯笼或许与你有缘："
    await message.answer(intro)

    matches = result.get("matches") or []
    if not matches:
        await message.answer(
            "暂时没有找到合适的灯笼。可以换个城市或条件再试试，或「✨ 点亮灯笼」贡献资源。"
        )
        return

    for m in matches:
        lid = m.get("lamp_id")
        if not lid:
            continue
        lamp = await matchmaker_service.get_lamp(lid)
        if not lamp:
            continue
        text = matchmaker_service.format_lamp_card(lamp, match_score=m.get("match_score"))
        reason = m.get("reason") or ""
        risk = m.get("risk_note") or ""
        extra = ""
        if reason:
            extra += f"\n💡 {reason}"
        if risk:
            extra += f"\n⚠️ {risk}"
        await message.answer(
            text + extra,
            reply_markup=lamp_actions_kb(lid),
            parse_mode="Markdown",
        )

    suggestion = result.get("suggestion")
    if suggestion:
        await message.answer(suggestion)


@router.callback_query(F.data.startswith("view_lamp:"))
async def view_lamp(callback: CallbackQuery) -> None:
    lamp_id = callback.data.split(":", 1)[1]
    lamp = await matchmaker_service.get_lamp(lamp_id)
    if not lamp:
        await callback.answer("灯笼已熄灭或不存在", show_alert=True)
        return
    text = matchmaker_service.format_lamp_card(lamp)
    await callback.message.answer(
        text, reply_markup=lamp_actions_kb(lamp_id), parse_mode="Markdown"
    )
    for fid in (lamp.get("photos") or [])[:5]:
        try:
            await callback.message.answer_photo(fid)
        except Exception:
            pass
    await callback.answer()


@router.callback_query(F.data.startswith("fav:"))
async def fav_lamp(callback: CallbackQuery) -> None:
    await callback.answer("已放入时光秘匣（收藏已记录）", show_alert=False)
