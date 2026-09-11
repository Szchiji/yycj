"""把自定义上架栏写入资料，详情和推送都能读到。"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict

from sqlalchemy import text

from bot.db import session_scope
from bot.services import search_service

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
        if data:
            row = (await s.execute(text("SELECT description FROM lamps WHERE lamp_id = :id"), {"id": lamp_id})).first()
            desc = (row[0] if row else "") or ""
            block = "\n".join(f"{k}：{v}" for k, v in data.items())
            if block and block not in desc:
                new_desc = (desc + ("\n" if desc else "") + block)[:2000]
                await s.execute(text("UPDATE lamps SET description = :d WHERE lamp_id = :id"), {"d": new_desc, "id": lamp_id})


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


async def get_lamp(lamp_id: str):
    lamp = await _orig_get(lamp_id)
    if lamp:
        extras = await load_extras(lamp_id)
        if extras:
            lamp["extras"] = extras
    return lamp


search_service.get_lamp = get_lamp  # type: ignore[assignment]
