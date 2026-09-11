"""上线前清掉演示资料。"""
from __future__ import annotations

import logging
from typing import Any, Dict, List

from sqlalchemy import delete, select

from bot.db import session_scope
from bot.models import HomepagePin, Lamp

logger = logging.getLogger(__name__)

DEMO_TITLES = {"小月", "阿影", "商家演示"}


def _is_demo(lamp: Lamp) -> bool:
    if int(lamp.user_id or 0) == 0:
        return True
    if (lamp.title or "") in DEMO_TITLES:
        return True
    if "演示" in (lamp.description or ""):
        return True
    if "picsum.photos/seed/yycj" in str(lamp.media or ""):
        return True
    return False


async def purge_demo_listings() -> Dict[str, Any]:
    async with session_scope() as s:
        lamps = list((await s.execute(select(Lamp))).scalars().all())
        ids: List[str] = [x.lamp_id for x in lamps if _is_demo(x)]
        if ids:
            await s.execute(delete(HomepagePin).where(HomepagePin.lamp_id.in_(ids)))
            await s.execute(delete(Lamp).where(Lamp.lamp_id.in_(ids)))
        logger.info("purged %s demo lamps", len(ids))
        return {"seeded": False, "purged": len(ids), "lamp_ids": ids}
