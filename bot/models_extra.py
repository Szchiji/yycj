"""收藏等补充表。"""
from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import BigInteger, Date, DateTime, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from bot.models import Base


class Favorite(Base):
    __tablename__ = "favorites"
    __table_args__ = (UniqueConstraint("user_id", "lamp_id", name="uq_fav_user_lamp"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, index=True)
    lamp_id: Mapped[str] = mapped_column(String(36), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class LampView(Base):
    """浏览次数：每条资料每个北京日一行，每次打开详情 +1（老师看自己的不算）。Additive table, no migration."""
    __tablename__ = "lamp_views"
    __table_args__ = (UniqueConstraint("lamp_id", "day", name="uq_lamp_views_day"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    lamp_id: Mapped[str] = mapped_column(String(36), index=True)
    day: Mapped[date] = mapped_column(Date, index=True)  # Asia/Shanghai calendar day
    views: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
