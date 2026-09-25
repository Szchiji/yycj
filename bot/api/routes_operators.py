"""超管可在后台加减运营管理员。"""
from __future__ import annotations

from typing import Any, Dict, List

from fastapi import Depends, HTTPException
from pydantic import BaseModel

from bot.api.deps import get_admin_user_id
from bot.api.routes_core import router
from bot.config import get_settings
from bot.services.admin_acl import extra_ids, is_super, save, warm


class OperatorsBody(BaseModel):
    user_ids: List[int] = []


@router.get("/admin/operators")
async def api_list_operators(admin_id: int = Depends(get_admin_user_id)) -> Dict[str, Any]:
    await warm()
    return {
        "ok": True,
        "is_super": is_super(admin_id),
        "super_ids": get_settings().admin_id_list,
        "extra_admin_ids": sorted(extra_ids()),
    }


@router.post("/admin/operators")
async def api_save_operators(
    body: OperatorsBody,
    admin_id: int = Depends(get_admin_user_id),
) -> Dict[str, Any]:
    if not is_super(admin_id):
        raise HTTPException(status_code=403, detail="只有环境变量 ADMIN_IDS 里的超管能改运营名单")
    ids = await save(body.user_ids)
    return {"ok": True, "extra_admin_ids": ids}
