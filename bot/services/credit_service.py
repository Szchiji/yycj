"""兰花信用分：结算、等级、遮蔽、恢复（对齐蓝图档位与会话钳制）。"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import or_, select

from bot.db import session_scope
from bot.models import CreditHistory, CreditTier, User, tier_from_score

# ---------- 蓝图高影响 Δ（与 Bot 审核回调、API 共用）----------
DELTA_POST_APPROVED = 15
DELTA_REPORT_VALID_REPORTER = 10
DELTA_REPORT_VALID_TARGET = -30
DELTA_MALICIOUS_REPORT = -15  # 驳回恶意/无效报告时扣举报人
SESSION_DELTA_MAX = 28
SESSION_DELTA_MIN = -15
SHADOW_MIN_DAYS = 3
DAILY_RECOVERY_POINTS = 5

# 档位说明（0–199 / 200–399 / 400–599 / 600–799 / 800+）
TIER_RANGES = [
    {"tier": CreditTier.DARK.value, "min": 0, "max": 199, "label": "暗月 · 月影遮蔽"},
    {"tier": CreditTier.NEW.value, "min": 200, "max": 399, "label": "新月"},
    {"tier": CreditTier.SILVER.value, "min": 400, "max": 599, "label": "银月"},
    {"tier": CreditTier.Gold.value if False else CreditTier.GOLD.value, "min": 600, "max": 799, "label": "金月"},
]
