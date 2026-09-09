"""注册全部路由。"""

from aiogram import Dispatcher

from bot.handlers import admin, credit, matchmaker, post, report, session, start


def register_handlers(dp: Dispatcher) -> None:
    dp.include_router(start.router)
    dp.include_router(matchmaker.router)
    dp.include_router(session.router)
    dp.include_router(post.router)
    dp.include_router(report.router)
    dp.include_router(credit.router)
    dp.include_router(admin.router)
