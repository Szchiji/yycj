"""所有 Inline / Reply 键盘。"""

from __future__ import annotations

from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardMarkup,
    WebAppInfo,
)

from bot.config import get_settings


def main_menu_kb() -> ReplyKeyboardMarkup:
    settings = get_settings()
    rows = [
        [KeyboardButton(text="🌕 进入月影秘境")],
        [KeyboardButton(text="💬 月影媒婆"), KeyboardButton(text="📜 我的月相")],
        [KeyboardButton(text="✨ 点亮灯笼"), KeyboardButton(text="🛡️ 月影报告")],
        [KeyboardButton(text="📖 使用说明")],
    ]
    if settings.webapp_url:
        rows.insert(
            0,
            [KeyboardButton(text="🗺️ 打开秘境地图", web_app=WebAppInfo(url=settings.webapp_url))],
        )
    return ReplyKeyboardMarkup(keyboard=rows, resize_keyboard=True)


def lamp_actions_kb(lamp_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="提灯月下私语", callback_data=f"moon_chat:{lamp_id}")],
            [
                InlineKeyboardButton(text="收藏", callback_data=f"fav:{lamp_id}"),
                InlineKeyboardButton(text="报告异常", callback_data=f"report:{lamp_id}"),
            ],
        ]
    )


def consent_kb(session_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="同意", callback_data=f"consent_yes:{session_id}"),
                InlineKeyboardButton(text="婉拒", callback_data=f"consent_no:{session_id}"),
            ]
        ]
    )


def session_end_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="结束今夜私语 /end", callback_data="session_end")],
            [InlineKeyboardButton(text="点赞对方 /praise", callback_data="session_praise")],
            [InlineKeyboardButton(text="举报 /report", callback_data="session_report")],
        ]
    )


def admin_post_kb(post_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="✅ 通过", callback_data=f"admin_post_ok:{post_id}"),
                InlineKeyboardButton(text="❌ 拒绝", callback_data=f"admin_post_no:{post_id}"),
            ]
        ]
    )


def admin_report_kb(report_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="✅ 认定有效", callback_data=f"admin_report_ok:{report_id}"),
                InlineKeyboardButton(text="❌ 驳回", callback_data=f"admin_report_no:{report_id}"),
            ]
        ]
    )


def credit_menu_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="信用流水", callback_data="credit_history")],
            [InlineKeyboardButton(text="月下修行任务", callback_data="credit_tasks")],
            [InlineKeyboardButton(text="查看遮蔽状态", callback_data="credit_shadow")],
        ]
    )
