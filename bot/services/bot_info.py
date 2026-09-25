"""缓存 Telegram getMe，供首页展示当前机器人用户名。"""

from __future__ import annotations

import logging
import time
from typing import Any, Dict, Optional
from zoneinfo import ZoneInfo

logger = logging.getLogger(__name__)

_cache: Dict[str, Any] = {"username": "", "id": None, "ts": 0.0}
_TTL = 3600.0

try:
    from bot.services import user_admin  # noqa: F401
except Exception:
    logger.exception("user_admin wire skipped")
try:
    from bot.services import search_hooks  # noqa: F401
except Exception:
    logger.exception("search_hooks wire skipped")
try:
    from bot.services import admin_ops_wire  # noqa: F401
    from bot.services import extras_store  # noqa: F401
    from bot.services import admin_acl  # noqa: F401
except Exception:
    logger.exception("admin_ops_wire skipped")


def _install_shift_jobs() -> None:
    try:
        from bot.main import scheduler
        from bot.services.open_shift import expire_unanswered, send_daily
    except Exception:
        return
    if not getattr(scheduler, "running", False):
        return
    async def job_open_shift() -> None:
        try:
            n = await send_daily()
            if n:
                logger.info("shift remind users=%s", n)
        except Exception:
            logger.exception("shift remind failed")
    async def job_shift_timeout() -> None:
        try:
            n = await expire_unanswered()
            if n:
                logger.info("shift timeout closed=%s", n)
        except Exception:
            logger.exception("shift timeout failed")
    scheduler.add_job(job_open_shift, "cron", hour=0, minute=5, timezone=ZoneInfo("Asia/Shanghai"), id="open_shift", replace_existing=True)
    scheduler.add_job(job_shift_timeout, "interval", minutes=10, id="shift_timeout", replace_existing=True)


async def refresh_bot_identity(bot=None) -> Dict[str, Any]:
    global _cache
    try:
        if bot is None:
            from bot.main import bot as app_bot
            bot = app_bot
        me = await bot.get_me()
        _cache = {
            "username": me.username or "",
            "id": me.id,
            "first_name": me.first_name or "",
            "ts": time.time(),
        }
        logger.info("Bot identity @%s id=%s", _cache["username"], _cache["id"])
    except Exception:
        logger.exception("refresh_bot_identity failed")
    try:
        from bot.services.admin_acl import warm
        await warm()
    except Exception:
        logger.exception("warm extra admins failed")
    try:
        from bot.services.expiry_nudge import nudge_expiring
        await nudge_expiring(3)
    except Exception:
        logger.exception("expiry nudge failed")
    try:
        _install_shift_jobs()
    except Exception:
        logger.exception("shift jobs skipped")
    return dict(_cache)


async def get_bot_identity(bot=None) -> Dict[str, Any]:
    if not _cache.get("username") or (time.time() - float(_cache.get("ts") or 0)) > _TTL:
        await refresh_bot_identity(bot)
    return dict(_cache)


def bot_tme_url(username: Optional[str] = None) -> str:
    name = (username or _cache.get("username") or "").lstrip("@")
    return f"https://t.me/{name}" if name else ""


def normalize_contact(raw: str) -> str:
    s = (raw or "").strip()
    if not s:
        return ""
    if s.startswith("tg://"):
        return s
    if s.startswith("http://") or s.startswith("https://"):
        if "t.me/" in s or "telegram.me/" in s:
            return s
        return ""
    if s.startswith("@"):
        return f"https://t.me/{s[1:]}"
    if s.lstrip("-").isdigit():
        return f"tg://user?id={s}"
    if s.replace("_", "").isalnum():
        return f"https://t.me/{s}"
    return ""
