"""注册所有路由。会话中转优先于搜索兜底。"""

from __future__ import annotations

from aiogram import Dispatcher

from bot.handlers import admin, credit, post, report, search, session, start

_registered = False


def register_handlers(dp: Dispatcher) -> None:
    """幂等挂载；顺序：session 最先（消息中转），search 最后（关键词兜底）。"""
    global _registered
    if _registered:
        return
    if getattr(start.router, "parent_router", None) is not None:
        _registered = True
        return

    dp.include_router(session.router)
    dp.include_router(start.router)
    dp.include_router(post.router)
    dp.include_router(report.router)
    dp.include_router(credit.router)
    dp.include_router(admin.router)
    dp.include_router(search.router)
    _registered = True
