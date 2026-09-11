"""把自定义上架栏写入资料，详情和推送都能读到。"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict

from sqlalchemy import text

from bot.db import session_scope
from bot.services import listing_flow, search_service

logger = logging.getLogger(__name__)


async def save_extras(lamp_id: str, extras: Dict[str, Any] | None) -> None:
    data = {str(k): str(v) for k, v in (extras or {}).items() if k and v not in (None, "")}
    if not lamp_id:
        return
    async with session_scope() as s:
        try:
            await s.execute(
                text("UPDATE lamps SET extras = CAST(:j AS jsonb) WHERE lamp_id = :id"),
                {"j": json.dumps(data, ensure_ascii=False), "id": lamp_id},
            )
        except Exception:
            logger.exception("save extras failed")


async def load_extras(lamp_id: str) -> Dict[str, Any]:
    if not lamp_id:
        return {}
    async with session_scope() as s:
        try:
            row = (await s.execute(text("SELECT extras FROM lamps WHERE lamp_id = :id"), {"id": lamp_id})).first()
            raw = row[0] if row else {}
            return raw if isinstance(raw, dict) else {}
        except Exception:
            return {}


_orig_get = search_service.get_lamp
_orig_apply = listing_flow.apply_edit
_orig_admin = listing_flow.apply_admin_edit
_orig_list = listing_flow.list_my_lamps


async def get_lamp(lamp_id: str):
    lamp = await _orig_get(lamp_id)
    if lamp:
        extras = await load_extras(lamp_id)
        if extras:
            lamp["extras"] = extras
    return lamp


async def apply_edit(lamp_id: str, data: Dict[str, Any], *, owner_id: int, admin: bool = False):
    lamp = await _orig_apply(lamp_id, data, owner_id=owner_id, admin=admin)
    await save_extras(lamp_id, (data or {}).get("extras"))
    return lamp


async def apply_admin_edit(lamp_id: str, data: Dict[str, Any]):
    lamp = await _orig_admin(lamp_id, data)
    await save_extras(lamp_id, (data or {}).get("extras"))
    return lamp


async def list_my_lamps(user_id: int):
    items = await _orig_list(user_id)
    for it in items:
        it["extras"] = await load_extras(it.get("lamp_id") or "")
    return items


search_service.get_lamp = get_lamp  # type: ignore[assignment]
listing_flow.apply_edit = apply_edit  # type: ignore[assignment]
listing_flow.apply_admin_edit = apply_admin_edit  # type: ignore[assignment]
listing_flow.list_my_lamps = list_my_lamps  # type: ignore[assignment]
