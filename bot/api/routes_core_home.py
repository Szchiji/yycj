"""月影车姬 API 核心 — home / lamps / sessions。"""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from fastapi import Depends, HTTPException, Query

from bot.api.deps import get_current_user_id
from bot.api.routes_core_base import (
    SessionRequestBody,
    _ser_dt,
    _ser_lamp,
    router,
)
from bot.services import anti_brush, credit_service, home_service, search_service, session_service

logger = logging.getLogger(__name__)


@router.get("/home")
async def api_home(
    city: Optional[str] = None,
    q: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    limit: int = Query(default=3, ge=1, le=50),
    offset: int = Query(default=0, ge=0, le=500),
    user_id: int = Depends(get_current_user_id),
) -> Dict[str, Any]:
    settings = await home_service.get_or_create_settings()
    page_size = int(settings.get("home_feed_page_size") or 3)
    if limit == 3 and page_size != 3:
        limit = page_size
    enabled = list(settings.get("enabled_cities") or [])
    if city and enabled and city not in enabled:
        raise HTTPException(status_code=400, detail="该城市暂未开放")
    use_city = city if city else (enabled[0] if enabled else None)

    pins_raw = await home_service.list_active_pins()
    pins = []
    for p in pins_raw:
        lamp = p.get("lamp") or {}
        if use_city and lamp.get("city") and lamp.get("city") != use_city:
            continue
        lamp = search_service.attach_fuzzy_distance(lamp, lat, lng)
        lamp.pop("_distance_km", None)
        pins.append(
            {
                "id": p["id"],
                "sort_order": p["sort_order"],
                "expires_at": _ser_dt(p.get("expires_at")),
                "lamp": _ser_lamp(lamp),
            }
        )

    items = await search_service.search_lamps(
        keyword=q,
        city=use_city,
        limit=limit,
        offset=offset,
        lat=lat,
        lng=lng,
    )
    pinned = [x for x in items if x.get("feed_pinned")]
    fresh = [x for x in items if not x.get("feed_pinned")]
    pinned.sort(key=lambda x: int(x.get("feed_pin_order") or 0))
    fresh.sort(key=lambda x: str(x.get("created_at") or x.get("updated_at") or ""), reverse=True)
    items = pinned + fresh
    announcement = None
    if settings.get("announcement_enabled") and settings.get("announcement_text"):
        announcement = {"text": settings["announcement_text"], "enabled": True}

    return {
        "ok": True,
        "city": use_city,
        "enabled_cities": enabled,
        "announcement": announcement,
        "pins": pins,
        "items": [_ser_lamp(x) for x in items],
        "count": len(items),
        "limit": limit,
        "offset": offset,
        "has_more": len(items) >= limit,
        "scoring_rules": home_service.SCORING_RULES,
        "chat_cta_label": settings.get("chat_cta_label") or "想聊聊",
        "show_chat_cta": settings.get("show_chat_cta") is not False,
        "media_max_count": int(settings.get("media_max_count") or 6),
        "page_size": int(settings.get("home_feed_page_size") or 3),
        "carousel_interval_sec": int(settings.get("carousel_interval_sec") or 4),
        "contacts": await _home_contacts(settings),
        "listing_fields": settings.get("listing_fields") or [],
    }


async def _home_contacts(settings: Dict[str, Any]) -> Dict[str, Any]:
    from bot.services import bot_info
    ident = await bot_info.get_bot_identity()
    bot_url = bot_info.bot_tme_url(ident.get("username"))
    admin_url = bot_info.normalize_contact(settings.get("admin_contact") or "")
    return {
        "bot_username": ident.get("username") or "",
        "bot_url": bot_url,
        "admin_url": admin_url,
        "show_bot": bool(settings.get("show_bot_link", True)) and bool(bot_url),
        "show_admin": bool(settings.get("show_admin_link", True)) and bool(admin_url),
        "bot_label": settings.get("bot_btn_label") or "机器人",
        "admin_label": settings.get("admin_btn_label") or "管理员",
    }


@router.get("/cities")
async def api_cities(user_id: int = Depends(get_current_user_id)) -> Dict[str, Any]:
    settings = await home_service.get_or_create_settings()
    return {"ok": True, "cities": settings.get("enabled_cities") or []}


@router.get("/lamps")
async def api_lamps(
    q: Optional[str] = None,
    city: Optional[str] = None,
    price_min: Optional[int] = None,
    price_max: Optional[int] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    limit: int = Query(default=20, ge=1, le=50),
    user_id: int = Depends(get_current_user_id),
) -> Dict[str, Any]:
    if not await anti_brush.check_search_rate(user_id):
        raise HTTPException(status_code=429, detail="搜索过于频繁，请稍后再试")
    items = await search_service.search_lamps(
        keyword=q, city=city, price_min=price_min, price_max=price_max, limit=limit, lat=lat, lng=lng
    )
    return {"ok": True, "items": [_ser_lamp(x) for x in items], "count": len(items)}


@router.get("/lamps/{lamp_id}")
async def api_lamp_detail(
    lamp_id: str,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    user_id: int = Depends(get_current_user_id),
) -> Dict[str, Any]:
    lamp = await search_service.get_lamp(lamp_id)
    if not lamp or lamp.get("status") != "active":
        raise HTTPException(status_code=404, detail="资料不存在或未上架")
    lamp = search_service.attach_fuzzy_distance(lamp, lat, lng)
    lamp.pop("_distance_km", None)
    rep = await home_service.reputation_for_lamp(lamp_id)
    reviews = await home_service.list_reviews_for_lamp(lamp_id, approved_only=True)
    for r in reviews:
        r["created_at"] = _ser_dt(r.get("created_at"))
        r.pop("guest_id", None)
        r.pop("target_user_id", None)
    return {"ok": True, "lamp": _ser_lamp(lamp), "reputation": rep, "reviews": reviews}


@router.post("/sessions/request")
async def api_session_request(
    body: SessionRequestBody,
    user_id: int = Depends(get_current_user_id),
) -> Dict[str, Any]:
    lamp = await search_service.get_lamp(body.lamp_id)
    if not lamp or lamp.get("status") != "active":
        raise HTTPException(status_code=404, detail="资料不存在或未上架")
    if lamp["user_id"] == user_id:
        raise HTTPException(status_code=400, detail="不能与自己发起会话")
    u = await credit_service.ensure_user(user_id)
    if u.get("is_shadowed"):
        raise HTTPException(status_code=403, detail="月影遮蔽中，暂时无法发起会话")
    if not await anti_brush.check_session_request_rate(user_id):
        raise HTTPException(status_code=429, detail="请求过于频繁")
    existing = await session_service.get_active_for_user(user_id)
    if existing:
        raise HTTPException(status_code=400, detail="已有进行中的会话，请先结束")
    alias = (body.guest_alias or "").strip()
    if not alias:
        me = await credit_service.ensure_user(user_id)
        alias = (me.get("guest_alias") or "").strip() or None
    sess = await session_service.create_request(
        body.lamp_id, user_id, lamp["user_id"], lamp_title=lamp.get("title"), guest_alias=alias
    )
    try:
        from bot.keyboards import session_accept_kb
        from bot.main import bot
        await bot.send_message(
            lamp["user_id"],
            f"🌕 有人通过月影车姬就你的资料 <b>{lamp.get('title')}</b> 发起匿名会话。\n"
            f"对方身份已遮蔽，接受后由机器人中转消息（24h 内有效）。",
            reply_markup=session_accept_kb(sess["session_id"]),
        )
    except Exception:
        logger.exception("notify lamp owner failed")
    return {
        "ok": True,
        "session_id": sess["session_id"],
        "status": sess["status"],
        "message": "已发送想聊聊邀请，等待对方在 Bot 中接受",
    }
