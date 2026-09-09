"""灯笼搜索（关键词 + 城市 + 价位，无 AI）。"""

from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import and_, or_, select

from bot.db import session_scope
from bot.models import Lamp, LampStatus


def _lamp_to_dict(lamp: Lamp) -> Dict[str, Any]:
    return {
        "lamp_id": lamp.lamp_id,
        "user_id": lamp.user_id,
        "city": lamp.city,
        "title": lamp.title,
        "tags": list(lamp.tags or []),
        "price": lamp.price,
        "price_text": lamp.price_text,
        "description": lamp.description or "",
        "photos": list(lamp.photos or []),
        "authenticity_score": lamp.authenticity_score,
        "credit_boost": lamp.credit_boost,
        "status": lamp.status,
        "created_at": lamp.created_at,
        "updated_at": lamp.updated_at,
    }


def parse_query(text: str) -> Dict[str, Any]:
    """从自然语言抽出城市、价位、关键词。"""
    city = None
    for c in [
        "台北", "台中", "高雄", "新北", "桃园", "台南", "基隆", "新竹",
        "香港", "澳门", "深圳", "广州", "上海", "北京", "杭州", "成都",
        "武汉", "南京", "东莞", "佛山", "珠海", "厦门", "福州",
    ]:
        if c in text:
            city = c
            break

    prices = [int(p) for p in re.findall(r"(\d{3,6})", text)]
    price_min = price_max = None
    if len(prices) >= 2:
        price_min, price_max = min(prices), max(prices)
    elif len(prices) == 1:
        p = prices[0]
        price_min, price_max = int(p * 0.7), int(p * 1.3)

    kw = text
    if city:
        kw = kw.replace(city, " ")
    kw = re.sub(r"\d{3,6}", " ", kw)
    keywords = [t for t in re.split(r"[\s,，、/|]+", kw) if t.strip()]
    return {
        "city": city,
        "price_min": price_min,
        "price_max": price_max,
        "keywords": keywords,
        "raw": text,
    }


async def search_lamps(
    *,
    keyword: str | None = None,
    city: str | None = None,
    price_min: int | None = None,
    price_max: int | None = None,
    limit: int = 15,
) -> List[Dict[str, Any]]:
    async with session_scope() as s:
        conditions = [Lamp.status == LampStatus.ACTIVE.value]

        if city:
            conditions.append(Lamp.city == city)
        if price_min is not None:
            conditions.append(or_(Lamp.price.is_(None), Lamp.price >= price_min))
        if price_max is not None:
            conditions.append(or_(Lamp.price.is_(None), Lamp.price <= price_max))

        if keyword:
            parsed = parse_query(keyword)
            if parsed["city"] and not city:
                conditions.append(Lamp.city == parsed["city"])
            if parsed["price_min"] is not None and price_min is None:
                conditions.append(or_(Lamp.price.is_(None), Lamp.price >= parsed["price_min"]))
            if parsed["price_max"] is not None and price_max is None:
                conditions.append(or_(Lamp.price.is_(None), Lamp.price <= parsed["price_max"]))

            for kw in (parsed["keywords"] or [keyword]):
                like = f"%{kw}%"
                conditions.append(
                    or_(
                        Lamp.title.ilike(like),
                        Lamp.description.ilike(like),
                        Lamp.city.ilike(like),
                    )
                )

        stmt = (
            select(Lamp)
            .where(and_(*conditions))
            .order_by(Lamp.authenticity_score.desc(), Lamp.updated_at.desc())
            .limit(limit)
        )
        res = await s.execute(stmt)
        return [_lamp_to_dict(x) for x in res.scalars().all()]


async def list_active_lamps(city: str | None = None, limit: int = 20) -> List[Dict[str, Any]]:
    return await search_lamps(city=city, limit=limit)


async def get_lamp(lamp_id: str) -> Optional[Dict[str, Any]]:
    async with session_scope() as s:
        res = await s.execute(select(Lamp).where(Lamp.lamp_id == lamp_id))
        lamp = res.scalar_one_or_none()
        return _lamp_to_dict(lamp) if lamp else None


async def create_lamp_from_post(
    user_id: int,
    city: str,
    title: str,
    tags: List[str],
    price: Optional[int],
    price_text: Optional[str],
    description: str,
    photos: List[str],
    authenticity_score: int = 80,
) -> Dict[str, Any]:
    lamp_id = str(uuid.uuid4())
    async with session_scope() as s:
        lamp = Lamp(
            lamp_id=lamp_id,
            user_id=user_id,
            city=city,
            title=title,
            tags=tags or [],
            price=price,
            price_text=price_text,
            description=description or "",
            photos=photos or [],
            authenticity_score=authenticity_score,
            status=LampStatus.PENDING.value,
        )
        s.add(lamp)
        await s.flush()
        return _lamp_to_dict(lamp)


async def approve_lamp(lamp_id: str) -> None:
    async with session_scope() as s:
        res = await s.execute(select(Lamp).where(Lamp.lamp_id == lamp_id))
        lamp = res.scalar_one_or_none()
        if lamp:
            lamp.status = LampStatus.ACTIVE.value
            lamp.updated_at = datetime.utcnow()


async def reject_lamp(lamp_id: str) -> None:
    async with session_scope() as s:
        res = await s.execute(select(Lamp).where(Lamp.lamp_id == lamp_id))
        lamp = res.scalar_one_or_none()
        if lamp:
            lamp.status = LampStatus.REJECTED.value
            lamp.updated_at = datetime.utcnow()


def format_lamp_card(lamp: Dict[str, Any]) -> str:
    tags = " · ".join(lamp.get("tags") or []) or "无标签"
    price = lamp.get("price_text") or (str(lamp.get("price")) if lamp.get("price") else "面议")
    auth = lamp.get("authenticity_score", 80)
    lines = [
        f"🌕 **{lamp.get('title', '未命名灯笼')}**",
        f"📍 {lamp.get('city', '未知')}  |  💰 {price}",
        f"🏷 {tags}",
        f"✅ 真实度 {auth}%",
    ]
    desc = (lamp.get("description") or "").strip()
    if desc:
        lines.append("")
        lines.append(desc[:200] + ("…" if len(desc) > 200 else ""))
    return "\n".join(lines)
