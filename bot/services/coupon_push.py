"""优惠推送到频道：文字帖（不带按钮），末尾是文字链接「查看详情 · 领取优惠」→ t.me/<bot>?start=s_|q_<32hex>。

· 频道：本城「优惠发到的频道」→ 本城推送频道 → 全站（home_feed.feature_chat）。开关 broadcast_coupons，默认开。
· 优惠结束 / 过期 / 被停用 / 领完：把同一条帖子改成「已结束」并去掉链接（close）。过期由 job_close_due 每 10 分钟收尾。
· 所有用户内容都 HTML 转义。任何 Telegram 失败只记日志，不影响发券。
"""
from __future__ import annotations

import html
import logging
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import or_, select

from bot.db import session_scope
from bot.models import Lamp
from bot.models_extra import Coupon

logger = logging.getLogger(__name__)

_END_WORD = {"ended": "已结束", "stopped": "已结束", "expired": "已结束", "sold_out": "已领完 · 已结束"}


def _bj(dt: datetime) -> str:
    b = dt + timedelta(hours=8)
    return f"{b.month}月{b.day}日 {b.hour:02d}:{b.minute:02d}"


def render(c: Coupon, lamp: Optional[Lamp], bot_name: str, *, closed: str = "") -> str:
    from bot.services.broadcast import start_url
    title = html.escape(str(getattr(lamp, "title", "") or "老师"))
    loc = html.escape(" · ".join(x for x in (c.city, getattr(lamp, "district", "") or "") if x))
    text = html.escape(c.text or "")
    quota = f" · 限{int(c.quota)}张" if c.quota else ""
    if closed:
        return (f"🎟 限时优惠 · {title}（{html.escape(closed)}）\n📍 {loc}\n<s>{text}</s>\n"
                f"——\n这个优惠{html.escape(closed)}，感谢关注。").strip()
    body = f"🎟 限时优惠 · <b>{title}</b>\n📍 {loc}\n💰 {text}\n⏳ 有效至 {_bj(c.ends_at)}（北京时间）{quota}"
    links = []
    for kind, label in (("s", "查看详情"), ("q", "领取优惠")):
        u = start_url(bot_name, c.lamp_id, kind)
        if u:
            links.append(f'<a href="{html.escape(u, quote=True)}">{label}</a>')
    if links:
        body += "\n\n" + " · ".join(links)
    return body


async def _bot_name() -> str:
    from bot.services import bot_info
    try:
        return (await bot_info.get_bot_identity()).get("username") or ""
    except Exception:
        return ""


async def publish(coupon_id: str) -> Optional[int]:
    """Post a new coupon to its city's channel (if 优惠推送 is on). Returns the message id."""
    from bot.services import home_service
    from bot.services.home_feed import feature_chat, ops_for_city
    async with session_scope() as s:
        c = (await s.execute(select(Coupon).where(Coupon.coupon_id == coupon_id))).scalar_one_or_none()
        if not c or c.post_mid:
            return None
        lamp = (await s.execute(select(Lamp).where(Lamp.lamp_id == c.lamp_id))).scalar_one_or_none()
        site = ops_for_city(await home_service.get_or_create_settings(), c.city)
        if not site.get("broadcast_coupons", True):
            return None
        chat = feature_chat(site, "broadcast_coupons")
        if not chat:
            return None
        text = render(c, lamp, await _bot_name())
        try:
            from bot.main import bot
            msg = await bot.send_message(chat, text, disable_web_page_preview=True)
        except Exception:
            logger.exception("coupon post failed (%s)", chat)
            return None
        c.post_chat, c.post_mid, c.post_closed = chat, int(getattr(msg, "message_id", 0) or 0) or None, False
        return c.post_mid


async def close(coupon_id: str, reason: str = "ended") -> bool:
    """Edit the channel post to 「已结束」 and drop the links. Idempotent."""
    async with session_scope() as s:
        c = (await s.execute(select(Coupon).where(Coupon.coupon_id == coupon_id))).scalar_one_or_none()
        if not c or not c.post_mid or c.post_closed:
            return False
        lamp = (await s.execute(select(Lamp).where(Lamp.lamp_id == c.lamp_id))).scalar_one_or_none()
        text = render(c, lamp, "", closed=_END_WORD.get(reason, "已结束"))
        try:
            from bot.main import bot
            await bot.edit_message_text(text, chat_id=c.post_chat, message_id=int(c.post_mid), disable_web_page_preview=True)
        except Exception as exc:
            if "not modified" not in str(exc).lower():
                logger.warning("coupon post close failed: %s", str(exc)[:200])
        c.post_closed = True
        return True


async def job_close_due() -> int:
    """Every 10 min: close posts whose coupon expired / ended / was stopped / sold out."""
    now = datetime.utcnow()
    async with session_scope() as s:
        rows = (await s.execute(select(Coupon.coupon_id, Coupon.status, Coupon.ends_at, Coupon.quota, Coupon.claimed).where(
            Coupon.post_mid.is_not(None), or_(Coupon.post_closed.is_(False), Coupon.post_closed.is_(None))))).all()
    n = 0
    for cid, status, ends_at, quota, claimed in rows:
        reason = ("expired" if ends_at <= now else "sold_out" if quota and claimed >= quota else status if status != "active" else "")
        if reason and await close(cid, reason):
            n += 1
    return n
