"""缓存 Telegram getMe，供首页展示当前机器人用户名。"""

from __future__ import annotations

import logging
import time
from typing import Any, Dict, Optional

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
except Exception:
    logger.exception("admin_ops_wire skipped")


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
