"""灯笼搜索（关键词 + 城市 + 价位 + 模糊距离）。"""

from __future__ import annotations

import math
import re
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import and_, or_, select

from bot.db import session_scope
from bot.models import Lamp, LampStatus


def _media_from_lamp(lamp: Lamp) -> List[Dict[str, str]]:
    raw = list(lamp.media or [])
    if raw:
        out = []
        for m in raw:
            if isinstance(m, dict) and m.get("url"):
                out.append({"type": m.get("type") or "image", "url": str(m["url"])})
            elif isinstance(m, str) and m.strip():
                out.append({"type": "image", "url": m.strip()})
        return out
    return [{"type": "image", "url": str(p)} for p in (lamp.photos or []) if p]


def _lamp_to_dict(lamp: Lamp) -> Dict[str, Any]:
    media = _media_from_lamp(lamp)
    photos = [m["url"] for m in media if m.get("type") == "image"] or list(lamp.photos or [])
    return {
        "lamp_id": lamp.lamp_id,
        "user_id": lamp.user_id,
        "city": lamp.city,
        "title": lamp.title,
        "tags": list(lamp.tags or []),
        "price": lamp.price,
        "price_text": lamp.price_text,
        "description": lamp.description or "",
        "photos": photos,
        "media": media,
        "district": getattr(lamp, "district", None),
        "approx_lat": getattr(lamp, "approx_lat", None),
        "approx_lng": getattr(lamp, "approx_lng", None),
        "approx_label": getattr(lamp, "approx_label", None),
        "publisher_role": getattr(lamp, "publisher_role", None),
        "authenticity_score": lamp.authenticity_score,
        "credit_boost": lamp.credit_boost,
        "status": lamp.status,
        "created_at": lamp.created_at,
        "updated_at": lamp.updated_at,
    }


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(a)))


def fuzzy_distance_label(km: Optional[float]) -> Optional[str]:
    if km is None:
        return None
    if km < 1.0:
        return "附近"
    if km < 3.0:
        return "约1-3km"
    if km < 5.0:
        return "约3-5km"
    if km < 10.0:
        return "约5-10km"
    return "稍远"


def attach_fuzzy_distance(lamp: Dict[str, Any], lat: Optional[float], lng: Optional[float]) -> Dict[str, Any]:
    out = dict(lamp)
    label = out.get("approx_label")
    if lat is not None and lng is not None and out.get("approx_lat") is not None and out.get("approx_lng") is not None:
        try:
            km = haversine_km(float(lat), float(lng), float(out["approx_lat"]), float(out["approx_lng"]))
            label = fuzzy_distance_label(km) or label
            out["_distance_km"] = round(km, 2)
        except (TypeError, ValueError):
            pass
    out["fuzzy_distance"] = label
    return out


def parse_query(text: str) -> Dict[str, Any]:
    city = None
    for c in ["台北", "台中", "高雄", "新北", "桃园", "台南", "基隆", "新竹", "香港", "澳门", "深圳", "广州", "上海", "北京", "杭州", "成都", "武汉", "南京", "东莞", "佛山", "珠海", "厦门", "福州"]:
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
    return {"city": city, "price_min": price_min, "price_max": price_max, "keywords": keywords, "raw": text}


async def search_lamps(*, keyword: str | None = None, city: str | None = None, price_min: int | None = None, price_max: int | None = None, limit: int = 15, lat: float | None = None, lng: float | None = None) -> List[Dict[str, Any]]:
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
                conditions.append(or_(Lamp.title.ilike(like), Lamp.description.ilike(like), Lamp.city.ilike(like)))
        stmt = select(Lamp).where(and_(*conditions)).order_by(Lamp.authenticity_score.desc(), Lamp.updated_at.desc()).limit(limit)
        res = await s.execute(stmt)
        items = [_lamp_to_dict(x) for x in res.scalars().all()]
    enriched = [attach_fuzzy_distance(x, lat, lng) for x in items]
    if lat is not None and lng is not None:
        enriched.sort(key=lambda x: x.get("_distance_km") if x.get("_distance_km") is not None else 1e9)
    for x in enriched:
        x.pop("_distance_km", None)
    return enriched


async def list_active_lamps(city: str | None = None, limit: int = 20) -> List[Dict[str, Any]]:
    return await search_lamps(city=city, limit=limit)


async def get_lamp(lamp_id: str) -> Optional[Dict[str, Any]]:
    async with session_scope() as s:
        res = await s.execute(select(Lamp).where(Lamp.lamp_id == lamp_id))
        lamp = res.scalar_one_or_none()
        return _lamp_to_dict(lamp) if lamp else None


async def create_lamp_from_post(user_id: int, city: str, title: str, tags: List[str], price: Optional[int], price_text: Optional[str], description: str, photos: List[str], authenticity_score: int = 80, *, district: Optional[str] = None, approx_lat: Optional[float] = None, approx_lng: Optional[float] = None, approx_label: Optional[str] = None, media: Optional[List[Dict[str, str]]] = None, publisher_role: Optional[str] = None) -> Dict[str, Any]:
    lamp_id = str(uuid.uuid4())
    media_list = list(media or [])
    if not media_list and photos:
        media_list = [{"type": "image", "url": p} for p in photos]
    photo_urls = [m["url"] for m in media_list if m.get("type") == "image"] or list(photos or [])
    async with session_scope() as s:
        lamp = Lamp(lamp_id=lamp_id, user_id=user_id, city=city, title=title, tags=tags or [], price=price, price_text=price_text, description=description or "", photos=photo_urls, media=media_list, district=district, approx_lat=approx_lat, approx_lng=approx_lng, approx_label=approx_label, publisher_role=publisher_role, authenticity_score=authenticity_score, status=LampStatus.PENDING.value)
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
    title = lamp.get("title") or "未命名"
    city = lamp.get("city") or "未知"
    district = lamp.get("district") or ""
    loc = f"{city}" + (f" · {district}" if district else "")
    lines = [f"🌕 <b>{title}</b>", f"📍 {loc}  |  💰 {price}", f"🏷 {tags}", f"✅ 口碑分 {auth}", f"<code>{lamp.get('lamp_id', '')}</code>"]
    desc = (lamp.get("description") or "").strip()
    if desc:
        lines.append("")
        lines.append(desc[:200] + ("…" if len(desc) > 200 else ""))
    return "\n".join(lines)
