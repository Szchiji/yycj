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
# 「我的」里的整理规则（数据库里一直保留，后台统计不受影响）
DONE_HIDE_DAYS = 7     # 客人：已用 / 已失效的券，过了这么多天就不再显示
HISTORY_DAYS = 30      # 老师：往期优惠显示最近这么多天内结束的
HISTORY_MAX = 5        # 老师：往期优惠最多显示几个
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
        out["my_valid"] = code_valid(c, mine, now)
    return out


def code_valid(c: Coupon, cl: CouponClaim, now: Optional[datetime] = None) -> bool:
    """A claimed code is good until the coupon's own end time (not claim time + N), even if the teacher
    ended the coupon early or it sold out. Void once used or when the admin stopped the coupon."""
    return not cl.used_at and c.status != "stopped" and c.ends_at > (now or _now())


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
        old = [x for (x,) in (await s.execute(select(Coupon.coupon_id).where(Coupon.user_id == user_id, Coupon.status == "active"))).all()]
        await s.execute(update(Coupon).where(Coupon.user_id == user_id, Coupon.status == "active").values(status="ended"))
        c = Coupon(coupon_id=str(uuid.uuid4()), user_id=user_id, lamp_id=lamp.lamp_id, city=lamp.city or "",
                   text=body, ends_at=_now() + timedelta(days=d), quota=q, claimed=0, status="active")
        s.add(c)
        await s.flush()
        out = public(c)
    await _after_change(old, "ended")
    await _publish(out["coupon_id"])
    return out


async def _publish(coupon_id: str) -> None:
    try:
        from bot.services import coupon_push
        await coupon_push.publish(coupon_id)
    except Exception:
        import logging
        logging.getLogger(__name__).exception("coupon publish failed")


async def _after_change(coupon_ids, reason: str) -> None:
    from bot.services import coupon_push
    for cid in coupon_ids or []:
        try:
            await coupon_push.close(cid, reason)
        except Exception:
            import logging
            logging.getLogger(__name__).exception("coupon post close failed")


async def end(user_id: int) -> bool:
    """提前结束: no new claims. Codes already claimed stay valid until the coupon's own end time."""
    async with session_scope() as s:
        ids = [x for (x,) in (await s.execute(select(Coupon.coupon_id).where(Coupon.user_id == user_id, Coupon.status == "active"))).all()]
        await s.execute(update(Coupon).where(Coupon.user_id == user_id, Coupon.status == "active").values(status="ended"))
    await _after_change(ids, "ended")
    return bool(ids)


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
            claims = [{"code": cl.code, "who": alias or "客人", "used": bool(cl.used_at), "valid": code_valid(c, cl),
                       "state": claim_state(c, cl), "at": _iso(cl.created_at)} for cl, alias in rows]
        history = await _history(s, user_id, c.coupon_id if c else None, _now())
        has_claims = (await s.execute(select(CouponClaim.id).join(Coupon, Coupon.coupon_id == CouponClaim.coupon_id)
                                      .where(Coupon.user_id == user_id).limit(1))).first() is not None
        return {"current": public(c) if c else None, "claims": claims, "history": history, "history_days": HISTORY_DAYS,
                "can_issue": has_lamp, "has_claims": has_claims,
                "presets": list(PRESET_DAYS), "max_text": MAX_TEXT, "max_quota": MAX_QUOTA}


def claim_state(c: Coupon, cl: CouponClaim, now: Optional[datetime] = None) -> str:
    """usable / used / void (expired or stopped)."""
    if cl.used_at:
        return "used"
    return "usable" if code_valid(c, cl, now) else "void"


def done_at(c: Coupon, cl: CouponClaim) -> Optional[datetime]:
    """When a code stopped being usable: used_at, else the coupon's own end time (also for 停用)."""
    return cl.used_at or c.ends_at


def _history_status(c: Coupon, now: datetime) -> str:
    if c.status == "stopped":
        return "已停用"
    if c.ends_at > now:
        return "已提前结束 · 已领的券码" + left_label(c.ends_at, now).replace("还剩", "还能用")
    return "已过期"


async def _history(s, user_id: int, current_id: Optional[str], now: datetime) -> List[Dict[str, Any]]:
    since = now - timedelta(days=HISTORY_DAYS)
    q = select(Coupon).where(Coupon.user_id == user_id, Coupon.ends_at >= since)
    if current_id:
        q = q.where(Coupon.coupon_id != current_id)
    olds = (await s.execute(q.order_by(Coupon.id.desc()).limit(HISTORY_MAX))).scalars().all()
    out: List[Dict[str, Any]] = []
    for c in olds:
        rows = (await s.execute(select(CouponClaim, User.guest_alias).outerjoin(User, User.user_id == CouponClaim.user_id)
                                .where(CouponClaim.coupon_id == c.coupon_id).order_by(CouponClaim.id.desc()))).all()
        cls = [{"code": cl.code, "who": alias or "客人", "used": bool(cl.used_at), "valid": code_valid(c, cl, now),
                "state": claim_state(c, cl, now), "can_undo": c.status != "stopped" and c.ends_at > now} for cl, alias in rows]
        out.append({"coupon_id": c.coupon_id, "text": c.text, "ends_at": _iso(c.ends_at), "status": _history_status(c, now),
                    "claimed": len(cls), "used": sum(1 for x in cls if x["used"]),
                    "pending": sum(1 for x in cls if x["state"] == "usable"), "claims": cls})
    return out


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
            if viewer:   # teacher ended it early / it sold out: the guest's code is still valid until ends_at
                row = (await s.execute(select(Coupon, CouponClaim).join(CouponClaim, CouponClaim.coupon_id == Coupon.coupon_id)
                                       .where(Coupon.lamp_id == lamp_id, CouponClaim.user_id == viewer)
                                       .order_by(CouponClaim.id.desc()).limit(1))).first()
                if row and code_valid(row[0], row[1]):
                    out = public(row[0], row[1])
                    out["own"] = False
                    return out
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
        out = public(c, cl)
        full = bool(c.quota and c.claimed >= c.quota)
    if full:
        await _after_change([coupon_id], "sold_out")
    return out


async def my_claims(user_id: int) -> Dict[str, Any]:
    """客人「我的优惠券」: usable codes first; 已用 / 已失效 listed separately and hidden after DONE_HIDE_DAYS
    (rows stay in the DB)."""
    now = _now()
    cut = now - timedelta(days=DONE_HIDE_DAYS)
    async with session_scope() as s:
        rows = (await s.execute(select(CouponClaim, Coupon, Lamp.title).join(Coupon, Coupon.coupon_id == CouponClaim.coupon_id)
                                .outerjoin(Lamp, Lamp.lamp_id == Coupon.lamp_id)
                                .where(CouponClaim.user_id == user_id).order_by(CouponClaim.id.desc()).limit(100))).all()
    usable: List[Dict[str, Any]] = []
    done: List[Dict[str, Any]] = []
    hidden = 0
    for cl, c, title in rows:
        st = claim_state(c, cl, now)
        d = public(c, cl)
        d["title"] = title or ""
        d["state"] = st
        if st == "usable":
            usable.append(d)
            continue
        when = done_at(c, cl)
        if when and when < cut:
            hidden += 1
            continue
        d["done_at"] = _iso(when)
        done.append(d)
    usable.sort(key=lambda x: x.get("ends_at") or "")   # soonest to expire first
    done.sort(key=lambda x: x.get("done_at") or "", reverse=True)
    return {"items": usable + done, "usable": len(usable), "done": len(done), "hidden": hidden, "hide_days": DONE_HIDE_DAYS}


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
        city = c.city
    await _after_change([coupon_id], "stopped")
    return city


async def lookup(user_id: int, code: str) -> Optional[Dict[str, Any]]:
    """老师核销: find a code among this teacher's coupons (current or earlier)."""
    code = (code or "").strip().upper()
    if not code:
        return None
    async with session_scope() as s:
        row = (await s.execute(select(CouponClaim, Coupon, User.guest_alias).join(Coupon, Coupon.coupon_id == CouponClaim.coupon_id)
                               .outerjoin(User, User.user_id == CouponClaim.user_id)
                               .where(Coupon.user_id == user_id, CouponClaim.code == code)
                               .order_by(CouponClaim.id.desc()).limit(1))).first()
    if not row:
        return None
    cl, c, alias = row
    return {"code": cl.code, "who": alias or "客人", "used": bool(cl.used_at), "valid": code_valid(c, cl),
            "text": c.text, "ends_at": _iso(c.ends_at), "left": left_label(c.ends_at)}


async def held_code(guest_id: int, teacher_id: int) -> Optional[Dict[str, Any]]:
    """The guest's newest unused, valid code for this teacher (约课 / 想聊聊 carries it to the teacher)."""
    async with session_scope() as s:
        rows = (await s.execute(select(CouponClaim, Coupon).join(Coupon, Coupon.coupon_id == CouponClaim.coupon_id)
                                .where(Coupon.user_id == teacher_id, CouponClaim.user_id == guest_id)
                                .order_by(CouponClaim.id.desc()).limit(5))).all()
    for cl, c in rows:
        if code_valid(c, cl):
            return {"code": cl.code, "text": c.text, "ends_at": c.ends_at}
    return None
