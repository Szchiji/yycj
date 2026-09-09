"""Mini App + Admin HTTP 路由（/api/...）。"""

from __future__ import annotations

import logging
import re
import uuid
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from bot.api.deps import get_admin_user_id, get_current_user_id
from bot.api.telegram_webapp import WebAppAuthError, issue_access_token, validate_init_data
from bot.config import get_settings
from bot.db import session_scope
from bot.models import Post, PostStatus, Report, ReportStatus
from bot.services import anti_brush, credit_service, search_service, session_service
from bot.services import admin_ops
from bot.services.admin_ops import AdminActionError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["api"])

# Telegram file_id 常见字符；亦接受 tg:file_id: 前缀
_FILE_ID_RE = re.compile(r"^(?:tg:file_id:)?[A-Za-z0-9_\-]{10,256}$")


# ---------- schemas ----------


class AuthBody(BaseModel):
    init_data: str = Field(..., alias="initData", description="Telegram.WebApp.initData")

    model_config = {"populate_by_name": True}


class SessionRequestBody(BaseModel):
    lamp_id: str


class PostCreateBody(BaseModel):
    city: str
    title: str
    price: Optional[int] = None
    price_text: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    description: str = ""
    # 公网 https 图片 URL，和/或 Telegram file_id 字符串（WebApp 难以直传二进制时的折中）
    photos: List[str] = Field(default_factory=list)


class ReportCreateBody(BaseModel):
    lamp_id: str
    reason: str
    description: str = ""


class CreditAdjustBody(BaseModel):
    user_id: int
    delta: int
    note: str = ""


def _ser_dt(v: Any) -> Any:
    if hasattr(v, "isoformat"):
        return v.isoformat()
    return v


def _ser_user(u: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(u)
    for k in ("created_at", "updated_at", "last_recovery_at"):
        if k in out:
            out[k] = _ser_dt(out[k])
    return out


def _ser_lamp(lamp: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(lamp)
    for k in ("created_at", "updated_at"):
        if k in out:
            out[k] = _ser_dt(out[k])
    # Mini App 不暴露主人真实 ID
    out.pop("user_id", None)
    return out


def _normalize_photos(raw: List[str] | None) -> List[str]:
    """
    规范化投稿图片字段（写入 Lamp.photos JSONB）。

    接受：
    - 公网 http(s) URL
    - Telegram file_id（或 tg:file_id:<id>）

    不接受：data:base64（体积过大）、本地路径。
    WebApp 真·相册上传仍受限；完整 file_id 推荐走 Bot FSM 投稿。
    """
    out: List[str] = []
    for item in raw or []:
        s = (item or "").strip()
        if not s:
            continue
        if s.lower().startswith("data:"):
            raise HTTPException(status_code=400, detail="不支持 base64 内嵌图片，请用公网 URL 或 file_id")
        if s.startswith("http://") or s.startswith("https://"):
            parsed = urlparse(s)
            if parsed.scheme not in ("http", "https") or not parsed.netloc:
                raise HTTPException(status_code=400, detail=f"无效图片 URL：{s[:64]}")
            if len(s) > 1024:
                raise HTTPException(status_code=400, detail="图片 URL 过长")
            out.append(s)
            continue
        if _FILE_ID_RE.match(s):
            # 统一存原始 file_id（去掉可选前缀）
            fid = s.split(":", 2)[-1] if s.lower().startswith("tg:file_id:") else s
            out.append(fid)
            continue
        raise HTTPException(
            status_code=400,
            detail="photos 仅支持 https URL 或 Telegram file_id（可用 tg:file_id: 前缀）",
        )
    return out[:3]


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
    }


@router.get("/me")
async def api_me(user_id: int = Depends(get_current_user_id)) -> Dict[str, Any]:
    user = await credit_service.ensure_user(user_id)
    return {
        "ok": True,
        "user": _ser_user(user),
        "is_admin": get_settings().is_admin(user_id),
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


# ---------- lamps ----------


@router.get("/lamps")
async def api_lamps(
    q: Optional[str] = None,
    city: Optional[str] = None,
    price_min: Optional[int] = None,
    price_max: Optional[int] = None,
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
    )
    return {"ok": True, "items": [_ser_lamp(x) for x in items], "count": len(items)}


@router.get("/lamps/{lamp_id}")
async def api_lamp_detail(
    lamp_id: str,
    user_id: int = Depends(get_current_user_id),
) -> Dict[str, Any]:
    lamp = await search_service.get_lamp(lamp_id)
    if not lamp or lamp.get("status") != "active":
        raise HTTPException(status_code=404, detail="灯笼不存在或未上架")
    return {"ok": True, "lamp": _ser_lamp(lamp)}


# ---------- sessions ----------


@router.post("/sessions/request")
async def api_session_request(
    body: SessionRequestBody,
    user_id: int = Depends(get_current_user_id),
) -> Dict[str, Any]:
    lamp = await search_service.get_lamp(body.lamp_id)
    if not lamp or lamp.get("status") != "active":
        raise HTTPException(status_code=404, detail="灯笼不存在或未上架")
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
    # 通知灯笼主人（Bot）；失败不阻断 API
    try:
        from bot.keyboards import session_accept_kb
        from bot.main import bot

        await bot.send_message(
            lamp["user_id"],
            f"🌕 有人通过 Mini App 就你的灯笼 <b>{lamp.get('title')}</b> 发起匿名月影会话。\n"
            f"对方身份已遮蔽，接受后由机器人中转消息（24h 内有效）。",
            reply_markup=session_accept_kb(sess["session_id"]),
        )
    except Exception:
        logger.exception("notify lamp owner failed")

    return {
        "ok": True,
        "session_id": sess["session_id"],
        "status": sess["status"],
        "message": "已发送邀请，等待对方在 Bot 中接受",
    }


# ---------- posts / reports ----------


@router.post("/posts")
async def api_create_post(
    body: PostCreateBody,
    user_id: int = Depends(get_current_user_id),
) -> Dict[str, Any]:
    u = await credit_service.ensure_user(user_id)
    if u.get("is_shadowed"):
        raise HTTPException(status_code=403, detail="月影遮蔽中，暂时无法点亮灯笼")
    if not await anti_brush.check_post_rate(user_id):
        raise HTTPException(status_code=429, detail="投稿过于频繁，请一小时后再试")
    desc = (body.description or "").strip()
    if desc and await anti_brush.text_too_similar(user_id, desc):
        raise HTTPException(status_code=400, detail="内容与近期投稿过于相似")

    photos = _normalize_photos(body.photos)

    lamp_data = {
        "city": (body.city or "").strip()[:32] or "未知",
        "title": (body.title or "").strip()[:64] or "未命名",
        "tags": list(body.tags or [])[:12],
        "price": body.price,
        "price_text": (body.price_text or (str(body.price) if body.price else "面议"))[:32],
        "description": desc[:2000],
        "photos": photos,
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

    # 通知管理员
    try:
        from bot.main import bot
        from bot.keyboards import admin_post_kb

        photo_hint = f"\n图片：{len(photos)} 张" if photos else "\n图片：无（可用 Bot 补传）"
        card = (
            f"🆕 新投稿（Mini App） <code>{post_id[:8]}</code>\n"
            f"用户：{user_id}\n"
            f"城市：{lamp_data['city']}\n"
            f"标题：{lamp_data['title']}\n"
            f"价位：{lamp_data.get('price_text')}\n"
            f"{(lamp_data.get('description') or '')[:300]}"
            f"{photo_hint}"
        )
        for admin_id in get_settings().admin_id_list:
            try:
                await bot.send_message(admin_id, card, reply_markup=admin_post_kb(post_id))
            except Exception:
                pass
    except Exception:
        logger.exception("notify admins of post failed")

    return {"ok": True, "post_id": post_id, "status": PostStatus.PENDING.value, "photos": photos}


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
            f"⚠️ 新报告（Mini App） <code>{report_id[:8]}</code>\n"
            f"灯笼：<code>{lamp_id[:8]}</code>… {title}\n"
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


# ---------- admin ----------


@router.get("/admin/posts/pending")
async def api_admin_pending_posts(
    limit: int = Query(default=50, ge=1, le=200),
    _: int = Depends(get_admin_user_id),
) -> Dict[str, Any]:
    items = await admin_ops.list_pending_posts(limit=limit)
    for it in items:
        it["created_at"] = _ser_dt(it.get("created_at"))
    return {"ok": True, "items": items}


@router.post("/admin/posts/{post_id}/approve")
async def api_admin_approve_post(
    post_id: str,
    admin_id: int = Depends(get_admin_user_id),
) -> Dict[str, Any]:
    try:
        result = await admin_ops.approve_post(post_id, notify=True)
    except AdminActionError as exc:
        raise _admin_http_error(exc) from exc
    result["reviewed_by"] = admin_id
    return result


@router.post("/admin/posts/{post_id}/reject")
async def api_admin_reject_post(
    post_id: str,
    admin_id: int = Depends(get_admin_user_id),
) -> Dict[str, Any]:
    try:
        result = await admin_ops.reject_post(post_id, notify=True)
    except AdminActionError as exc:
        raise _admin_http_error(exc) from exc
    result["reviewed_by"] = admin_id
    return result


@router.get("/admin/reports/pending")
async def api_admin_pending_reports(
    limit: int = Query(default=50, ge=1, le=200),
    _: int = Depends(get_admin_user_id),
) -> Dict[str, Any]:
    items = await admin_ops.list_pending_reports(limit=limit)
    for it in items:
        it["created_at"] = _ser_dt(it.get("created_at"))
    return {"ok": True, "items": items}


@router.post("/admin/reports/{report_id}/accept")
async def api_admin_accept_report(
    report_id: str,
    admin_id: int = Depends(get_admin_user_id),
) -> Dict[str, Any]:
    try:
        result = await admin_ops.accept_report(report_id, notify=True)
    except AdminActionError as exc:
        raise _admin_http_error(exc) from exc
    result["reviewed_by"] = admin_id
    return result


@router.post("/admin/reports/{report_id}/reject")
async def api_admin_reject_report(
    report_id: str,
    admin_id: int = Depends(get_admin_user_id),
) -> Dict[str, Any]:
    try:
        result = await admin_ops.reject_report(report_id, notify=True)
    except AdminActionError as exc:
        raise _admin_http_error(exc) from exc
    result["reviewed_by"] = admin_id
    return result


@router.post("/admin/credit/adjust")
async def api_admin_credit_adjust(
    body: CreditAdjustBody,
    admin_id: int = Depends(get_admin_user_id),
) -> Dict[str, Any]:
    if body.delta == 0:
        raise HTTPException(status_code=400, detail="delta 不能为 0")
    if abs(body.delta) > 500:
        raise HTTPException(status_code=400, detail="单次调整幅度过大")
    note = (body.note or "").strip() or "管理员调整"
    user = await credit_service.settle_lanhua(
        body.user_id,
        body.delta,
        action="admin_adjust",
        reason=f"[admin:{admin_id}] {note}"[:256],
        related_id=None,
    )
    return {"ok": True, "user": _ser_user(user)}


@router.get("/admin/shadow")
async def api_admin_shadow_list(
    limit: int = Query(default=100, ge=1, le=500),
    _: int = Depends(get_admin_user_id),
) -> Dict[str, Any]:
    items = await admin_ops.list_shadowed_users(limit=limit)
    return {"ok": True, "items": [_ser_user(x) for x in items]}


@router.get("/admin/sessions/{session_id}/messages")
async def api_admin_session_messages(
    session_id: str,
    limit: int = Query(default=100, ge=1, le=500),
    _: int = Depends(get_admin_user_id),
) -> Dict[str, Any]:
    sess = await session_service.get_session(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="会话不存在")
    msgs = await session_service.list_messages_for_admin(session_id, limit=limit)
    for m in msgs:
        m["created_at"] = _ser_dt(m.get("created_at"))
    out_sess = dict(sess)
    for k in ("created_at", "expire_at", "last_activity", "ended_at", "messages_purge_at"):
        if k in out_sess:
            out_sess[k] = _ser_dt(out_sess.get(k))
    return {"ok": True, "session": out_sess, "messages": msgs, "count": len(msgs)}
