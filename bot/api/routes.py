"""Mini App + Admin HTTP 路由（/api/...）。"""
from bot.api.routes_core import router  # noqa: F401
import bot.api.routes_ops  # noqa: F401  # registers posts/reviews/admin on same router

__all__ = ["router"]
