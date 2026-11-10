"""Future renewals: explicit fresh channel post + publisher DM; no historical backfill.

Telegram has no idempotency key for sends. Checkpoint BEFORE each external send and
never automatically retry an ambiguous send. A repeated operation returns its saved
outcome, including partial failure, rather than duplicating the post or DM.
"""
from __future__ import annotations

import logging
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from bot.db import session_scope
from bot.models import ListingRenewal
from bot.services import listing_ops, search_service, broadcast, listing_notify

logger = logging.getLogger(__name__)


async def claim(operation_id, lamp_id, admin_id, days):
    async with session_scope() as s:
        result = await s.execute(insert(ListingRenewal).values(
            operation_id=operation_id, lamp_id=lamp_id, admin_id=admin_id, days=days,
            result={"ok": False, "renewed": False, "operation_id": operation_id,
                    "channel_status": "not_started", "notify_status": "not_started",
                    "message": "续期请求正在处理或结果尚未确认；不会自动重复推送，请稍后刷新。"}
        ).on_conflict_do_nothing(index_elements=[ListingRenewal.operation_id]).returning(ListingRenewal.operation_id))
        return result.scalar_one_or_none() is not None


async def load(operation_id, lamp_id, admin_id, days):
    async with session_scope() as s:
        row = (await s.execute(select(ListingRenewal).where(ListingRenewal.operation_id == operation_id))).scalar_one()
        if (row.lamp_id, row.admin_id, row.days) != (lamp_id, admin_id, days):
            raise ValueError("操作编号与本次续期不匹配，请刷新后台")
        return dict(row.result)


async def save(operation_id, result):
    async with session_scope() as s:
        await s.execute(update(ListingRenewal).where(ListingRenewal.operation_id == operation_id).values(result=dict(result)))


async def renew_listing(lamp_id: str, admin_id: int, days: int | None, operation_id: str):
    if not await claim(operation_id, lamp_id, admin_id, days):
        return await load(operation_id, lamp_id, admin_id, days)
    out = {"ok": False, "renewed": False, "operation_id": operation_id,
           "album": None, "channel_status": "not_started", "notify_status": "not_started"}
    try:
        data = await listing_ops.set_listing_expiry(lamp_id, days=days)
    except ValueError as exc:
        out["message"] = str(exc)
        await save(operation_id, out)
        raise
    out.update(data)
    expiry = out.get("expires_at")
    out["expires_at"] = expiry.isoformat() if hasattr(expiry, "isoformat") else expiry
    out.update(renewed=True, channel_status="sending",
               message="续期已生效；频道推送处理中或结果不明，请勿重复续期。")
    # If this durable checkpoint fails, do not start any external send.
    await save(operation_id, out)
    try:
        full = await search_service.get_lamp(lamp_id) or {}
        if not full or not full.get("user_id"):
            raise ValueError("资料或发布者不存在")
        album = await broadcast.broadcast_listing(full, dict(full.get("extras") or {}), force_new=True)
    except Exception:
        logger.exception("renew channel repost failed for %s", lamp_id)
        album = None
    if not album:
        out.update(channel_status="failed_or_unknown", notify_status="not_attempted",
                   message="续期已生效，但频道重发失败或结果不明；未发送上架成功通知。请检查频道，勿重复续期。")
        await save(operation_id, out)
        return out
    out.update(album=album, channel_status="sent", notify_status="sending",
               message="续期和频道重发已完成；老师通知处理中或结果不明，请勿重复续期。")
    # New post refs have been persisted by broadcast before it returns the album.
    await save(operation_id, out)
    try:
        notified = await listing_notify.notify_publisher_approved(
            int(full["user_id"]), full.get("title") or "资料", album,
            city=full.get("city"), lamp_id=lamp_id)
    except Exception:
        logger.exception("renew publisher notification failed for %s", lamp_id)
        notified = False
    out.update(ok=bool(notified), notify_status="sent" if notified else "failed_or_unknown",
               message="续期成功，已重新推送到频道最新并通知老师。" if notified else
                       "续期和频道重发成功，但老师通知失败或结果不明；不会自动重发，请检查老师是否屏蔽机器人。")
    await save(operation_id, out)
    return out
