"""超管 ADMIN_IDS + 后台添加的运营号。"""
from __future__ import annotations

import logging
from typing import Iterable, List, Set

from bot.config import Settings, get_settings

logger = logging.getLogger(__name__)
_extra: Set[int] = set()


def extra_ids() -> Set[int]:
    return set(_extra)


def remember(ids: Iterable[int]) -> List[int]:
    global _extra
    out: Set[int] = set()
    for x in ids or []:
        try:
            n = int(x)
        except (TypeError, ValueError):
            continue
        if n:
            out.add(n)
    _extra = out
    return sorted(out)


def is_super(user_id: int) -> bool:
    return int(user_id) in get_settings().admin_id_list


def is_admin(user_id: int) -> bool:
    uid = int(user_id)
    return uid in get_settings().admin_id_list or uid in _extra


async def warm() -> List[int]:
    try:
        from bot.services import home_service
        site = await home_service.get_or_create_settings()
        return remember(site.get("extra_admin_ids") or [])
    except Exception:
        logger.exception("warm extra admins failed")
        return sorted(_extra)


async def save(ids: Iterable[int]) -> List[int]:
    cleaned = remember(ids)
    from bot.services import home_service
    await home_service.update_settings(ops_config={"extra_admin_ids": cleaned})
    return cleaned


def install() -> None:
    Settings.is_admin = lambda self, user_id: is_admin(user_id)  # type: ignore[method-assign]


install()
