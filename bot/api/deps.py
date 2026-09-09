"""FastAPI 依赖：当前用户 / 管理员。"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header, HTTPException

from bot.api.telegram_webapp import WebAppAuthError, verify_access_token
from bot.config import get_settings


async def get_current_user_id(
    authorization: Annotated[str | None, Header()] = None,
    x_yycj_token: Annotated[str | None, Header(alias="X-Yycj-Token")] = None,
) -> int:
    raw = None
    if authorization and authorization.lower().startswith("bearer "):
        raw = authorization[7:].strip()
    elif x_yycj_token:
        raw = x_yycj_token.strip()
    if not raw:
        raise HTTPException(status_code=401, detail="需要登录（Bearer token）")
    settings = get_settings()
    try:
        return verify_access_token(raw, settings.bot_token)
    except WebAppAuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


async def get_admin_user_id(user_id: Annotated[int, Depends(get_current_user_id)]) -> int:
    if not get_settings().is_admin(user_id):
        raise HTTPException(status_code=403, detail="需要管理员权限（ADMIN_IDS）")
    return user_id
