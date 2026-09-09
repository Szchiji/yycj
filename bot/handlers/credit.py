"""兰花信用查询。"""

from __future__ import annotations

from aiogram import F, Router
from aiogram.filters import Command
from aiogram.types import Message

from bot.keyboards import remove_kb
from bot.services import credit_service

router = Router(name="credit")


@router.message(F.text.in_({"🌸 兰花信用", "🌸 口碑"}))
@router.message(Command("credit"))
async def show_credit(message: Message) -> None:
    user = message.from_user
    if not user:
        return
    u = await credit_service.ensure_user(user.id, username=user.username, full_name=user.full_name)
    hist = await credit_service.history(user.id, limit=8)
    lines = [credit_service.format_credit_card(u), "", "<b>近期流水</b>"]
    if not hist:
        lines.append("暂无记录")
    else:
        for h in hist:
            t = h["time"].strftime("%m-%d %H:%M") if h.get("time") else ""
            sign = "+" if h["delta"] >= 0 else ""
            lines.append(f"<code>{t}</code> {sign}{h['delta']} · {h['reason']}")
    lines.append("\n请点左下角「首页」进入 Mini App。")
    await message.answer("\n".join(lines), reply_markup=remove_kb())
