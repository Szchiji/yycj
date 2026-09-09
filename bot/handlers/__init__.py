"""注册路由。Bot 薄门：仅 session 中转 + /start + /admin。"""

from __future__ import annotations

from aiogram import Dispatcher

from bot.handlers import admin, session, start

_registered = False


def register_handlers(dp: Dispatcher) -> None:
    """幂等挂载；session 优先（消息中转）。搜索/发布等仅走 Mini App。"""
    global _registered
    if _registered:
        return
    if getattr(start.router, "parent_router", None) is not None:
        _registered = True
        return

    dp.include_router(session.router)
    dp.include_router(start.router)
    dp.include_router(admin.router)
    _registered = True
