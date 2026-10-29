"""城市分区：后台城市切换器的计数、分城市公告、运营负责城市。"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import Depends, HTTPException
from pydantic import BaseModel

from bot.api.deps import get_admin_user_id, get_super_user_id
from bot.api.routes_core import router
from bot.services import city_scope, home_service
from bot.services.admin_acl import extra_ids, is_super, warm


class CityAnnounceBody(BaseModel):
    city: str
    text: str = ""
    enabled: bool = True


class OperatorCitiesBody(BaseModel):
    operator_cities: Dict[str, List[str]] = {}


@router.get("/admin/cities/summary")
async def api_city_summary(admin_id: int = Depends(get_admin_user_id)) -> Dict[str, Any]:
    settings = await home_service.get_or_create_settings()
    enabled = list(settings.get("enabled_cities") or [])
    scope = await city_scope.scope_for(admin_id)
    data = await city_scope.summary(scope, enabled)
    return {
        "ok": True,
        "is_super": is_super(admin_id),
        "scope": sorted(scope) if scope is not None else None,
        "enabled_cities": enabled,
        "city_announcements": settings.get("city_announcements") or {},
        **data,
    }


@router.post("/admin/cities/announcement")
async def api_city_announcement(
    body: CityAnnounceBody,
    admin_id: int = Depends(get_admin_user_id),
) -> Dict[str, Any]:
    city = (body.city or "").strip()[:32]
    if not city:
        raise HTTPException(status_code=400, detail="缺少城市")
    if not is_super(admin_id):
        # Unscoped operators can't edit the global announcement either; only an operator
        # explicitly assigned to this city may edit its announcement.
        scope = await city_scope.scope_for(admin_id)
        if scope is None or city not in scope:
            raise HTTPException(status_code=403, detail="只有超管或负责这个城市的运营能改城市公告")
    current = dict((await home_service.get_or_create_settings()).get("city_announcements") or {})
    text = (body.text or "")[:2000]
    if text.strip():
        current[city] = {"text": text, "enabled": bool(body.enabled)}
    else:
        current.pop(city, None)
    settings = await home_service.update_settings(ops_config={"city_announcements": current})
    return {"ok": True, "city_announcements": settings.get("city_announcements") or {}}


@router.post("/admin/operators/cities")
async def api_operator_cities(
    body: OperatorCitiesBody,
    _: int = Depends(get_super_user_id),
) -> Dict[str, Any]:
    await warm()
    ops = extra_ids()
    cleaned = city_scope.clean_operator_cities(body.operator_cities)
    unknown = [k for k in cleaned if int(k) not in ops]
    if unknown:
        raise HTTPException(status_code=400, detail="不是运营管理员：" + ", ".join(unknown))
    settings = await home_service.update_settings(ops_config={"operator_cities": cleaned})
    return {"ok": True, "operator_cities": settings.get("operator_cities") or {}}
