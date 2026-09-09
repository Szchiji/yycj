"""首页运营：公告、启用城市、精选置顶、评价、演示种子数据。"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import and_, or_, select

from bot.db import session_scope
from bot.models import HomepagePin, Lamp, LampStatus, Review, ReviewStatus, SiteSettings
from bot.services import search_service

logger = logging.getLogger(__name__)

DEFAULT_CITIES = ["深圳", "广州", "东莞", "佛山", "珠海", "惠州"]
SETTINGS_KEY = "default"

SCORING_RULES = {
    "title": "口碑分说明",
    "items": [
        "口碑分综合展示资料完整度、互动质量与过往评价。",
        "基础分约 80；审核通过与优质互动可缓慢提升。",
        "有效举报成立会下调；恶意举报会被扣分。",
        "评价经管理员审核后才会展示，刷评将被拒绝。",
        "分数仅供参考，请自行判断并理性沟通。",
    ],
}


def _settings_to_dict(row: SiteSettings) -> Dict[str, Any]:
    cities = list(row.enabled_cities or []) or list(DEFAULT_CITIES)
    return {
        "announcement_text": row.announcement_text or "",
        "announcement_enabled": bool(row.announcement_enabled),
        "enabled_cities": cities,
        "updated_at": row.updated_at,
    }


async def get_or_create_settings() -> Dict[str, Any]:
    async with session_scope() as s:
        res = await s.execute(select(SiteSettings).where(SiteSettings.key == SETTINGS_KEY))
        row = res.scalar_one_or_none()
        if not row:
            row = SiteSettings(
                key=SETTINGS_KEY,
                announcement_text="欢迎使用月影车姬 · 请文明交流，理性选择。",
                announcement_enabled=True,
                enabled_cities=list(DEFAULT_CITIES),
            )
            s.add(row)
            await s.flush()
        return _settings_to_dict(row)


async def update_settings(
    *,
    announcement_text: Optional[str] = None,
    announcement_enabled: Optional[bool] = None,
    enabled_cities: Optional[List[str]] = None,
) -> Dict[str, Any]:
    async with session_scope() as s:
        res = await s.execute(select(SiteSettings).where(SiteSettings.key == SETTINGS_KEY))
        row = res.scalar_one_or_none()
        if not row:
            row = SiteSettings(key=SETTINGS_KEY)
            s.add(row)
            await s.flush()
        if announcement_text is not None:
            row.announcement_text = announcement_text[:2000]
        if announcement_enabled is not None:
            row.announcement_enabled = bool(announcement_enabled)
        if enabled_cities is not None:
            cleaned = [c.strip()[:32] for c in enabled_cities if (c or "").strip()]
            row.enabled_cities = cleaned[:50] or list(DEFAULT_CITIES)
        row.updated_at = datetime.utcnow()
        await s.flush()
        return _settings_to_dict(row)


async def list_active_pins() -> List[Dict[str, Any]]:
    now = datetime.utcnow()
    async with session_scope() as s:
        res = await s.execute(
            select(HomepagePin)
            .where(or_(HomepagePin.expires_at.is_(None), HomepagePin.expires_at > now))
            .order_by(HomepagePin.sort_order.asc(), HomepagePin.id.asc())
        )
        pins = list(res.scalars().all())
    out: List[Dict[str, Any]] = []
    for p in pins:
        lamp = await search_service.get_lamp(p.lamp_id)
        if not lamp or lamp.get("status") != LampStatus.ACTIVE.value:
            continue
        out.append({"id": p.id, "lamp_id": p.lamp_id, "sort_order": p.sort_order, "expires_at": p.expires_at, "lamp": lamp})
    return out


async def list_all_pins() -> List[Dict[str, Any]]:
    async with session_scope() as s:
        res = await s.execute(select(HomepagePin).order_by(HomepagePin.sort_order.asc(), HomepagePin.id.asc()))
        pins = list(res.scalars().all())
    out = []
    for p in pins:
        lamp = await search_service.get_lamp(p.lamp_id)
        out.append({"id": p.id, "lamp_id": p.lamp_id, "sort_order": p.sort_order, "expires_at": p.expires_at, "created_at": p.created_at, "created_by": p.created_by, "lamp": lamp})
    return out


async def add_pin(lamp_id: str, *, sort_order: int = 0, expires_at: Optional[datetime] = None, expires_hours: Optional[int] = None, created_by: Optional[int] = None) -> Dict[str, Any]:
    lamp = await search_service.get_lamp(lamp_id)
    if not lamp:
        raise ValueError("灯笼不存在")
    if expires_hours is not None and expires_at is None:
        expires_at = datetime.utcnow() + timedelta(hours=max(1, int(expires_hours)))
    async with session_scope() as s:
        res = await s.execute(select(HomepagePin).where(HomepagePin.lamp_id == lamp_id))
        pin = res.scalar_one_or_none()
        if pin:
            pin.sort_order = int(sort_order)
            pin.expires_at = expires_at
            if created_by is not None:
                pin.created_by = created_by
        else:
            pin = HomepagePin(lamp_id=lamp_id, sort_order=int(sort_order), expires_at=expires_at, created_by=created_by)
            s.add(pin)
        await s.flush()
        return {"id": pin.id, "lamp_id": pin.lamp_id, "sort_order": pin.sort_order, "expires_at": pin.expires_at}


async def remove_pin(pin_id: int) -> bool:
    async with session_scope() as s:
        res = await s.execute(select(HomepagePin).where(HomepagePin.id == pin_id))
        pin = res.scalar_one_or_none()
        if not pin:
            return False
        s.delete(pin)
        return True


async def reorder_pins(ordered_ids: List[int]) -> List[Dict[str, Any]]:
    async with session_scope() as s:
        for idx, pid in enumerate(ordered_ids):
            res = await s.execute(select(HomepagePin).where(HomepagePin.id == int(pid)))
            pin = res.scalar_one_or_none()
            if pin:
                pin.sort_order = idx
        await s.flush()
    return await list_all_pins()


def _review_to_dict(r: Review) -> Dict[str, Any]:
    return {"review_id": r.review_id, "session_id": r.session_id, "lamp_id": r.lamp_id, "target_user_id": r.target_user_id, "guest_id": r.guest_id, "stars": r.stars, "text": r.text or "", "photos": list(r.photos or []), "status": r.status, "created_at": r.created_at, "reviewed_at": r.reviewed_at, "review_note": r.review_note}


async def create_review(*, guest_id: int, lamp_id: str, stars: int, text: str = "", photos: Optional[List[str]] = None, session_id: Optional[str] = None, target_user_id: Optional[int] = None) -> Dict[str, Any]:
    stars = max(1, min(5, int(stars)))
    review_id = str(uuid.uuid4())
    async with session_scope() as s:
        r = Review(review_id=review_id, session_id=session_id, lamp_id=lamp_id, target_user_id=target_user_id, guest_id=guest_id, stars=stars, text=(text or "")[:2000], photos=list(photos or [])[:6], status=ReviewStatus.PENDING.value)
        s.add(r)
        await s.flush()
        return _review_to_dict(r)


async def list_reviews_for_lamp(lamp_id: str, *, approved_only: bool = True) -> List[Dict[str, Any]]:
    async with session_scope() as s:
        cond = [Review.lamp_id == lamp_id]
        if approved_only:
            cond.append(Review.status == ReviewStatus.APPROVED.value)
        res = await s.execute(select(Review).where(and_(*cond)).order_by(Review.created_at.desc()).limit(50))
        return [_review_to_dict(x) for x in res.scalars().all()]


async def list_pending_reviews(limit: int = 50) -> List[Dict[str, Any]]:
    async with session_scope() as s:
        res = await s.execute(select(Review).where(Review.status == ReviewStatus.PENDING.value).order_by(Review.created_at.asc()).limit(max(1, min(limit, 200))))
        return [_review_to_dict(x) for x in res.scalars().all()]


async def list_my_reviews(guest_id: int, limit: int = 30) -> List[Dict[str, Any]]:
    async with session_scope() as s:
        res = await s.execute(select(Review).where(Review.guest_id == guest_id).order_by(Review.created_at.desc()).limit(max(1, min(limit, 100))))
        return [_review_to_dict(x) for x in res.scalars().all()]


async def set_review_status(review_id: str, status: str, *, note: Optional[str] = None) -> Dict[str, Any]:
    if status not in {ReviewStatus.APPROVED.value, ReviewStatus.REJECTED.value, ReviewStatus.BRUSH.value}:
        raise ValueError("无效评价状态")
    async with session_scope() as s:
        res = await s.execute(select(Review).where(Review.review_id == review_id))
        r = res.scalar_one_or_none()
        if not r:
            raise LookupError("评价不存在")
        if r.status != ReviewStatus.PENDING.value:
            raise RuntimeError("已处理或不在待审状态")
        r.status = status
        r.reviewed_at = datetime.utcnow()
        if note:
            r.review_note = note[:256]
        await s.flush()
        return _review_to_dict(r)


async def reputation_for_lamp(lamp_id: str) -> Dict[str, Any]:
    lamp = await search_service.get_lamp(lamp_id)
    base = int((lamp or {}).get("authenticity_score") or 80)
    reviews = await list_reviews_for_lamp(lamp_id, approved_only=True)
    if reviews:
        avg = sum(int(r["stars"]) for r in reviews) / len(reviews)
        star_score = avg * 20
        score = int(round(base * 0.6 + star_score * 0.4))
    else:
        score = base
        avg = None
    return {"score": max(0, min(100, score)), "base": base, "review_count": len(reviews), "avg_stars": round(avg, 2) if avg is not None else None, "rules": SCORING_RULES}


async def seed_demo_if_empty() -> Dict[str, Any]:
    await get_or_create_settings()
    async with session_scope() as s:
        res = await s.execute(select(Lamp).where(Lamp.status == LampStatus.ACTIVE.value).limit(1))
        if res.scalar_one_or_none():
            return {"seeded": False, "reason": "already_has_active"}
    demos = [
        {"title": "小月", "city": "深圳", "district": "南山区", "approx_label": "附近", "approx_lat": 22.5333, "approx_lng": 113.9300, "price_text": "面议", "tags": ["清新", "健谈"], "description": "演示资料 · 月影车姬首页预览用。", "media": [{"type": "image", "url": "https://picsum.photos/seed/yycj1/600/800"}], "publisher_role": "teacher", "authenticity_score": 86},
        {"title": "阿影", "city": "深圳", "district": "福田区", "approx_label": "约1-3km", "approx_lat": 22.5400, "approx_lng": 114.0550, "price_text": "6000+", "tags": ["成熟", "有礼"], "description": "演示资料二 · 仅供界面联调。", "media": [{"type": "image", "url": "https://picsum.photos/seed/yycj2/600/800"}], "publisher_role": "teacher", "authenticity_score": 82},
        {"title": "商家演示", "city": "深圳", "district": "罗湖区", "approx_label": "约3-5km", "approx_lat": 22.5480, "approx_lng": 114.1200, "price_text": "套餐详询", "tags": ["商家", "可约"], "description": "商家身份发布演示。", "media": [{"type": "image", "url": "https://picsum.photos/seed/yycj3/600/800"}], "publisher_role": "merchant", "authenticity_score": 78},
    ]
    created = []
    for d in demos:
        lamp = await search_service.create_lamp_from_post(user_id=0, city=d["city"], title=d["title"], tags=d["tags"], price=None, price_text=d["price_text"], description=d["description"], photos=[], authenticity_score=d["authenticity_score"], district=d["district"], approx_lat=d["approx_lat"], approx_lng=d["approx_lng"], approx_label=d["approx_label"], media=d["media"], publisher_role=d["publisher_role"])
        await search_service.approve_lamp(lamp["lamp_id"])
        created.append(lamp["lamp_id"])
    if created:
        await add_pin(created[0], sort_order=0, expires_hours=72 * 24, created_by=0)
    logger.info("Seeded %s demo lamps for 月影车姬", len(created))
    return {"seeded": True, "lamp_ids": created}
