"""防刷：频率限制、文本重复检测。"""

from __future__ import annotations

import hashlib
import time
from collections import defaultdict
from typing import Dict, Tuple

_post_times: Dict[int, list] = defaultdict(list)
_report_times: Dict[int, list] = defaultdict(list)
_session_times: Dict[int, list] = defaultdict(list)
_text_hashes: Dict[str, float] = {}


def _prune(times: list, window_sec: int) -> list:
    now = time.time()
    return [t for t in times if now - t < window_sec]


def can_post(user_id: int, score: int, window_sec: int = 86400) -> Tuple[bool, str]:
    times = _prune(_post_times[user_id], window_sec)
    _post_times[user_id] = times
    limit = 2 if score < 400 else 5
    if len(times) >= limit:
        return False, f"今日投稿已达上限（{limit} 条），请明日再来。"
    return True, ""


def record_post(user_id: int) -> None:
    _post_times[user_id].append(time.time())


def can_report(user_id: int, window_sec: int = 21600) -> Tuple[bool, str]:
    times = _prune(_report_times[user_id], window_sec)
    _report_times[user_id] = times
    if len(times) >= 3:
        return False, "报告过于频繁，请 6 小时后再试。"
    return True, ""


def record_report(user_id: int) -> None:
    _report_times[user_id].append(time.time())


def can_start_session(user_id: int, score: int, window_sec: int = 86400) -> Tuple[bool, str]:
    times = _prune(_session_times[user_id], window_sec)
    _session_times[user_id] = times
    limit = 2 if score < 500 else 6
    if len(times) >= limit:
        return False, f"今日发起会话已达上限（{limit} 场）。"
    return True, ""


def record_session(user_id: int) -> None:
    _session_times[user_id].append(time.time())


def text_similarity_hash(text: str) -> str:
    normalized = "".join(text.lower().split())
    return hashlib.md5(normalized.encode("utf-8")).hexdigest()


def is_duplicate_text(text: str, ttl_sec: int = 86400) -> bool:
    h = text_similarity_hash(text)
    now = time.time()
    expired = [k for k, t in _text_hashes.items() if now - t > ttl_sec]
    for k in expired:
        del _text_hashes[k]
    if h in _text_hashes:
        return True
    _text_hashes[h] = now
    return False


def brush_factor_for_session(
    user_id: int,
    duration_minutes: float,
    message_count: int,
    score: int,
) -> float:
    """返回 0~0.8 的防刷系数 F。"""
    f = 0.0
    times = _prune(_session_times[user_id], 86400)
    if len(times) >= 3:
        f += 0.3
    if duration_minutes < 8 and message_count < 8:
        f += 0.4
    if score < 300:
        f += 0.2
    return min(0.8, f)
