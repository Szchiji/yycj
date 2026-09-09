"""注册所有路由。"""

from __future__ import annotations

from aiogram import Dispatcher

from bot.handlers import admin, credit, post, report, search, session, start

_registered = False


def register_handlers(dp: Dispatcher) -> None:
    """幂等：同一进程内只挂载一次，避免 uvicorn 重载/重复 import 报错。"""
    global _registered
    if _registered:
        return
    if getattr(start.router, "parent_router", None) is not None:
        _registered = True
        return
    dp.include_router(start.router)
    dp.include_router(search.router)
    dp.include_router(session.router)
    dp.include_router(post.router)
    dp.include_router(report.router)
    dp.include_router(credit.router)
    dp.include_router(admin.router)
    _registered = True
