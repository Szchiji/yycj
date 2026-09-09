"""数据模型与常量（与 MongoDB 文档结构对应）。"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


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


class UserDoc(BaseModel):
    user_id: int
    username: Optional[str] = None
    full_name: Optional[str] = None
    lanhua_score: int = 100
    tier: str = CreditTier.NEW.value
    shadow_days: int = 0
    shadow_reason: Optional[str] = None
    recovery_progress: float = 0.0
    total_earned: int = 0
    total_deducted: int = 0
    is_shadowed: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_recovery_at: Optional[datetime] = None

    def to_mongo(self) -> Dict[str, Any]:
        return self.model_dump()


class LampDoc(BaseModel):
    lamp_id: str
    user_id: int
    city: str
    title: str
    tags: List[str] = Field(default_factory=list)
    price: Optional[int] = None
    price_text: Optional[str] = None
    description: str = ""
    photos: List[str] = Field(default_factory=list)
    authenticity_score: int = 80
    credit_boost: int = 0
    status: str = LampStatus.PENDING.value
    match_score_hint: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    def to_mongo(self) -> Dict[str, Any]:
        return self.model_dump()


class SessionDoc(BaseModel):
    session_id: str
    lamp_id: str
    user_a_id: int
    user_b_id: int
    anonymous_a: str = "月影人 A"
    anonymous_b: str = "月影人 B"
    status: str = SessionStatus.PENDING.value
    message_count: int = 0
    media_count: int = 0
    has_praise: bool = False
    reported: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expire_at: Optional[datetime] = None
    last_activity: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    ai_quality_score: int = 50

    def to_mongo(self) -> Dict[str, Any]:
        return self.model_dump()


class PostDoc(BaseModel):
    post_id: str
    user_id: int
    lamp_data: Dict[str, Any]
    status: str = PostStatus.PENDING.value
    similarity_score: float = 0.0
    review_note: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    reviewed_at: Optional[datetime] = None

    def to_mongo(self) -> Dict[str, Any]:
        return self.model_dump()


class ReportDoc(BaseModel):
    report_id: str
    lamp_id: str
    reporter_id: int
    reason: str
    description: str = ""
    evidence: List[str] = Field(default_factory=list)
    status: str = ReportStatus.PENDING.value
    ai_verdict: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    reviewed_at: Optional[datetime] = None

    def to_mongo(self) -> Dict[str, Any]:
        return self.model_dump()


class CreditHistoryDoc(BaseModel):
    user_id: int
    time: datetime = Field(default_factory=datetime.utcnow)
    action: str
    delta: int
    reason: str
    related_id: Optional[str] = None

    def to_mongo(self) -> Dict[str, Any]:
        return self.model_dump()
