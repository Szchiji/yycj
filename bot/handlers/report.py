"""月影报告。"""

from __future__ import annotations

import uuid
from datetime import datetime

from aiogram import Bot, F, Router
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import CallbackQuery, Message

from bot.config import get_settings
from bot.db import get_db
from bot.keyboards import admin_report_kb, main_menu_kb
from bot.services import anti_brush, matchmaker_service, session_service

router = Router(name="report")


class ReportForm(StatesGroup):
    lamp_id = State()
    reason = State()
    description = State()
    evidence = State()


@router.message(Command("report"))
@router.message(F.text == "🛡️ 月影报告")
async def start_report(message: Message, state: FSMContext) -> None:
    ok, msg = anti_brush.can_report(message.from_user.id)
    if not ok:
        await message.answer(msg)
        return
    await state.set_state(ReportForm.lamp_id)
    await message.answer("请输入要报告的灯笼 ID（或从灯笼详情点「报告异常」）：")


@router.callback_query(F.data.startswith("report:"))
async def report_from_lamp(callback: CallbackQuery, state: FSMContext) -> None:
    lamp_id = callback.data.split(":", 1)[1]
    ok, msg = anti_brush.can_report(callback.from_user.id)
    if not ok:
        await callback.answer(msg, show_alert=True)
        return
    await state.update_data(lamp_id=lamp_id)
    await state.set_state(ReportForm.reason)
    await callback.message.answer(
        f"报告灯笼：`{lamp_id}`\n请输入问题类型（如：照片不符 / 骗子 / 已失效）：",
        parse_mode="Markdown",
    )
    await callback.answer()


@router.message(ReportForm.lamp_id)
async def report_lamp_id(message: Message, state: FSMContext) -> None:
    lamp_id = message.text.strip()
    lamp = await matchmaker_service.get_lamp(lamp_id)
    if not lamp:
        await message.answer("找不到该灯笼，请检查 ID。")
        return
    await state.update_data(lamp_id=lamp_id)
    await state.set_state(ReportForm.reason)
    await message.answer("请输入问题类型（如：照片不符 / 骗子 / 已失效）：")


@router.message(ReportForm.reason)
async def report_reason(message: Message, state: FSMContext) -> None:
    await state.update_data(reason=message.text.strip()[:64])
    await state.set_state(ReportForm.description)
    await message.answer("请详细描述情况（尽量客观）：")


@router.message(ReportForm.description)
async def report_desc(message: Message, state: FSMContext) -> None:
    await state.update_data(description=message.text.strip()[:1500], evidence=[])
    await state.set_state(ReportForm.evidence)
    await message.answer("可上传证据截图（可选）。传完发送 /done，跳过也发送 /done。")


@router.message(ReportForm.evidence, F.photo)
async def report_photo(message: Message, state: FSMContext) -> None:
    data = await state.get_data()
    ev = list(data.get("evidence") or [])
    if len(ev) >= 5:
        await message.answer("最多 5 张，请 /done")
        return
    ev.append(message.photo[-1].file_id)
    await state.update_data(evidence=ev)
    await message.answer(f"已收证据 {len(ev)} 张，继续或 /done")


@router.message(ReportForm.evidence, Command("done"))
async def report_done(message: Message, state: FSMContext, bot: Bot) -> None:
    data = await state.get_data()
    report_id = str(uuid.uuid4())
    doc = {
        "report_id": report_id,
        "lamp_id": data.get("lamp_id"),
        "reporter_id": message.from_user.id,
        "reason": data.get("reason"),
        "description": data.get("description"),
        "evidence": data.get("evidence") or [],
        "status": "pending",
        "created_at": datetime.utcnow(),
    }
    await get_db().reports.insert_one(doc)
    anti_brush.record_report(message.from_user.id)
    await state.clear()
    await message.answer(
        "已提交报告，进入审核。\n真实有效的报告通过后可获兰花令；恶意报告将被重罚。",
        reply_markup=main_menu_kb(),
    )

    settings = get_settings()
    for admin_id in settings.admin_id_list:
        try:
            await bot.send_message(
                admin_id,
                f"⚠️ 新报告\n"
                f"report_id：{report_id}\n"
                f"lamp_id：{doc['lamp_id']}\n"
                f"类型：{doc['reason']}\n"
                f"描述：{(doc.get('description') or '')[:200]}",
                reply_markup=admin_report_kb(report_id),
            )
        except Exception:
            pass


@router.callback_query(F.data == "session_report")
async def session_report_btn(callback: CallbackQuery, state: FSMContext) -> None:
    session = await session_service.get_active_session_for_user(callback.from_user.id)
    if not session:
        await callback.answer("无进行中会话", show_alert=True)
        return
    await session_service.mark_reported(session["session_id"])
    await state.update_data(lamp_id=session.get("lamp_id"))
    await state.set_state(ReportForm.reason)
    await callback.message.answer("已标记会话异常。请输入问题类型：")
    await callback.answer()
