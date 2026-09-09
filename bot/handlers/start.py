""" /start 与主菜单。"""

from __future__ import annotations

from aiogram import F, Router
from aiogram.filters import Command, CommandStart
from aiogram.types import Message

from bot.keyboards import lamp_actions_kb, main_menu_kb
from bot.services import credit_service, matchmaker_service

router = Router(name="start")

WELCOME = """🌕 **欢迎来到月影车姬**

月下寻花，影中见真。

这里不是冰冷的公开榜，而是有仪式感的月影秘境：
• 🗺️ **秘境地图** — 提灯夜游，寻找亮起的灯笼
• 💬 **月影媒婆** — 自然语言描述需求，智能匹配
• 🔒 **月下私语** — 双方同意后的匿名临时会话
• 📜 **兰花信用** — 真实互动积累信任，恶意行为将进入月影遮蔽

**重要声明**
仅提供公开资源信息的整理与检索，不涉及任何交易撮合。
请自行验证安全，理性决策。

发送下方菜单开始，或直接用自然语言告诉媒婆你的需求。
"""

HELP = """📖 **使用说明**

1. **找资源**：点「月影媒婆」或直接发消息
2. **月下私语**：对方同意后进入匿名会话，输入 /end 结束
3. **点亮灯笼**：提交资源，审核通过后获得兰花令
4. **报告**：异常可提交；恶意报告会扣分
5. **我的月相**：查看信用分与流水
"""


@router.message(CommandStart())
async def cmd_start(message: Message) -> None:
    user = message.from_user
    if not user:
        return
    await credit_service.ensure_user(user.id, username=user.username, full_name=user.full_name)
    await message.answer(WELCOME, reply_markup=main_menu_kb(), parse_mode="Markdown")


@router.message(Command("help"))
@router.message(F.text == "📖 使用说明")
async def cmd_help(message: Message) -> None:
    await message.answer(HELP, parse_mode="Markdown")


@router.message(F.text == "🌕 进入月影秘境")
async def open_realm(message: Message) -> None:
    lamps = await matchmaker_service.list_active_lamps(limit=5)
    if not lamps:
        await message.answer(
            "秘境中暂时还没有亮起的灯笼。\n你可以通过「✨ 点亮灯笼」提交第一盏。",
            reply_markup=main_menu_kb(),
        )
        return
    await message.answer("🌕 以下是秘境中最近亮起的灯笼：")
    for lamp in lamps:
        text = matchmaker_service.format_lamp_card(lamp)
        await message.answer(
            text,
            reply_markup=lamp_actions_kb(lamp["lamp_id"]),
            parse_mode="Markdown",
        )
