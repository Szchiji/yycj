"""优惠推送到频道：文字帖（不带按钮），末尾是文字链接「查看详情 · 领取优惠」→ t.me/<bot>?start=s_|q_<32hex>。

· 频道：本城「优惠发到的频道」→ 本城推送频道 → 全站（home_feed.feature_chat）。开关 broadcast_coupons，默认开。
· 一批一条帖子，列出每一项和数量；某一项领完 → 改帖把那一项标「已领完」（refresh）。
· 整批结束 / 过期 / 被停用 / 全部领完：把同一条帖子改成「已结束」并去掉链接（close）。过期由 job_close_due 每 10 分钟收尾。
· 所有用户内容都 HTML 转义。任何 Telegram 失败只记日志，不影响发券。
"""
from __future__ import annotations

import html
import logging
from datetime import datetime, timedelta
from typing import List, Optional

from sqlalchemy import or_, select

from bot.db import session_scope
from bot.models import Lamp
from bot.models_extra import Coupon

logger = logging.getLogger(__name__)

_END_WORD = {"ended": "已结束", "stopped": "已结束", "expired": "已结束", "sold_out": "已领完 · 已结束"}


def _bj(dt: datetime) -> str:
    b = dt + timedelta(hours=8)
    return f"{b.month}月{b.day}日 {b.hour:02d}:{b.minute:02d}"


def _items(c) -> List:
    return list(c) if isinstance(c, (list, tuple)) else [c]


def _full(c) -> bool:
    return bool(getattr(c, "quota", 0) and (getattr(c, "claimed", 0) or 0) >= c.quota)


def render(c, lamp: Optional[Lamp], bot_name: str, *, closed: str = "") -> str:
    """One post per batch: every item on its own line with its count; an item that is 领完 is struck through
    and marked 「已领完」 while the rest stay open. ``c`` = one coupon or the batch's items (head first)."""
    from bot.services.broadcast import start_url
    items = _items(c)
    head = items[0]
    title = html.escape(str(getattr(lamp, "title", "") or "老师"))
    loc = html.escape(" · ".join(x for x in (head.city, getattr(lamp, "district", "") or "") if x))
    if closed:
        lines = "\n".join(f"<s>{html.escape(x.text or '')}</s>" for x in items)
        return (f"🎟 限时优惠 · {title}（{html.escape(closed)}）\n📍 {loc}\n{lines}\n"
                f"——\n这个优惠{html.escape(closed)}，感谢关注。").strip()
    lines = []
    for x in items:
        t = html.escape(x.text or "")
        if _full(x):
            lines.append(f"💰 <s>{t}</s> · 已领完")
        else:
            lines.append(f"💰 {t}" + (f" · 限{int(x.quota)}张" if x.quota else ""))
    body = f"🎟 限时优惠 · <b>{title}</b>\n📍 {loc}\n" + "\n".join(lines) + f"\n⏳ 有效至 {_bj(head.ends_at)}（北京时间）"
    links = []
    for kind, label in (("s", "查看详情"), ("q", "领取优惠")):
        u = start_url(bot_name, head.lamp_id, kind)
        if u:
            links.append(f'<a href="{html.escape(u, quote=True)}">{label}</a>')
    if links:
        body += "\n\n" + " · ".join(links)
    return body


async def _batch(s, coupon_id: str):
    """Any item id (or batch id) → (head, items). The head (smallest id) carries the post."""
    from bot.services.coupons import _batch_rows, bkey
    c = (await s.execute(select(Coupon).where(Coupon.coupon_id == coupon_id))).scalar_one_or_none()
    items = await _batch_rows(s, bkey(c) if c else coupon_id)
    return (items[0] if items else None), items


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
        c, items = await _batch(s, coupon_id)
        if not c or c.post_mid:
            return None
        lamp = (await s.execute(select(Lamp).where(Lamp.lamp_id == c.lamp_id))).scalar_one_or_none()
        site = ops_for_city(await home_service.get_or_create_settings(), c.city)
        if not site.get("broadcast_coupons", True):
            return None
        chat = feature_chat(site, "broadcast_coupons")
        if not chat:
            return None
        text = render(items, lamp, await _bot_name())
        try:
            from bot.main import bot
            msg = await bot.send_message(chat, text, disable_web_page_preview=True)
        except Exception:
            logger.exception("coupon post failed (%s)", chat)
            return None
        c.post_chat, c.post_mid, c.post_closed = chat, int(getattr(msg, "message_id", 0) or 0) or None, False
        return c.post_mid


async def close(coupon_id: str, reason: str = "ended") -> bool:
    """Edit the batch's channel post to 「已结束」 and drop the links. Idempotent. Any item id works."""
    async with session_scope() as s:
        c, items = await _batch(s, coupon_id)
        if not c or not c.post_mid or c.post_closed:
            return False
        lamp = (await s.execute(select(Lamp).where(Lamp.lamp_id == c.lamp_id))).scalar_one_or_none()
        text = render(items, lamp, "", closed=_END_WORD.get(reason, "已结束"))
        try:
            from bot.main import bot
            await bot.edit_message_text(text, chat_id=c.post_chat, message_id=int(c.post_mid), disable_web_page_preview=True)
        except Exception as exc:
            if "not modified" not in str(exc).lower():
                logger.warning("coupon post close failed: %s", str(exc)[:200])
        c.post_closed = True
        return True


async def refresh(coupon_id: str) -> bool:
    """One item ran out but the batch is still open: re-render the post so that item shows 「已领完」."""
    async with session_scope() as s:
        c, items = await _batch(s, coupon_id)
        if not c or not c.post_mid or c.post_closed:
            return False
        lamp = (await s.execute(select(Lamp).where(Lamp.lamp_id == c.lamp_id))).scalar_one_or_none()
        text = render(items, lamp, await _bot_name())
        chat, mid = c.post_chat, int(c.post_mid)
    try:
        from bot.main import bot
        await bot.edit_message_text(text, chat_id=chat, message_id=mid, disable_web_page_preview=True)
    except Exception as exc:
        if "not modified" not in str(exc).lower():
            logger.warning("coupon post refresh failed: %s", str(exc)[:200])
        return False
    return True


async def job_close_due() -> int:
    """Every 10 min: close posts whose coupon expired / ended / was stopped / sold out."""
    now = datetime.utcnow()
    async with session_scope() as s:
        heads = (await s.execute(select(Coupon).where(
            Coupon.post_mid.is_not(None), or_(Coupon.post_closed.is_(False), Coupon.post_closed.is_(None))))).scalars().all()
        todo = []
        for h in heads:
            _, items = await _batch(s, h.coupon_id)
            items = items or [h]
            reason = ("expired" if h.ends_at <= now else "sold_out" if all(_full(x) for x in items)
                      else h.status if h.status != "active" else "")
            if reason:
                todo.append((h.coupon_id, reason))
    n = 0
    for cid, reason in todo:
        if await close(cid, reason):
            n += 1
    return n
