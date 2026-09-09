"""注册所有路由。"""

from __future__ import annotations

from aiogram import Dispatcher

from bot.handlers import admin, credit, post, report, search, session, start


def register_handlers(dp: Dispatcher) -> None:
    dp.include_router(start.router)
    dp.include_router(search.router)
    dp.include_router(session.router)
    dp.include_router(post.router)
    dp.include_router(report.router)
    dp.include_router(credit.router)
    dp.include_router(admin.router)
