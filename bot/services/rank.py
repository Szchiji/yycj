"""人气热度分（带时间衰减）与推广位。

hot_score = (views * 0.4 + review_count * 12 + avg_stars * 9) * decay
decay = 0.55 + 0.45 / (1 + age_days / 90)

boost_level / boost_until 用于付费上榜（线下付款后后台手动设置）。
活跃 boost 在排序中优先于普通热度。
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import func, select

from bot.db import session_scope
from bot.models import Lamp, LampStatus, Review, ReviewStatus
from bot.models_extra import LampView

logger = logging.getLogger(__name__)


def _decay(age_days: float) -> float:
    return 0.55 + 0.45 / (1 + max(0.0, age_days) / 90)


async def recompute_hot(lamp_id: str) -> int:
    """Recompute and persist hot_score for one listing. Returns the new score."""
    async with session_scope() as s:
        lamp = (await s.execute(select(Lamp).where(Lamp.lamp_id == lamp_id))).scalar_one_or_none()
        if not lamp or lamp.status != LampStatus.ACTIVE.value:
            return 0
        views_row = (await s.execute(
            select(func.coalesce(func.sum(LampView.views), 0)).where(LampView.lamp_id == lamp_id)
        )).scalar() or 0
        rev = (await s.execute(
            select(func.count(), func.coalesce(func.avg(Review.stars), 0))
            .where(Review.lamp_id == lamp_id, Review.status == ReviewStatus.APPROVED.value)
        )).one()
        rev_count = int(rev[0] or 0)
        avg_stars = float(rev[1] or 0)
        age_days = max(0.0, (datetime.utcnow() - (lamp.created_at or datetime.utcnow())).total_seconds() / 86400)
        base = float(views_row) * 0.4 + rev_count * 12 + avg_stars * 9
        score = int(round(base * _decay(age_days)))
        lamp.hot_score = score
        await s.flush()
        return score


async def recompute_hot_soon(lamp_id: str) -> None:
    """Fire-and-forget recompute after a view."""
    import asyncio
    try:
        t = asyncio.get_running_loop().create_task(recompute_hot(lamp_id))
        # keep a weak ref so it is not GC'd immediately
        setattr(recompute_hot_soon, "_pending", getattr(recompute_hot_soon, "_pending", set()) | {t})
        t.add_done_callback(lambda x: getattr(recompute_hot_soon, "_pending", set()).discard(x))
    except RuntimeError:
        pass


async def set_boost(lamp_id: str, level: int, until: Optional[datetime]) -> Dict[str, Any]:
    """Admin sets paid boost. level=0 clears it."""
    async with session_scope() as s:
        lamp = (await s.execute(select(Lamp).where(Lamp.lamp_id == lamp_id))).scalar_one_or_none()
        if not lamp:
            raise ValueError("资料不存在")
        lamp.boost_level = max(0, int(level or 0))
        lamp.boost_until = until
        lamp.updated_at = datetime.utcnow()
        await s.flush()
        return {
            "lamp_id": lamp.lamp_id,
            "boost_level": lamp.boost_level,
            "boost_until": lamp.boost_until.isoformat() + "Z" if lamp.boost_until else None,
            "hot_score": lamp.hot_score,
        }


async def top_by_hot(city: Optional[str], limit: int = 20) -> List[Dict[str, Any]]:
    """Active listings ordered by active-boost then hot_score then created_at."""
    now = datetime.utcnow()
    async with session_scope() as s:
        stmt = select(Lamp).where(Lamp.status == LampStatus.ACTIVE.value)
        if city:
            stmt = stmt.where(Lamp.city == city)
        # Prefer active boosts, then hot_score, then recency
        stmt = stmt.order_by(
            (Lamp.boost_until > now).desc().nullslast(),
            Lamp.boost_level.desc(),
            Lamp.hot_score.desc(),
            Lamp.created_at.desc(),
        ).limit(max(1, min(limit, 100)))
        rows = list((await s.execute(stmt)).scalars().all())
    return [
        {
            "lamp_id": x.lamp_id,
            "title": x.title,
            "city": x.city,
            "district": x.district,
            "hot_score": int(x.hot_score or 0),
            "boost_level": int(x.boost_level or 0),
            "boost_until": x.boost_until.isoformat() + "Z" if x.boost_until else None,
            "cover_url": (x.photos or [None])[0] if x.photos else "",
        }
        for x in rows
    ]


async def backfill_hot(limit: int = 200) -> int:
    """One-pass recompute for active listings (call once after deploy)."""
    async with session_scope() as s:
        ids = list((await s.execute(
            select(Lamp.lamp_id).where(Lamp.status == LampStatus.ACTIVE.value).limit(limit)
        )).scalars().all())
    n = 0
    for lid in ids:
        try:
            await recompute_hot(lid)
            n += 1
        except Exception:
            logger.exception("backfill hot %s", lid)
    return n
