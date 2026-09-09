"""统一键盘。"""

from __future__ import annotations

from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardMarkup,
    WebAppInfo,
)
from aiogram.utils.keyboard import InlineKeyboardBuilder, ReplyKeyboardBuilder

from bot.config import get_settings


def main_menu() -> ReplyKeyboardMarkup:
    b = ReplyKeyboardBuilder()
    b.row(KeyboardButton(text="🔍 搜索灯笼"), KeyboardButton(text="🌕 我的月影"))
    b.row(KeyboardButton(text="✨ 点亮灯笼"), KeyboardButton(text="📝 月影报告"))
    b.row(KeyboardButton(text="🌸 兰花信用"), KeyboardButton(text="❓ 帮助"))
    webapp = (get_settings().webapp_url or "").strip()
    if webapp:
        b.row(
            KeyboardButton(
                text="📱 打开月影 Mini App",
                web_app=WebAppInfo(url=webapp),
            )
        )
    return b.as_markup(resize_keyboard=True)


def search_filters_kb() -> InlineKeyboardMarkup:
    b = InlineKeyboardBuilder()
    cities = ["台北", "新北", "台中", "高雄", "深圳", "广州", "上海", "香港"]
    for i in range(0, len(cities), 4):
        row = [InlineKeyboardButton(text=c, callback_data=f"search_city:{c}") for c in cities[i : i + 4]]
        b.row(*row)
    b.row(
        InlineKeyboardButton(text="💰 3000以下", callback_data="search_price:0-3000"),
        InlineKeyboardButton(text="💰 3000-6000", callback_data="search_price:3000-6000"),
        InlineKeyboardButton(text="💰 6000+", callback_data="search_price:6000-999999"),
    )
    b.row(InlineKeyboardButton(text="🔄 清除筛选", callback_data="search_clear"))
    return b.as_markup()


def lamp_actions_kb(lamp_id: str, owner: bool = False) -> InlineKeyboardMarkup:
    b = InlineKeyboardBuilder()
    b.row(InlineKeyboardButton(text="💬 发起月影会话", callback_data=f"session_request:{lamp_id}"))
    b.row(InlineKeyboardButton(text="⚠️ 举报", callback_data=f"report_lamp:{lamp_id}"))
    return b.as_markup()


def session_accept_kb(session_id: str) -> InlineKeyboardMarkup:
    b = InlineKeyboardBuilder()
    b.row(
        InlineKeyboardButton(text="✅ 接受", callback_data=f"session_accept:{session_id}"),
        InlineKeyboardButton(text="❌ 拒绝", callback_data=f"session_reject:{session_id}"),
    )
    return b.as_markup()


def session_end_kb(session_id: str) -> InlineKeyboardMarkup:
    b = InlineKeyboardBuilder()
    b.row(InlineKeyboardButton(text="🔚 结束会话", callback_data=f"session_end:{session_id}"))
    b.row(InlineKeyboardButton(text="👍 好评结算", callback_data=f"session_praise:{session_id}"))
    return b.as_markup()


def admin_post_kb(post_id: str) -> InlineKeyboardMarkup:
    b = InlineKeyboardBuilder()
    b.row(
        InlineKeyboardButton(text="✅ 通过", callback_data=f"admin_post_ok:{post_id}"),
        InlineKeyboardButton(text="❌ 拒绝", callback_data=f"admin_post_no:{post_id}"),
    )
    return b.as_markup()


def admin_report_kb(report_id: str) -> InlineKeyboardMarkup:
    b = InlineKeyboardBuilder()
    b.row(
        InlineKeyboardButton(text="✅ 采纳", callback_data=f"admin_report_ok:{report_id}"),
        InlineKeyboardButton(text="❌ 驳回", callback_data=f"admin_report_no:{report_id}"),
    )
    return b.as_markup()


def cancel_kb() -> ReplyKeyboardMarkup:
    b = ReplyKeyboardBuilder()
    b.row(KeyboardButton(text="取消"))
    return b.as_markup(resize_keyboard=True)
