"""审核通过：改稿覆盖 + 推广通知 + 频道推送。"""
from bot.db import session_scope
from bot.models import Post, PostStatus
from bot.services import admin_ops, listing_flow, search_service
from bot.services.listing_notify import notify_publisher_approved
from bot.services.extras_store import save_extras
from sqlalchemy import select

_orig = admin_ops.approve_post


def _extras(data: dict) -> dict:
    extra = data.get("extras") if isinstance(data.get("extras"), dict) else {}
    out = dict(extra)
    for key in ("联系", "频道", "微信"):
        if data.get(key) and key not in out:
            out[key] = data.get(key)
    return out


async def approve_post(post_id: str, *, notify: bool = True):
    async with session_scope() as s:
        res = await s.execute(select(Post).where(Post.post_id == post_id))
        post = res.scalar_one_or_none()
        data = dict((post.lamp_data or {}) if post else {})
        user_id = post.user_id if post else 0
        edit_id = data.get("edit_lamp_id")
        status = post.status if post else None
    extras = _extras(data)
    if edit_id and post and status == PostStatus.PENDING.value:
        async with session_scope() as s:
            res = await s.execute(select(Post).where(Post.post_id == post_id))
            row = res.scalar_one_or_none()
            if row:
                row.status = PostStatus.APPROVED.value
                from datetime import datetime
                row.reviewed_at = datetime.utcnow()
        lamp = await listing_flow.apply_edit(edit_id, data, owner_id=user_id)
        full = await search_service.get_lamp(edit_id)
        album = None
        if full:
            await save_extras((full or {}).get("lamp_id") or edit_id, extras)
            album = await listing_flow.broadcast_listing(full, extras)
        if notify:
            await notify_publisher_approved(user_id, lamp.get("title") or "资料", album)
        return {"ok": True, "post_id": post_id, "status": "approved", "lamp_id": edit_id, "user_id": user_id, "edited": True}
    result = await _orig(post_id, notify=False)
    if notify:
        lamp = await search_service.get_lamp(result.get("lamp_id") or "")
        title = (lamp or {}).get("title") or "资料"
        album = None
        if lamp:
            await save_extras((lamp or {}).get("lamp_id") or result.get("lamp_id"), extras)
            album = await listing_flow.broadcast_listing(lamp, extras)
        await notify_publisher_approved(result["user_id"], title, album)
    return result


admin_ops.approve_post = approve_post  # type: ignore[assignment]
