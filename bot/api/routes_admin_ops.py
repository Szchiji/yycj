"""管理：用户拉黑、遮蔽、下架、续期、Bot 同步。"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select

from bot.api.deps import get_admin_user_id
from bot.api.routes_core import BanBody, LampOpBody, _ser_dt, _ser_user, router
from bot.config import get_settings
from bot.db import session_scope
from bot.models import Lamp
from bot.services import home_service, listing_ops, user_admin

logger = logging.getLogger(__name__)


class ExtraOpsBody(BaseModel):
    listing_days: Optional[int] = None
    carousel_interval_sec: Optional[int] = None
    show_bot_link: Optional[bool] = None
    show_admin_link: Optional[bool] = None
    bot_btn_label: Optional[str] = None
    admin_btn_label: Optional[str] = None
    admin_contact: Optional[str] = None
    required_chats: Optional[List[Dict[str, Any]]] = None
    chat_cta_label: Optional[str] = None
    home_feed_page_size: Optional[int] = None
    approve_promo_text: Optional[str] = None
    broadcast_channel: Optional[str] = None
    media_channel_id: Optional[str] = None
    broadcast_template: Optional[str] = None
    listing_fields: Optional[List[Dict[str, Any]]] = None


class ShadowBody(BaseModel):
    user_id: int
    shadowed: bool = True
    days: Optional[int] = 7
    reason: str = ""


@router.post("/admin/settings/extra")
async def api_admin_extra_ops(
    body: ExtraOpsBody,
    _: int = Depends(get_admin_user_id),
) -> Dict[str, Any]:
    ops = {k: v for k, v in body.model_dump().items() if v is not None}
    settings = await home_service.update_settings(ops_config=ops or None)
    settings["updated_at"] = _ser_dt(settings.get("updated_at"))
    return {"ok": True, "settings": settings}


@router.get("/admin/users")
async def api_admin_users(
    q: str = "",
    limit: int = Query(default=50, ge=1, le=200),
    _: int = Depends(get_admin_user_id),
) -> Dict[str, Any]:
    items = await user_admin.search_users(q, limit=limit)
    return {"ok": True, "items": [_ser_user(x) for x in items]}


@router.post("/admin/users/ban")
async def api_admin_ban(
    body: BanBody,
    admin_id: int = Depends(get_admin_user_id),
) -> Dict[str, Any]:
    if get_settings().is_admin(body.user_id):
        raise HTTPException(status_code=400, detail="不能拉黑管理员")
    user = await user_admin.set_banned(body.user_id, body.banned, body.reason)
    if body.banned:
        async with session_scope() as s:
            res = await s.execute(select(Lamp.lamp_id).where(Lamp.user_id == body.user_id))
            ids = [row[0] for row in res.all()]
        for lid in ids:
            try:
                await listing_ops.unlist_lamp(lid, reason="banned")
            except Exception:
                logger.exception("unlist on ban failed %s", lid)
    return {"ok": True, "user": _ser_user(user), "by": admin_id}


@router.post("/admin/users/shadow")
async def api_admin_shadow(
    body: ShadowBody,
    admin_id: int = Depends(get_admin_user_id),
) -> Dict[str, Any]:
    if get_settings().is_admin(body.user_id):
        raise HTTPException(status_code=400, detail="不能遮蔽管理员")
    user = await user_admin.set_shadow(
        body.user_id,
        shadowed=body.shadowed,
        days=body.days,
        reason=body.reason or ("管理员设置" if body.shadowed else ""),
    )
    return {"ok": True, "user": _ser_user(user), "by": admin_id}


@router.get("/admin/listings")
async def api_admin_listings(_: int = Depends(get_admin_user_id)) -> Dict[str, Any]:
    items = await listing_ops.list_listed()
    for it in items:
        it["expires_at"] = _ser_dt(it.get("expires_at"))
    return {"ok": True, "items": items}


@router.post("/admin/listings/{lamp_id}/unlist")
async def api_admin_unlist(
    lamp_id: str, body: LampOpBody = LampOpBody(), _: int = Depends(get_admin_user_id)
) -> Dict[str, Any]:
    try:
        data = await listing_ops.unlist_lamp(lamp_id, reason=body.reason or "admin")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, **data}


@router.post("/admin/listings/{lamp_id}/relist")
async def api_admin_relist(lamp_id: str, _: int = Depends(get_admin_user_id)) -> Dict[str, Any]:
    try:
        data = await listing_ops.relist_lamp(lamp_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    data["expires_at"] = _ser_dt(data.get("expires_at"))
    return {"ok": True, **data}


@router.post("/admin/listings/{lamp_id}/renew")
async def api_admin_renew(
    lamp_id: str, body: LampOpBody = LampOpBody(), _: int = Depends(get_admin_user_id)
) -> Dict[str, Any]:
    try:
        data = await listing_ops.set_listing_expiry(lamp_id, days=body.days)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    data["expires_at"] = _ser_dt(data.get("expires_at"))
    return {"ok": True, **data}


@router.post("/admin/bot-identity/refresh")
async def api_admin_refresh_bot(_: int = Depends(get_admin_user_id)) -> Dict[str, Any]:
    from bot.services import bot_info
    ident = await bot_info.refresh_bot_identity()
    return {"ok": True, "identity": ident}
