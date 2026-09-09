"""灯笼检索与匹配封装。"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from bot.db import get_db
from bot.models import LampStatus
from bot.services import ai_service


async def list_active_lamps(city: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
    db = get_db()
    query: Dict[str, Any] = {"status": LampStatus.ACTIVE.value}
    if city:
        query["city"] = city
    cursor = db.lamps.find(query).sort("updated_at", -1).limit(limit)
    return [doc async for doc in cursor]


async def get_lamp(lamp_id: str) -> Optional[Dict[str, Any]]:
    return await get_db().lamps.find_one({"lamp_id": lamp_id})


async def search_and_match(user_query: str) -> Dict[str, Any]:
    extracted = ai_service.rule_extract_query(user_query)
    lamps = await list_active_lamps(city=extracted.get("city"), limit=40)
    if not lamps:
        lamps = await list_active_lamps(limit=40)
    return await ai_service.match_lamps(user_query, lamps)


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
    db = get_db()
    lamp_id = str(uuid.uuid4())
    doc = {
        "lamp_id": lamp_id,
        "user_id": user_id,
        "city": city,
        "title": title,
        "tags": tags,
        "price": price,
        "price_text": price_text,
        "description": description,
        "photos": photos,
        "authenticity_score": authenticity_score,
        "credit_boost": 0,
        "status": LampStatus.PENDING.value,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    await db.lamps.insert_one(doc)
    return doc


async def approve_lamp(lamp_id: str) -> None:
    await get_db().lamps.update_one(
        {"lamp_id": lamp_id},
        {"$set": {"status": LampStatus.ACTIVE.value, "updated_at": datetime.utcnow()}},
    )


async def reject_lamp(lamp_id: str) -> None:
    await get_db().lamps.update_one(
        {"lamp_id": lamp_id},
        {"$set": {"status": LampStatus.REJECTED.value, "updated_at": datetime.utcnow()}},
    )


def format_lamp_card(lamp: Dict[str, Any], match_score: Optional[int] = None) -> str:
    tags = " · ".join(lamp.get("tags") or []) or "无标签"
    price = lamp.get("price_text") or (str(lamp.get("price")) if lamp.get("price") else "面议")
    auth = lamp.get("authenticity_score", 80)
    lines = [
        f"🌕 **{lamp.get('title', '未命名灯笼')}**",
        f"📍 {lamp.get('city', '未知')}  |  💰 {price}",
        f"🏷 {tags}",
        f"✅ 真实度 {auth}%",
    ]
    if match_score is not None:
        lines.append(f"💫 匹配度 {match_score}%")
    desc = (lamp.get("description") or "").strip()
    if desc:
        lines.append("")
        lines.append(desc[:200] + ("…" if len(desc) > 200 else ""))
    return "\n".join(lines)
