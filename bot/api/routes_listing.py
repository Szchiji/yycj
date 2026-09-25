"""我的上架、改稿、管理员代上架。"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field

from bot.api.deps import get_admin_user_id, get_current_user_id
from bot.api.routes_core import MediaItem, _normalize_media, _ser_dt, router
from bot.models import LampStatus, UserRole
from bot.services import credit_service, listing_flow, listing_notify, search_service
from bot.services.admin_ops import notify_user_best_effort
from bot.services.broadcast import update_broadcast
from bot.services.extras_store import save_extras


class EditBody(BaseModel):
    city: str
    title: str
    price: Optional[int] = None
    price_text: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    description: str = ""
    photos: List[str] = Field(default_factory=list)
    media: List[MediaItem] = Field(default_factory=list)
    district: Optional[str] = None
    approx_label: Optional[str] = None
    extras: Optional[Dict[str, Any]] = None


class ProxyBody(EditBody):
    target_user_id: int
    publisher_role: str = "teacher"


@router.get("/me/listings")
async def api_me_listings(user_id: int = Depends(get_current_user_id)) -> Dict[str, Any]:
    items = await listing_flow.list_my_lamps(user_id)
    for it in items:
        it["expires_at"] = _ser_dt(it.get("expires_at"))
    return {"ok": True, "items": items}


@router.post("/me/listings/{lamp_id}/edit")
async def api_me_edit(
    lamp_id: str,
    body: EditBody,
    user_id: int = Depends(get_current_user_id),
) -> Dict[str, Any]:
    u = await credit_service.ensure_user(user_id)
    if u.get("is_shadowed"):
        raise HTTPException(status_code=403, detail="月影遮蔽中，暂时无法改稿")
    media = _normalize_media(body.media, body.photos)
    mine = await listing_flow.list_my_lamps(user_id)
    current = next((x for x in mine if x.get("lamp_id") == lamp_id), None)
    if not current:
        raise HTTPException(status_code=404, detail="找不到你的这条资料")
    if not media:
        media = list(current.get("media") or [])
    payload = {
        "city": body.city.strip()[:32],
        "title": body.title.strip()[:64],
        "tags": [t.strip()[:24] for t in body.tags if t.strip()][:5],
        "price": body.price,
        "price_text": (body.price_text or "")[:32],
        "description": (body.description or "")[:2000],
        "photos": [m.get("url") or m.get("file_id") for m in media if (m.get("type") or "image") == "image"],
        "media": media,
        "district": (body.district or "").strip()[:64] or None,
        "approx_label": (body.approx_label or "").strip()[:128] or None,
        "extras": dict(body.extras or {}),
    }
    if current.get("status") == LampStatus.ACTIVE.value:
        lamp = await listing_flow.apply_edit(lamp_id, payload, owner_id=user_id)
        album = None
        try:
            await save_extras(lamp_id, body.extras)
            full = await search_service.get_lamp(lamp_id) or lamp or {}
            extras = dict((full or {}).get("extras") or {})
            extras.update(body.extras or {})
            if isinstance(full, dict):
                full["extras"] = extras
            album = await update_broadcast(full if isinstance(full, dict) else {}, extras)
        except Exception:
            album = None
        return {"ok": True, "instant": True, "lamp": lamp, "album": album, "edited_in_place": bool(album)}
    import uuid
    from bot.db import session_scope
    from bot.models import Post, PostStatus

    lamp_data = dict(payload)
    lamp_data["edit_lamp_id"] = lamp_id
    lamp_data["publisher_role"] = u.get("role") or UserRole.TEACHER.value
    post_id = str(uuid.uuid4())
    async with session_scope() as s:
        s.add(Post(post_id=post_id, user_id=user_id, lamp_data=lamp_data, status=PostStatus.PENDING.value))
    try:
        await listing_notify.notify_admins_new_post(post_id, user_id, lamp_data)
    except Exception:
        pass
    return {"ok": True, "post_id": post_id, "status": "pending", "edit_lamp_id": lamp_id, "instant": False}


@router.post("/admin/listings/proxy")
async def api_admin_proxy(
    body: ProxyBody,
    admin_id: int = Depends(get_admin_user_id),
) -> Dict[str, Any]:
    media = _normalize_media(body.media, body.photos)
    try:
        lamp = await listing_flow.proxy_publish(
            target_user_id=body.target_user_id,
            city=body.city,
            title=body.title,
            price=body.price,
            price_text=body.price_text,
            tags=body.tags,
            description=body.description,
            media=media,
            photos=[m["url"] for m in media if m["type"] == "image"],
            district=body.district,
            approx_label=body.approx_label,
            publisher_role=body.publisher_role,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    try:
        await save_extras((lamp or {}).get("lamp_id"), body.extras)
        await listing_flow.broadcast_listing(lamp, body.extras)
    except Exception:
        pass
    try:
        await notify_user_best_effort(
            body.target_user_id,
            f"管理员已为你上架「{lamp.get('title')}」，客人点联系会打到你的机器人私聊。",
        )
    except Exception:
        pass
    return {"ok": True, "lamp": lamp, "by": admin_id}


@router.post("/admin/listings/{lamp_id}/proxy-edit")
async def api_admin_proxy_edit(
    lamp_id: str,
    body: EditBody,
    admin_id: int = Depends(get_admin_user_id),
) -> Dict[str, Any]:
    media = _normalize_media(body.media, body.photos)
    payload = {
        "city": body.city,
        "title": body.title,
        "price": body.price,
        "price_text": body.price_text,
        "tags": body.tags,
        "description": body.description,
        "district": body.district,
        "approx_label": body.approx_label,
        "extras": dict(body.extras or {}),
    }
    if media:
        payload["media"] = media
        payload["photos"] = [m["url"] for m in media if m["type"] == "image"]
    try:
        lamp = await listing_flow.apply_admin_edit(lamp_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    album = None
    try:
        await save_extras(lamp_id, body.extras)
        full = await search_service.get_lamp(lamp_id) or lamp or {}
        if isinstance(full, dict):
            extras = dict(full.get("extras") or {})
            extras.update(body.extras or {})
            full["extras"] = extras
            album = await update_broadcast(full, extras)
    except Exception:
        album = None
    return {"ok": True, "lamp": lamp, "album": album, "edited_in_place": bool(album), "by": admin_id}
