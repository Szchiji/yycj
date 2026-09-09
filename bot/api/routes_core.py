"""月影车姬 API 核心路由（auth/home/lamps/sessions）。"""

from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from bot.api.deps import get_admin_user_id, get_current_user_id
from bot.api.telegram_webapp import WebAppAuthError, issue_access_token, validate_init_data
from bot.config import get_settings
from bot.db import session_scope
from bot.models import Post, PostStatus, Report, ReportStatus, ReviewStatus, UserRole
from bot.services import anti_brush, credit_service, home_service, search_service, session_service
from bot.services import admin_ops
from bot.services.admin_ops import AdminActionError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["api"])

_FILE_ID_RE = re.compile(r"^(?:tg:file_id:)?[A-Za-z0-9_\-]{10,256}$")
_ROLE_LABEL = {
    UserRole.TEACHER.value: "老师",
    UserRole.GUEST.value: "客人",
    UserRole.MERCHANT.value: "商家",
}

# ---------- schemas ----------

class AuthBody(BaseModel):
    init_data: str = Field(..., alias="initData", description="Telegram.WebApp.initData")

    model_config = {"populate_by_name": True}

class SessionRequestBody(BaseModel):
    lamp_id: str

class MediaItem(BaseModel):
    type: str = "image"  # image | video
    url: str

class PostCreateBody(BaseModel):
    city: str
    title: str
    price: Optional[int] = None
    price_text: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    description: str = ""
    photos: List[str] = Field(default_factory=list)
    media: List[MediaItem] = Field(default_factory=list)
    district: Optional[str] = None
    approx_lat: Optional[float] = None
    approx_lng: Optional[float] = None
    approx_label: Optional[str] = None

class ReportCreateBody(BaseModel):
    lamp_id: str
    reason: str
    description: str = ""

class CreditAdjustBody(BaseModel):
    user_id: int
    delta: int
    note: str = ""

class RoleBody(BaseModel):
    role: str  # teacher | guest | merchant

class ReviewCreateBody(BaseModel):
    lamp_id: str
    stars: int = 5
    text: str = ""
    photos: List[str] = Field(default_factory=list)
    session_id: Optional[str] = None

class AnnounceBody(BaseModel):
    text: str = ""
    enabled: bool = True

class CitiesBody(BaseModel):
    cities: List[str]

class PinBody(BaseModel):
    lamp_id: str
    sort_order: int = 0
    expires_hours: Optional[int] = 72

class PinReorderBody(BaseModel):
    ordered_ids: List[int]

class ApprovePinBody(BaseModel):
    expires_hours: Optional[int] = 72
    sort_order: int = 0

def _ser_dt(v: Any) -> Any:
    if hasattr(v, "isoformat"):
        return v.isoformat()
    return v

def _ser_user(u: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(u)
    for k in ("created_at", "updated_at", "last_recovery_at"):
        if k in out:
            out[k] = _ser_dt(out[k])
    role = out.get("role")
    out["role_label"] = _ROLE_LABEL.get(role or "", None)
    return out

def _ser_lamp(lamp: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(lamp)
    for k in ("created_at", "updated_at"):
        if k in out:
            out[k] = _ser_dt(out[k])
    out.pop("user_id", None)
    out.pop("_distance_km", None)
    out.pop("approx_lat", None)
    out.pop("approx_lng", None)
    return out

def _normalize_media(
    media: List[MediaItem] | None,
    photos: List[str] | None,
) -> List[Dict[str, str]]:
    """图+视频合计 ≤9；接受 https URL 或 Telegram file_id。TODO: 真·二进制上传。"""
    items: List[Dict[str, str]] = []
    for m in media or []:
        t = (m.type or "image").lower().strip()
        if t not in ("image", "video"):
            raise HTTPException(status_code=400, detail="media.type 仅支持 image/video")
        url = (m.url or "").strip()
        if not url:
            continue
        items.append({"type": t, "url": _normalize_one_url(url)})
    for p in photos or []:
        s = (p or "").strip()
        if s:
            items.append({"type": "image", "url": _normalize_one_url(s)})
    if len(items) > 9:
        raise HTTPException(status_code=400, detail="媒体合计最多 9 个（图+视频）")
    return items

def _normalize_one_url(s: str) -> str:
    if s.lower().startswith("data:"):
        raise HTTPException(status_code=400, detail="不支持 base64 内嵌，请用公网 URL 或 file_id")
    if s.startswith("http://") or s.startswith("https://"):
        parsed = urlparse(s)
        if parsed.scheme not in ("http", "https") or not parsed.netloc:
            raise HTTPException(status_code=400, detail=f"无效 URL：{s[:64]}")
        if len(s) > 1024:
            raise HTTPException(status_code=400, detail="URL 过长")
        return s
    if _FILE_ID_RE.match(s):
        return s.split(":", 2)[-1] if s.lower().startswith("tg:file_id:") else s
    raise HTTPException(
        status_code=400,
        detail="仅支持 https URL 或 Telegram file_id（可用 tg:file_id: 前缀）",
    )

def _admin_http_error(exc: AdminActionError) -> HTTPException:
    code = 404 if exc.code == "not_found" else 409
    return HTTPException(status_code=code, detail=str(exc))

# ---------- auth / me ----------

@router.post("/auth")
async def api_auth(body: AuthBody) -> Dict[str, Any]:
    settings = get_settings()
    try:
        parsed = validate_init_data(body.init_data, settings.bot_token)
    except WebAppAuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc

    tg_user = parsed["user"]
    user_id = int(tg_user["id"])
    username = tg_user.get("username")
    full_name = " ".join(
        x for x in [tg_user.get("first_name"), tg_user.get("last_name")] if x
    ).strip() or None
    user = await credit_service.ensure_user(user_id, username=username, full_name=full_name)
    token = issue_access_token(user_id, settings.bot_token)
    return {
        "ok": True,
        "token": token,
        "user": _ser_user(user),
        "is_admin": settings.is_admin(user_id),
        "needs_role": not bool(user.get("role")),
    }

@router.get("/me")
async def api_me(user_id: int = Depends(get_current_user_id)) -> Dict[str, Any]:
    user = await credit_service.ensure_user(user_id)
    my_reviews = await home_service.list_my_reviews(user_id, limit=20)
    for r in my_reviews:
        r["created_at"] = _ser_dt(r.get("created_at"))
        r["reviewed_at"] = _ser_dt(r.get("reviewed_at"))
    return {
        "ok": True,
        "user": _ser_user(user),
        "is_admin": get_settings().is_admin(user_id),
        "needs_role": not bool(user.get("role")),
        "reviews": my_reviews,
        "tips": {
            "media_limit": "发布媒体图+视频合计最多 9 个；当前支持 URL / file_id（二进制上传 TODO）",
            "report_history": "举报记录可在报告审核后通过 Bot 通知查看结果",
        },
    }

@router.post("/me/role")
async def api_set_role(
    body: RoleBody,
    user_id: int = Depends(get_current_user_id),
) -> Dict[str, Any]:
    try:
        user = await credit_service.set_user_role(user_id, body.role.strip().lower())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "ok": True,
        "user": _ser_user(user),
        "role": user.get("role"),
        "role_label": _ROLE_LABEL.get(user.get("role") or "", ""),
    }

@router.get("/me/credit")
async def api_me_credit(user_id: int = Depends(get_current_user_id)) -> Dict[str, Any]:
    user = await credit_service.ensure_user(user_id)
    hist = await credit_service.history(user_id, limit=30)
    for h in hist:
        h["time"] = _ser_dt(h.get("time"))
    return {
        "ok": True,
        "user": _ser_user(user),
        "tier_ranges": credit_service.TIER_RANGES,
        "history": hist,
    }

# ---------- home feed ----------

@router.get("/home")
async def api_home(
    city: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    limit: int = Query(default=20, ge=1, le=50),
    user_id: int = Depends(get_current_user_id),
) -> Dict[str, Any]:
    settings = await home_service.get_or_create_settings()
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

    items = await search_service.search_lamps(city=use_city, limit=limit, lat=lat, lng=lng)
    announcement = None
    if settings.get("announcement_enabled") and settings.get("announcement_text"):
        announcement = {
            "text": settings["announcement_text"],
            "enabled": True,
        }

    return {
        "ok": True,
        "city": use_city,
        "enabled_cities": enabled,
        "announcement": announcement,
        "pins": pins,
        "items": [_ser_lamp(x) for x in items],
        "count": len(items),
        "scoring_rules": home_service.SCORING_RULES,
    }

@router.get("/cities")
async def api_cities(user_id: int = Depends(get_current_user_id)) -> Dict[str, Any]:
    settings = await home_service.get_or_create_settings()
    return {"ok": True, "cities": settings.get("enabled_cities") or []}

# ---------- lamps ----------

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
        keyword=q,
        city=city,
        price_min=price_min,
        price_max=price_max,
        limit=limit,
        lat=lat,
        lng=lng,
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
    return {
        "ok": True,
        "lamp": _ser_lamp(lamp),
        "reputation": rep,
        "reviews": reviews,
    }

# ---------- sessions ----------

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

    sess = await session_service.create_request(body.lamp_id, user_id, lamp["user_id"])
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
