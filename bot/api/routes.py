"""Mini App + Admin HTTP 路由（/api/...）。"""
from bot.api.routes_core import router  # noqa: F401
import bot.api.routes_posts  # noqa: F401
import bot.api.routes_admin  # noqa: F401
import bot.api.routes_admin_ops  # noqa: F401
import bot.api.routes_media  # noqa: F401
import bot.api.routes_listing  # noqa: F401
import bot.api.routes_pins_extra  # noqa: F401
import bot.api.routes_favorites  # noqa: F401
import bot.models_extra  # noqa: F401

__all__ = ["router"]
