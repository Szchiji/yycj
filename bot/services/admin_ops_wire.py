"""审核通过通知改为可配置推广话术。"""
from bot.services import admin_ops, search_service
from bot.services.listing_notify import notify_publisher_approved

_orig = admin_ops.approve_post


async def approve_post(post_id: str, *, notify: bool = True):
    result = await _orig(post_id, notify=False)
    if notify:
        lamp = await search_service.get_lamp(result.get("lamp_id") or "")
        title = (lamp or {}).get("title") or "资料"
        await notify_publisher_approved(result["user_id"], title)
    return result


admin_ops.approve_post = approve_post  # type: ignore[assignment]
