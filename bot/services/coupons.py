"""老师优惠券：老师在「我的 · 我的优惠」自己发，客人「领取」拿到一个码，到店出示。

Rules (kept small on purpose):
  · 每位老师同一时间最多 1 张有效优惠；发新的会自动结束旧的。可以随时提前结束。
  · 有效期 1 / 2 / 3 / 7 天；内容最多 40 字；可选限 N 张（1–200）。
  · 客人每张只能领 1 次，领满即止；老师看得到谁领了、可以标记「已用」。
  · 不需要先审核：发出即显示，后台可以按城市查看并停用（DEFAULT, flagged as a decision）。
"""
from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, Iterable, List, Optional, Set

from sqlalchemy import select, update

from bot.db import session_scope
from bot.models import Lamp, LampStatus, User
from bot.models_extra import Coupon, CouponClaim

PRESET_DAYS = (1, 2, 3, 7)
MAX_TEXT = 40
MAX_QUOTA = 200
_ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


class CouponError(ValueError):
    pass


def _now() -> datetime:
    return datetime.utcnow()


def _iso(dt: Optional[datetime]) -> Optional[str]:
    return dt.replace(microsecond=0).isoformat() + "Z" if dt else None


def left_label(ends_at: datetime, now: Optional[datetime] = None) -> str:
    sec = int((ends_at - (now or _now())).total_seconds())
    if sec <= 0:
        return "已结束"
    d, h = sec // 86400, (sec % 86400) // 3600
    if d >= 1:
        return f"还剩{d}天{h}小时" if h else f"还剩{d}天"
    if h >= 1:
        return f"还剩{h}小时"
    return f"还剩{max(1, sec // 60)}分钟"


def is_live(c: Coupon, now: Optional[datetime] = None) -> bool:
    return c.status == "active" and c.ends_at > (now or _now()) and not (c.quota and c.claimed >= c.quota)


def public(c: Coupon, mine: Optional[CouponClaim] = None) -> Dict[str, Any]:
    now = _now()
    out = {
        "coupon_id": c.coupon_id, "lamp_id": c.lamp_id, "city": c.city, "text": c.text,
        "ends_at": _iso(c.ends_at), "left": left_label(c.ends_at, now),
        "quota": int(c.quota or 0), "claimed": int(c.claimed or 0),
        "remain": (max(0, int(c.quota) - int(c.claimed or 0)) if c.quota else None),
        "live": is_live(c, now),
        "status": c.status if c.status != "active" else ("expired" if c.ends_at <= now else ("sold_out" if c.quota and c.claimed >= c.quota else "active")),
    }
    if mine is not None:
        out["my_code"] = mine.code
        out["my_used"] = bool(mine.used_at)
    return out


def clean_text(raw: Any) -> str:
    t = " ".join(str(raw or "").split())
    if not t:
        raise CouponError("请写优惠内容，比如「P100 PP200」")
    if len(t) > MAX_TEXT:
        raise CouponError(f"优惠内容最多 {MAX_TEXT} 个字")
    if "http" in t.lower() or "t.me" in t.lower() or "@" in t:
        raise CouponError("优惠内容里不能放链接或 @账号")
    return t


async def _active_of(s, user_id: int) -> Optional[Coupon]:
    return (await s.execute(select(Coupon).where(Coupon.user_id == user_id, Coupon.status == "active")
                            .order_by(Coupon.id.desc()).limit(1))).scalar_one_or_none()


async def create(user_id: int, text: Any, days: Any, quota: Any = 0) -> Dict[str, Any]:
    body = clean_text(text)
    try:
        d = int(days)
    except (TypeError, ValueError):
        d = 0
    if d not in PRESET_DAYS:
        raise CouponError("有效期只能选 1 / 2 / 3 / 7 天")
    try:
        q = int(quota or 0)
    except (TypeError, ValueError):
        q = -1
    if q < 0 or q > MAX_QUOTA:
        raise CouponError(f"限量填 1–{MAX_QUOTA} 张，或者不限")
    async with session_scope() as s:
        lamp = (await s.execute(select(Lamp).where(Lamp.user_id == user_id, Lamp.status == LampStatus.ACTIVE.value)
                                .order_by(Lamp.id.desc()).limit(1))).scalar_one_or_none()
        if not lamp:
            raise CouponError("资料上架后才能发优惠")
        await s.execute(update(Coupon).where(Coupon.user_id == user_id, Coupon.status == "active").values(status="ended"))
        c = Coupon(coupon_id=str(uuid.uuid4()), user_id=user_id, lamp_id=lamp.lamp_id, city=lamp.city or "",
                   text=body, ends_at=_now() + timedelta(days=d), quota=q, claimed=0, status="active")
        s.add(c)
        await s.flush()
        return public(c)


async def end(user_id: int) -> bool:
    async with session_scope() as s:
        r = await s.execute(update(Coupon).where(Coupon.user_id == user_id, Coupon.status == "active").values(status="ended"))
        return bool(r.rowcount)


async def mine(user_id: int) -> Dict[str, Any]:
    async with session_scope() as s:
        c = await _active_of(s, user_id)
        if c and c.ends_at <= _now():
            c.status = "ended"
            c = None
        has_lamp = (await s.execute(select(Lamp.id).where(Lamp.user_id == user_id, Lamp.status == LampStatus.ACTIVE.value).limit(1))).first() is not None
        claims: List[Dict[str, Any]] = []
        if c:
            rows = (await s.execute(select(CouponClaim, User.guest_alias).outerjoin(User, User.user_id == CouponClaim.user_id)
                                    .where(CouponClaim.coupon_id == c.coupon_id).order_by(CouponClaim.id.desc()))).all()
            claims = [{"code": cl.code, "who": alias or "客人", "used": bool(cl.used_at), "at": _iso(cl.created_at)} for cl, alias in rows]
        return {"current": public(c) if c else None, "claims": claims, "can_issue": has_lamp,
                "presets": list(PRESET_DAYS), "max_text": MAX_TEXT, "max_quota": MAX_QUOTA}


async def mark_used(user_id: int, code: str, used: bool = True) -> bool:
    code = (code or "").strip().upper()
    async with session_scope() as s:
        row = (await s.execute(select(CouponClaim).join(Coupon, Coupon.coupon_id == CouponClaim.coupon_id)
                               .where(Coupon.user_id == user_id, CouponClaim.code == code)
                               .order_by(CouponClaim.id.desc()).limit(1))).scalar_one_or_none()
        if not row:
            return False
        row.used_at = _now() if used else None
        return True


async def for_lamp(lamp_id: str, viewer: Optional[int] = None) -> Optional[Dict[str, Any]]:
    async with session_scope() as s:
        c = (await s.execute(select(Coupon).where(Coupon.lamp_id == lamp_id, Coupon.status == "active")
                             .order_by(Coupon.id.desc()).limit(1))).scalar_one_or_none()
        if not c or c.ends_at <= _now():
            return None
        mine_ = None
        if viewer:
            mine_ = (await s.execute(select(CouponClaim).where(CouponClaim.coupon_id == c.coupon_id, CouponClaim.user_id == viewer))).scalar_one_or_none()
        out = public(c, mine_)
        out["own"] = bool(viewer and viewer == c.user_id)
        return out


async def live_by_lamp(lamp_ids: Iterable[str]) -> Dict[str, Dict[str, Any]]:
    ids = [x for x in lamp_ids if x]
    if not ids:
        return {}
    now = _now()
    async with session_scope() as s:
        rows = (await s.execute(select(Coupon).where(Coupon.lamp_id.in_(ids), Coupon.status == "active", Coupon.ends_at > now))).scalars().all()
    return {c.lamp_id: {"text": c.text, "left": left_label(c.ends_at, now)} for c in rows if is_live(c, now)}


async def live_lamp_ids(city: Optional[str]) -> Set[str]:
    now = _now()
    async with session_scope() as s:
        q = select(Coupon).where(Coupon.status == "active", Coupon.ends_at > now)
        if city:
            q = q.where(Coupon.city == city)
        rows = (await s.execute(q)).scalars().all()
    return {c.lamp_id for c in rows if is_live(c, now)}


async def claim(user_id: int, coupon_id: str) -> Dict[str, Any]:
    async with session_scope() as s:
        c = (await s.execute(select(Coupon).where(Coupon.coupon_id == coupon_id).with_for_update())).scalar_one_or_none()
        if not c:
            raise CouponError("优惠不存在")
        if c.user_id == user_id:
            raise CouponError("不能领自己的优惠")
        had = (await s.execute(select(CouponClaim).where(CouponClaim.coupon_id == coupon_id, CouponClaim.user_id == user_id))).scalar_one_or_none()
        if had:
            return public(c, had)
        if c.status != "active" or c.ends_at <= _now():
            raise CouponError("这个优惠已结束")
        if c.quota and c.claimed >= c.quota:
            raise CouponError("已经领完了")
        cl = CouponClaim(coupon_id=coupon_id, user_id=user_id, code="".join(secrets.choice(_ALPHA) for _ in range(6)))
        s.add(cl)
        c.claimed = int(c.claimed or 0) + 1
        await s.flush()
        return public(c, cl)


async def my_claims(user_id: int) -> List[Dict[str, Any]]:
    async with session_scope() as s:
        rows = (await s.execute(select(CouponClaim, Coupon, Lamp.title).join(Coupon, Coupon.coupon_id == CouponClaim.coupon_id)
                                .outerjoin(Lamp, Lamp.lamp_id == Coupon.lamp_id)
                                .where(CouponClaim.user_id == user_id).order_by(CouponClaim.id.desc()).limit(30))).all()
    out = []
    for cl, c, title in rows:
        d = public(c, cl)
        d["title"] = title or ""
        out.append(d)
    return out


async def city_list(city: Optional[str], limit: int = 30) -> List[Dict[str, Any]]:
    now = _now()
    async with session_scope() as s:
        q = select(Coupon, Lamp).join(Lamp, Lamp.lamp_id == Coupon.lamp_id).where(
            Coupon.status == "active", Coupon.ends_at > now, Lamp.status == LampStatus.ACTIVE.value)
        if city:
            q = q.where(Coupon.city == city)
        rows = (await s.execute(q.order_by(Coupon.ends_at.asc()).limit(limit * 2))).all()
    out = []
    for c, lamp in rows:
        if not is_live(c, now):
            continue
        d = public(c)
        d.update({"title": lamp.title, "district": lamp.district or "", "price_text": lamp.price_text or ""})
        out.append(d)
    return out[:limit]


async def admin_list(cities: Optional[Set[str]], status: str = "active", limit: int = 100) -> List[Dict[str, Any]]:
    now = _now()
    async with session_scope() as s:
        q = select(Coupon, Lamp.title).outerjoin(Lamp, Lamp.lamp_id == Coupon.lamp_id)
        if cities is not None:
            q = q.where(Coupon.city.in_(list(cities)))
        if status == "active":
            q = q.where(Coupon.status == "active", Coupon.ends_at > now)
        rows = (await s.execute(q.order_by(Coupon.id.desc()).limit(limit))).all()
    out = []
    for c, title in rows:
        d = public(c)
        d.update({"title": title or "", "user_id": c.user_id, "created_at": _iso(c.created_at), "stopped_by": c.stopped_by})
        out.append(d)
    return out


async def admin_stop(coupon_id: str, admin_id: int) -> Optional[str]:
    async with session_scope() as s:
        c = (await s.execute(select(Coupon).where(Coupon.coupon_id == coupon_id))).scalar_one_or_none()
        if not c:
            return None
        c.status, c.stopped_by = "stopped", admin_id
        return c.city
