"""SQLAlchemy ORM 模型与业务常量。"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import List, Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class CreditTier(str, Enum):
    DARK = "暗月"
    NEW = "新月"
    SILVER = "银月"
    GOLD = "金月"
    FULL = "满月"


class LampStatus(str, Enum):
    ACTIVE = "active"
    GRAY = "gray"
    HIDDEN = "hidden"
    PENDING = "pending"
    REJECTED = "rejected"


class SessionStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    ENDED = "ended"


class PostStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class ReportStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"


class UserRole(str, Enum):
    TEACHER = "teacher"
    GUEST = "guest"
    MERCHANT = "merchant"


class ReviewStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    BRUSH = "brush"  # 刷评


def tier_from_score(score: int) -> CreditTier:
    if score < 200:
        return CreditTier.DARK
    if score < 400:
        return CreditTier.NEW
    if score < 600:
        return CreditTier.SILVER
    if score < 800:
        return CreditTier.GOLD
    return CreditTier.FULL


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    username: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    full_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    lanhua_score: Mapped[int] = mapped_column(Integer, default=100)
    tier: Mapped[str] = mapped_column(String(16), default=CreditTier.NEW.value)
    shadow_days: Mapped[int] = mapped_column(Integer, default=0)
    shadow_reason: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    recovery_progress: Mapped[float] = mapped_column(Float, default=0.0)
    total_earned: Mapped[int] = mapped_column(Integer, default=0)
    total_deducted: Mapped[int] = mapped_column(Integer, default=0)
    is_shadowed: Mapped[bool] = mapped_column(Boolean, default=False)
    role: Mapped[Optional[str]] = mapped_column(String(16), nullable=True, default=None)
    is_banned: Mapped[bool] = mapped_column(Boolean, default=False)
    ban_reason: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    guest_alias: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
    last_recovery_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class Lamp(Base):
    __tablename__ = "lamps"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    lamp_id: Mapped[str] = mapped_column(String(36), unique=True, index=True)
    user_id: Mapped[int] = mapped_column(BigInteger, index=True)
    city: Mapped[str] = mapped_column(String(32), index=True)
    title: Mapped[str] = mapped_column(String(128))
    tags: Mapped[List[str]] = mapped_column(ARRAY(String), default=list)
    price: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    price_text: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    description: Mapped[str] = mapped_column(Text, default="")
    photos: Mapped[list] = mapped_column(JSONB, default=list)
    district: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    approx_lat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    approx_lng: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    approx_label: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    media: Mapped[list] = mapped_column(JSONB, default=list)
    publisher_role: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    feed_pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    feed_pin_order: Mapped[int] = mapped_column(Integer, default=0)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, index=True)
    unlist_reason: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    authenticity_score: Mapped[int] = mapped_column(Integer, default=80)
    credit_boost: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(16), default=LampStatus.PENDING.value, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String(36), unique=True, index=True)
    lamp_id: Mapped[str] = mapped_column(String(36), index=True)
    user_a_id: Mapped[int] = mapped_column(BigInteger, index=True)
    user_b_id: Mapped[int] = mapped_column(BigInteger, index=True)
    anonymous_a: Mapped[str] = mapped_column(String(32), default="月影人 A")
    anonymous_b: Mapped[str] = mapped_column(String(32), default="月影人 B")
    status: Mapped[str] = mapped_column(String(16), default=SessionStatus.PENDING.value, index=True)
    message_count: Mapped[int] = mapped_column(Integer, default=0)
    media_count: Mapped[int] = mapped_column(Integer, default=0)
    has_praise: Mapped[bool] = mapped_column(Boolean, default=False)
    reported: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    expire_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, index=True)
    last_activity: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    messages_purge_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True, index=True
    )
    quality_score: Mapped[int] = mapped_column(Integer, default=50)


class SessionMessage(Base):
    """会话中转消息落库（管理员可读；到期清理）。"""

    __tablename__ = "session_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("sessions.session_id", ondelete="CASCADE"),
        index=True,
    )
    from_role: Mapped[str] = mapped_column(String(8))
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    media_type: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    file_id: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True)


class Post(Base):
    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    post_id: Mapped[str] = mapped_column(String(36), unique=True, index=True)
    user_id: Mapped[int] = mapped_column(BigInteger, index=True)
    lamp_data: Mapped[dict] = mapped_column(JSONB, default=dict)
    status: Mapped[str] = mapped_column(String(16), default=PostStatus.PENDING.value)
    similarity_score: Mapped[float] = mapped_column(Float, default=0.0)
    review_note: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    report_id: Mapped[str] = mapped_column(String(36), unique=True, index=True)
    lamp_id: Mapped[str] = mapped_column(String(36), index=True)
    reporter_id: Mapped[int] = mapped_column(BigInteger, index=True)
    reason: Mapped[str] = mapped_column(String(64))
    description: Mapped[str] = mapped_column(Text, default="")
    evidence: Mapped[list] = mapped_column(JSONB, default=list)
    status: Mapped[str] = mapped_column(String(16), default=ReportStatus.PENDING.value)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class CreditHistory(Base):
    __tablename__ = "credit_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, index=True)
    time: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    action: Mapped[str] = mapped_column(String(64))
    delta: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(String(256))
    related_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)


class SiteSettings(Base):
    """单行站点配置（announcement / enabled_cities）。"""

    __tablename__ = "site_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    key: Mapped[str] = mapped_column(String(64), unique=True, index=True, default="default")
    announcement_text: Mapped[str] = mapped_column(Text, default="")
    announcement_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    enabled_cities: Mapped[list] = mapped_column(JSONB, default=list)
    ops_config: Mapped[dict] = mapped_column(JSONB, default=dict)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )


class HomepagePin(Base):
    """首页精选轮播（管理员手动置顶 + 可选过期）。"""

    __tablename__ = "homepage_pins"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    lamp_id: Mapped[str] = mapped_column(String(36), index=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    created_by: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)


class Review(Base):
    """客人评价（会话结束后提交，管理员审核后展示）。"""

    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    review_id: Mapped[str] = mapped_column(String(36), unique=True, index=True)
    session_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    lamp_id: Mapped[str] = mapped_column(String(36), index=True)
    target_user_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True, index=True)
    guest_id: Mapped[int] = mapped_column(BigInteger, index=True)
    stars: Mapped[int] = mapped_column(Integer, default=5)
    text: Mapped[str] = mapped_column(Text, default="")
    photos: Mapped[list] = mapped_column(JSONB, default=list)
    status: Mapped[str] = mapped_column(
        String(16), default=ReviewStatus.PENDING.value, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    review_note: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
