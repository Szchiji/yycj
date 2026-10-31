"""审核通过后按模板推送到频道，尽量发相册；带「查看详情」深链按钮，资料变更时同步编辑。

频道里不能用 WebApp 按钮（Telegram 限制），所以用 t.me/<bot>?startapp=… 打开小程序详情。
相册本身不能挂按钮：多图时先发相册，再发一条带按钮的文字卡；单图/无图则直接挂按钮。
"""
from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, InputMediaPhoto, InputMediaVideo

from bot.services import home_service
from bot.services.media_urls import enrich_media

logger = logging.getLogger(__name__)

DEFAULT_TPL = "🌙 月影车姬 · 新上架\n{称呼}\n📍 {地点}\n💰 {价位}\n{标签}\n{简介}\n{链接}"
UNLIST_MARK = "\n\n——\n⚠️ 已下架"


def normalize_chat(chat: str) -> str:
    raw = (chat or "").strip()
    if not raw:
        return ""
    if raw.startswith("https://t.me/"):
        tail = raw.split("?")[0].rstrip("/").rsplit("/", 1)[-1]
        return tail if tail.lstrip("-").isdigit() else "@" + tail.lstrip("@")
    return raw


def album_link(chat: str, message_id: int) -> str:
    raw = normalize_chat(chat)
    if raw.startswith("@"):
        return f"https://t.me/{raw[1:]}/{message_id}"
    digits = raw.lstrip("-")
    if digits.startswith("100") and len(digits) > 6:
        digits = digits[3:]
    return f"https://t.me/c/{digits}/{message_id}"


def fill_template(tpl: str, lamp: Dict[str, Any], extras: Optional[Dict[str, Any]], link: str) -> str:
    extras = extras or {}
    city = str(lamp.get("city") or "")
    district = str(lamp.get("district") or "")
    loc = " · ".join(x for x in (city, district) if x)
    tags = " ".join("#" + str(t) for t in (lamp.get("tags") or []) if t)
    mapping = {
        "称呼": lamp.get("title") or "",
        "title": lamp.get("title") or "",
        "花名": lamp.get("title") or "",
        "城市": city,
        "简介": (lamp.get("description") or "").strip(),
        "desc": (lamp.get("description") or "").strip(),
        "价位": lamp.get("price_text") or "面议",
        "price": lamp.get("price_text") or "面议",
        "区域": district,
        "地区": loc or district or city,
        "大致位置": lamp.get("approx_label") or "",
        "标签": tags,
        "tags": tags,
        "地点": loc,
        "loc": loc,
        "链接": link or "",
        "link": link or "",
    }
    for key, val in extras.items():
        if key and not str(key).startswith("_"):
            mapping[str(key)] = "" if val is None else str(val)
    if mapping.get("联系") and not mapping.get("微信"):
        mapping["微信"] = mapping["联系"]
    if mapping.get("微信") and not mapping.get("联系"):
        mapping["联系"] = mapping["微信"]
    text = tpl or DEFAULT_TPL
    for key, val in mapping.items():
        text = text.replace("{" + key + "}", str(val))
    text = re.sub(r"\{[^}]{1,20}\}", "", text)
    cleaned = []
    for line in text.splitlines():
        s = line.rstrip()
        if s.endswith("：") or s.endswith(":"):
            continue
        cleaned.append(s)
    return "\n".join(cleaned).strip()[:1024]


def _media_items(lamp: Dict[str, Any]) -> List[Tuple[str, str]]:
    items: List[Tuple[str, str]] = []
    for m in enrich_media(lamp.get("media"), lamp.get("photos"))[:10]:
        raw = str(m.get("file_id") or m.get("url") or "").strip()
        if not raw:
            continue
        items.append(((m.get("type") or "image"), raw))
    return items


def compact_id(lamp_id: str) -> str:
    return str(lamp_id or "").replace("-", "").lower()


def startapp_url(bot_username: str, lamp_id: str, kind: str = "s") -> str:
    """Channel-safe deep link into the Mini App detail (start_param → deep-open.js).

    kind: s=详情, r=详情+评价, c=详情+想聊聊. Telegram startapp 只允许 [A-Za-z0-9_-]，最长 64。
    """
    name = (bot_username or "").lstrip("@")
    lid = compact_id(lamp_id)
    if not name or len(lid) != 32:
        return ""
    prefix = {"s": "s_", "r": "r_", "c": "c_"}.get(kind, "s_")
    return f"https://t.me/{name}?startapp={prefix}{lid}"


def channel_kb(bot_username: str, lamp_id: str, *, cta: str = "想聊聊") -> Optional[InlineKeyboardMarkup]:
    """Inline URL buttons for a channel post. WebApp buttons are not allowed in channels."""
    detail = startapp_url(bot_username, lamp_id, "s")
    if not detail:
        return None
    review = startapp_url(bot_username, lamp_id, "r")
    chat = startapp_url(bot_username, lamp_id, "c")
    row1 = [InlineKeyboardButton(text="查看详情", url=detail)]
    row2 = []
    if review:
        row2.append(InlineKeyboardButton(text="看评价", url=review))
    if chat:
        row2.append(InlineKeyboardButton(text=(cta or "想聊聊")[:16], url=chat))
    rows = [row1]
    if row2:
        rows.append(row2)
    return InlineKeyboardMarkup(inline_keyboard=rows)


async def resolve_media_chat() -> Optional[str]:
    try:
        site = await home_service.get_or_create_settings()
        raw = normalize_chat(str(site.get("media_channel_id") or ""))
        if raw:
            return raw
    except Exception:
        logger.exception("resolve media chat from settings failed")
    from bot.config import get_settings
    chat = get_settings().media_storage_chat_id
    return str(chat) if chat else None


async def _remember(lamp_id: str, chat: str, mid: int, *, card_mid: Optional[int] = None) -> None:
    try:
        from bot.services.extras_store import remember_broadcast
        await remember_broadcast(lamp_id, chat, mid, card_mid=card_mid)
    except Exception:
        logger.exception("remember broadcast ref failed")


async def _caption(lamp: Dict[str, Any], extras: Optional[Dict[str, Any]]) -> tuple[str, str, str, InlineKeyboardMarkup | None]:
    from bot.services.home_feed import ops_for_city
    site = ops_for_city(await home_service.get_or_create_settings(), lamp.get("city"))
    chat = normalize_chat(str(site.get("broadcast_channel") or ""))
    from bot.services import bot_info
    ident = await bot_info.get_bot_identity()
    bot_name = ident.get("username") or ""
    detail = startapp_url(bot_name, str(lamp.get("lamp_id") or ""), "s")
    link = detail or bot_info.bot_tme_url(bot_name)
    merged = {}
    if isinstance(lamp.get("extras"), dict):
        merged.update(lamp.get("extras") or {})
    merged.update(extras or {})
    cta = site.get("chat_cta_label") or "想聊聊"
    merged.setdefault("聊天按钮", cta)
    caption = fill_template(str(site.get("broadcast_template") or ""), lamp, merged, link)
    kb = channel_kb(bot_name, str(lamp.get("lamp_id") or ""), cta=cta)
    return chat, caption, bot_name, kb


async def broadcast_listing(lamp: Dict[str, Any], extras: Optional[Dict[str, Any]] = None) -> Optional[str]:
    """Post (or re-post) a listing card. Skip when this lamp already has a remembered channel message
    — callers that want a fresh post (续期) should clear the ref first, or use update_broadcast."""
    from bot.services.extras_store import load_broadcast
    lid = str(lamp.get("lamp_id") or "")
    chat0, mid0 = await load_broadcast(lid)
    if chat0 and str(mid0).isdigit():
        # already posted: keep the original, just refresh caption/buttons
        return await update_broadcast(lamp, extras)

    chat, caption, _bot, kb = await _caption(lamp, extras)
    if not chat:
        return None
    from bot.main import bot
    items = _media_items(lamp)
    try:
        msg = None
        card_mid = None
        if len(items) >= 2:
            # media groups cannot carry a reply_markup — album first, then a text card with buttons
            group = []
            for i, (kind, raw) in enumerate(items):
                cap = caption if i == 0 else None
                if kind == "video":
                    group.append(InputMediaVideo(media=raw, caption=cap))
                else:
                    group.append(InputMediaPhoto(media=raw, caption=cap))
            msgs = await bot.send_media_group(chat, media=group)
            msg = msgs[0] if msgs else None
            card = await bot.send_message(chat, "👆 点击下方打开小程序", reply_markup=kb)
            card_mid = getattr(card, "message_id", None)
        elif len(items) == 1:
            kind, raw = items[0]
            if kind == "video":
                msg = await bot.send_video(chat, raw, caption=caption, reply_markup=kb)
            else:
                msg = await bot.send_photo(chat, raw, caption=caption, reply_markup=kb)
        else:
            msg = await bot.send_message(chat, caption, reply_markup=kb)
        mid = getattr(msg, "message_id", None)
        if mid:
            await _remember(lid, chat, int(mid), card_mid=int(card_mid) if card_mid else None)
            return album_link(chat, int(mid))
        return None
    except Exception:
        logger.exception("broadcast to %s failed", chat)
        return None


async def update_broadcast(lamp: Dict[str, Any], extras: Optional[Dict[str, Any]] = None) -> Optional[str]:
    """Refresh the original channel post's caption/text + buttons (price / info / renewal)."""
    from bot.services.extras_store import load_broadcast
    from bot.main import bot
    lid = str(lamp.get("lamp_id") or "")
    chat, mid = await load_broadcast(lid)
    if not chat or not str(mid).isdigit():
        return None
    _chat, caption, _bot, kb = await _caption(lamp, extras)
    card_mid = await _card_mid(lid)
    try:
        await bot.edit_message_caption(chat_id=chat, message_id=int(mid), caption=caption, reply_markup=kb if not card_mid else None)
    except Exception:
        try:
            await bot.edit_message_text(chat_id=chat, message_id=int(mid), text=caption, reply_markup=kb if not card_mid else None)
        except Exception:
            logger.exception("edit original broadcast failed")
            return None
    if card_mid:
        try:
            await bot.edit_message_reply_markup(chat_id=chat, message_id=int(card_mid), reply_markup=kb)
        except Exception:
            logger.warning("edit broadcast card buttons failed lamp=%s", lid[:8])
    return album_link(chat, int(mid))


async def _card_mid(lamp_id: str) -> Optional[int]:
    try:
        from bot.services.extras_store import load_broadcast_card
        return await load_broadcast_card(lamp_id)
    except Exception:
        return None


async def mark_unlist(lamp_id: str, *, reason: str = "") -> None:
    """Append 已下架 to the channel post and drop the buttons. Never raises."""
    from bot.services.extras_store import load_broadcast
    from bot.main import bot
    chat, mid = await load_broadcast(lamp_id)
    if not chat or not str(mid).isdigit():
        return
    card_mid = await _card_mid(lamp_id)
    try:
        from bot.services import search_service
        lamp = await search_service.get_lamp(lamp_id) or {"lamp_id": lamp_id, "title": ""}
        _, caption, _, _ = await _caption(lamp, None)
        if "已下架" not in caption:
            caption += f"\n\n——\n⚠️ 已下架（{reason[:20]}）" if reason else UNLIST_MARK
        # photo / album head carries a caption; a text-only post needs edit_message_text
        for edit in (
            lambda text: bot.edit_message_caption(chat_id=chat, message_id=int(mid), caption=text, reply_markup=None),
            lambda text: bot.edit_message_text(chat_id=chat, message_id=int(mid), text=text, reply_markup=None),
        ):
            try:
                await edit(caption)
                break
            except Exception:
                continue
        if card_mid:
            try:
                await bot.edit_message_text(chat_id=chat, message_id=int(card_mid), text="—— 已下架 ——", reply_markup=None)
            except Exception:
                try:
                    await bot.edit_message_reply_markup(chat_id=chat, message_id=int(card_mid), reply_markup=None)
                except Exception:
                    pass
    except Exception:
        logger.exception("mark unlist on channel failed lamp=%s", str(lamp_id)[:8])


async def broadcast_review(review: Dict[str, Any], lamp: Dict[str, Any]) -> Optional[str]:
    """Optional 精选评价 post (ops setting broadcast_reviews, default off). Failures are logged only."""
    from bot.services.home_feed import ops_for_city
    site = ops_for_city(await home_service.get_or_create_settings(), lamp.get("city"))
    if not site.get("broadcast_reviews"):
        return None
    chat = normalize_chat(str(site.get("broadcast_channel") or ""))
    if not chat:
        return None
    from bot.services import bot_info
    ident = await bot_info.get_bot_identity()
    bot_name = ident.get("username") or ""
    stars = int(review.get("stars") or 0)
    star = "★" * max(0, min(5, stars)) + "☆" * max(0, 5 - stars)
    import html as _html
    title = _html.escape(str(lamp.get("title") or "资料"))
    loc = _html.escape(" · ".join(x for x in (lamp.get("city"), lamp.get("district")) if x))
    text = _html.escape((review.get("text") or "").strip()[:400])
    body = f"🌟 精选评价 · {title}\n📍 {loc}\n{star}\n{text}".strip()
    detail = startapp_url(bot_name, str(lamp.get("lamp_id") or ""), "r")
    kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="看完整评价", url=detail)]]) if detail else None
    photos = list(review.get("photos") or [])[:3]
    from bot.main import bot
    try:
        if len(photos) >= 2:
            group = [InputMediaPhoto(media=p, caption=body if i == 0 else None) for i, p in enumerate(photos)]
            await bot.send_media_group(chat, media=group)
            msg = await bot.send_message(chat, "👆 精选评价", reply_markup=kb)
        elif len(photos) == 1:
            msg = await bot.send_photo(chat, photos[0], caption=body, reply_markup=kb)
        else:
            msg = await bot.send_message(chat, body, reply_markup=kb)
        mid = getattr(msg, "message_id", None)
        return album_link(chat, int(mid)) if mid else None
    except Exception:
        logger.exception("broadcast review failed")
        return None
