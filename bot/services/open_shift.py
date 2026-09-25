"""营业时段 + 凌晨开课提醒。"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo

from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup
from sqlalchemy import select

from bot.db import session_scope
from bot.models import Lamp, LampStatus
from bot.services.extras_store import load_extras, save_extras

logger = logging.getLogger(__name__)
TZ = ZoneInfo("Asia/Shanghai")
TIMEOUT_MIN = 90


def now_sh() -> datetime:
    return datetime.now(TZ)


def today_str() -> str:
    return now_sh().strftime("%Y-%m-%d")


def parse_hours(raw: Any) -> List[Tuple[str, str]]:
    if isinstance(raw, list):
        out = []
        for it in raw:
            if isinstance(it, dict):
                a, b = str(it.get("start") or "").strip(), str(it.get("end") or "").strip()
            else:
                a, b = "", ""
            if a and b:
                out.append((a[:5], b[:5]))
        return out[:3]
    raw_text = str(raw or "").strip()
    if "-" in raw_text:
        a, b = raw_text.split("-", 1)
        a, b = a.strip()[:5], b.strip()[:5]
        if a and b:
            return [(a, b)]
    return []


def hours_label(hours: List[Tuple[str, str]]) -> str:
    if not hours:
        return ""
    parts = []
    for a, b in hours:
        if b <= a:
            parts.append(f"{a}–次日{b}")
        else:
            parts.append(f"{a}–{b}")
    return "、".join(parts)


def in_hours(hours: List[Tuple[str, str]], when: Optional[datetime] = None) -> bool:
    if not hours:
        return False
    when = when or now_sh()
    cur = when.hour * 60 + when.minute
    for a, b in hours:
        try:
            ah, am = [int(x) for x in a.split(":")[:2]]
            bh, bm = [int(x) for x in b.split(":")[:2]]
        except Exception:
            continue
        start, end = ah * 60 + am, bh * 60 + bm
        if end <= start:
            if cur >= start or cur < end:
                return True
        elif start <= cur < end:
            return True
    return False


def shop_status(extras: Dict[str, Any] | None, status: str | None = None, expires_at: Any = None) -> Dict[str, Any]:
    extras = extras or {}
    hours = parse_hours(extras.get("_hours") or extras.get("hours"))
    label = hours_label(hours)
    if status and status != LampStatus.ACTIVE.value:
        return {"code": "off", "text": "", "hours": label, "remind_on": False}
    if expires_at:
        exp = expires_at
        if getattr(exp, "tzinfo", None):
            exp = exp.replace(tzinfo=None)
        if isinstance(exp, datetime) and exp <= datetime.utcnow():
            return {"code": "off", "text": "", "hours": label, "remind_on": False}
    if not hours:
        return {"code": "unset", "text": "", "hours": "", "remind_on": extras.get("_remind_on") == "1"}
    open_today = extras.get("_open_today") == "1" and extras.get("_open_date") == today_str()
    remind_on = extras.get("_remind_on") != "0"
    if not open_today:
        return {"code": "rest", "text": "休息中", "hours": label, "remind_on": remind_on}
    if in_hours(hours):
        return {"code": "open", "text": "营业中", "hours": label, "remind_on": remind_on}
    return {"code": "wait", "text": "未到点", "hours": label, "remind_on": remind_on}


def _kb(lamp_id: str, day: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="今日开课", callback_data=f"shift:open:{lamp_id}:{day}"),
                InlineKeyboardButton(text="今日休息", callback_data=f"shift:rest:{lamp_id}:{day}"),
            ]
        ]
    )


async def apply_choice(lamp_id: str, user_id: int, action: str, day: str) -> str:
    extras = await load_extras(lamp_id)
    async with session_scope() as s:
        row = (await s.execute(select(Lamp).where(Lamp.lamp_id == lamp_id))).scalar_one_or_none()
        if not row:
            return "找不到资料"
        if int(row.user_id) != int(user_id):
            return "这不是你的资料"
        if row.status != LampStatus.ACTIVE.value:
            return "资料未上架"
        if row.expires_at and row.expires_at <= datetime.utcnow():
            return "资料已到期"
        title = row.title
    if day != today_str():
        return "这条提醒已过期"
    extras["_open_date"] = day
    extras["_remind_pending"] = "0"
    extras["_remind_sent_at"] = extras.get("_remind_sent_at") or now_sh().isoformat()
    if action == "open":
        extras["_open_today"] = "1"
        extras["_remind_on"] = "1"
        msg = f"已记：{title} · 今日开课"
    else:
        extras["_open_today"] = "0"
        extras["_remind_on"] = "0"
        msg = f"已记：{title} · 今日休息，之后不再提醒"
    await save_extras(lamp_id, extras)
    return msg


async def resume_remind(lamp_id: str, user_id: int) -> str:
    return await apply_choice(lamp_id, user_id, "open", today_str())


async def send_daily() -> int:
    day = today_str()
    sent = 0
    async with session_scope() as s:
        rows = (await s.execute(select(Lamp).where(Lamp.status == LampStatus.ACTIVE.value))).scalars().all()
        lamps = [
            {"lamp_id": r.lamp_id, "user_id": r.user_id, "title": r.title, "expires_at": r.expires_at}
            for r in rows
        ]
    try:
        from bot.main import bot
    except Exception:
        return 0
    grouped: Dict[int, List[Dict[str, Any]]] = {}
    for lamp in lamps:
        if lamp.get("expires_at") and lamp["expires_at"] <= datetime.utcnow():
            continue
        extras = await load_extras(lamp["lamp_id"])
        hours = parse_hours(extras.get("_hours") or extras.get("hours"))
        if not hours:
            continue
        if extras.get("_remind_on") == "0":
            extras["_open_today"] = "0"
            extras["_open_date"] = day
            await save_extras(lamp["lamp_id"], extras)
            continue
        if extras.get("_remind_sent_date") == day:
            continue
        extras["_open_today"] = "0"
        extras["_open_date"] = day
        extras["_remind_on"] = "1"
        extras["_remind_pending"] = "1"
        extras["_remind_sent_at"] = now_sh().isoformat()
        extras["_remind_sent_date"] = day
        await save_extras(lamp["lamp_id"], extras)
        grouped.setdefault(int(lamp["user_id"]), []).append(lamp)
    for uid, items in grouped.items():
        try:
            batch = items if len(items) <= 3 else items[:8]
            if len(items) > 3:
                await bot.send_message(uid, f"你有 {len(items)} 条在架资料，请逐条确认今日是否开课。")
            for lamp in batch:
                await bot.send_message(
                    uid,
                    f"「{lamp['title']}」今日开课吗？",
                    reply_markup=_kb(lamp["lamp_id"], day),
                )
            sent += 1
        except Exception:
            logger.exception("shift remind failed %s", uid)
    return sent


async def expire_unanswered() -> int:
    n = 0
    cutoff = now_sh() - timedelta(minutes=TIMEOUT_MIN)
    async with session_scope() as s:
        rows = (await s.execute(select(Lamp).where(Lamp.status == LampStatus.ACTIVE.value))).scalars().all()
        ids = [r.lamp_id for r in rows]
    for lid in ids:
        extras = await load_extras(lid)
        if extras.get("_remind_pending") != "1":
            continue
        raw = extras.get("_remind_sent_at") or ""
        try:
            sent_at = datetime.fromisoformat(str(raw))
            if sent_at.tzinfo is None:
                sent_at = sent_at.replace(tzinfo=TZ)
        except Exception:
            continue
        if sent_at > cutoff:
            continue
        extras["_open_today"] = "0"
        extras["_remind_on"] = "0"
        extras["_remind_pending"] = "0"
        await save_extras(lid, extras)
        n += 1
    return n
