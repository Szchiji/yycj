"""月影车姬 API：发布 / 举报 / 评价。"""
from __future__ import annotations

import logging
import uuid
from typing import Any, Dict

from fastapi import Depends, HTTPException

from bot.api.deps import get_current_user_id
from bot.config import get_settings
from bot.db import session_scope
from bot.models import Post, PostStatus, Report, ReportStatus, UserRole
from bot.services import anti_brush, credit_service, home_service, search_service
from bot.api.routes_core import (
    router,
    PostCreateBody as _PostCreateBody,
    ReportCreateBody,
    ReviewCreateBody,
    _ser_dt,
    _normalize_media,
    _normalize_one_url,
    _ROLE_LABEL,
)

logger = logging.getLogger(__name__)


class PostCreateBody(_PostCreateBody):
    extras: Dict[str, Any] | None = None


@router.post("/posts")
async def api_create_post(
    body: PostCreateBody,
    user_id: int = Depends(get_current_user_id),
) -> Dict[str, Any]:
    u = await credit_service.ensure_user(user_id)
    if u.get("is_shadowed"):
        raise HTTPException(status_code=403, detail="月影遮蔽中，暂时无法发布")
    role = u.get("role")
    if role not in (UserRole.TEACHER.value, UserRole.MERCHANT.value):
        raise HTTPException(status_code=403, detail="仅老师或商家可发布，请先在「我的」切换身份")
    if not await anti_brush.check_post_rate(user_id):
        raise HTTPException(status_code=429, detail="投稿过于频繁，请一小时后再试")
    desc = (body.description or "").strip()
    if desc and await anti_brush.text_too_similar(user_id, desc):
        raise HTTPException(status_code=400, detail="内容与近期投稿过于相似")

    media = _normalize_media(body.media, body.photos)
    photos = [m["url"] for m in media if m["type"] == "image"]

    settings = await home_service.get_or_create_settings()
    city = (body.city or "").strip()[:32] or "未知"
    enabled = settings.get("enabled_cities") or []
    if enabled and city not in enabled:
        raise HTTPException(status_code=400, detail="该城市暂未开放发布")

    tags = [t.strip()[:24] for t in (body.tags or []) if (t or "").strip()][:5]

    lamp_data = {
        "city": city,
        "title": (body.title or "").strip()[:64] or "未命名",
        "tags": tags,
        "price": body.price,
        "price_text": (body.price_text or (str(body.price) if body.price else "面议"))[:32],
        "description": desc[:2000],
        "photos": photos,
        "media": media,
        "district": (body.district or "").strip()[:64] or None,
        "approx_lat": body.approx_lat,
        "approx_lng": body.approx_lng,
        "approx_label": (body.approx_label or "").strip()[:128] or None,
        "publisher_role": role,
        "extras": dict(body.extras or {}),
    }
    post_id = str(uuid.uuid4())
    async with session_scope() as s:
        s.add(
            Post(
                post_id=post_id,
                user_id=user_id,
                lamp_data=lamp_data,
                status=PostStatus.PENDING.value,
            )
        )

    try:
        from bot.services.listing_notify import notify_admins_new_post
        await notify_admins_new_post(post_id, user_id, lamp_data)
    except Exception:
        logger.exception("notify admins of post failed")

    return {
        "ok": True,
        "post_id": post_id,
        "status": PostStatus.PENDING.value,
        "media": media,
        "photos": photos,
    }


@router.post("/reports")
async def api_create_report(
    body: ReportCreateBody,
    user_id: int = Depends(get_current_user_id),
) -> Dict[str, Any]:
    if not await anti_brush.check_report_rate(user_id):
        raise HTTPException(status_code=429, detail="报告过于频繁")
    lamp_id = (body.lamp_id or "").strip()
    if not lamp_id:
        raise HTTPException(status_code=400, detail="缺少 lamp_id")
    lamp = await search_service.get_lamp(lamp_id)
    report_id = str(uuid.uuid4())
    async with session_scope() as s:
        s.add(
            Report(
                report_id=report_id,
                lamp_id=lamp_id,
                reporter_id=user_id,
                reason=(body.reason or "未说明")[:64],
                description=(body.description or "")[:2000],
                status=ReportStatus.PENDING.value,
            )
        )

    try:
        from bot.main import bot
        from bot.keyboards import admin_report_kb

        title = (lamp or {}).get("title") if lamp else "-"
        card = (
            f"⚠️ 新举报（月影车姬） <code>{report_id[:8]}</code>\n"
            f"资料：<code>{lamp_id[:8]}</code>… {title}\n"
            f"举报人：{user_id}\n"
            f"原因：{body.reason}\n"
            f"{(body.description or '')[:300]}"
        )
        for admin_id in get_settings().admin_id_list:
            try:
                await bot.send_message(admin_id, card, reply_markup=admin_report_kb(report_id))
            except Exception:
                pass
    except Exception:
        logger.exception("notify admins of report failed")

    return {"ok": True, "report_id": report_id, "status": ReportStatus.PENDING.value}


@router.post("/reviews")
async def api_create_review(
    body: ReviewCreateBody,
    user_id: int = Depends(get_current_user_id),
) -> Dict[str, Any]:
    u = await credit_service.ensure_user(user_id)
    if u.get("role") and u.get("role") != UserRole.GUEST.value:
        raise HTTPException(status_code=403, detail="评价需以客人身份提交")
    lamp = await search_service.get_lamp(body.lamp_id)
    if not lamp:
        raise HTTPException(status_code=404, detail="资料不存在")
    target = lamp.get("user_id")
    photos = []
    for p in body.photos or []:
        s = (p or "").strip()
        if s:
            photos.append(_normalize_one_url(s))
    try:
        rev = await home_service.create_review(
            guest_id=user_id,
            lamp_id=body.lamp_id,
            stars=body.stars,
            text=body.text,
            photos=photos[:6],
            session_id=body.session_id,
            target_user_id=int(target) if target else None,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    rev["created_at"] = _ser_dt(rev.get("created_at"))
    return {"ok": True, "review": rev}


@router.get("/reviews/mine")
async def api_my_reviews(user_id: int = Depends(get_current_user_id)) -> Dict[str, Any]:
    items = await home_service.list_my_reviews(user_id)
    for r in items:
        r["created_at"] = _ser_dt(r.get("created_at"))
        r["reviewed_at"] = _ser_dt(r.get("reviewed_at"))
    return {"ok": True, "items": items}
