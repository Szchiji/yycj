"""简易防刷：频率限制 + 文本相似度。"""

from __future__ import annotations

import re
import time
from collections import defaultdict, deque
from typing import Deque, Dict, Tuple

# 内存级滑动窗口（单进程 webhook 足够；多实例可换 Redis）
_hits: Dict[str, Deque[float]] = defaultdict(deque)
_recent_text: Dict[int, Deque[str]] = defaultdict(lambda: deque(maxlen=20))


def _prune(q: Deque[float], window: float) -> None:
    now = time.time()
    while q and now - q[0] > window:
        q.popleft()


def allow(key: str, limit: int, window_sec: float) -> bool:
    q = _hits[key]
    _prune(q, window_sec)
    if len(q) >= limit:
        return False
    q.append(time.time())
    return True


def check_post_rate(user_id: int) -> bool:
    return allow(f"post:{user_id}", limit=3, window_sec=3600)


def check_report_rate(user_id: int) -> bool:
    return allow(f"report:{user_id}", limit=5, window_sec=3600)


def check_search_rate(user_id: int) -> bool:
    return allow(f"search:{user_id}", limit=30, window_sec=60)


def check_session_request_rate(user_id: int) -> bool:
    return allow(f"sessreq:{user_id}", limit=5, window_sec=3600)


def _normalize(text: str) -> str:
    t = text.lower().strip()
    t = re.sub(r"\s+", "", t)
    return t


def text_too_similar(user_id: int, text: str, threshold: float = 0.85) -> bool:
    """字符 bigram Jaccard 近似。"""
    norm = _normalize(text)
    if len(norm) < 8:
        _recent_text[user_id].append(norm)
        return False

    def grams(s: str) -> set:
        return {s[i : i + 2] for i in range(len(s) - 1)} or {s}

    g1 = grams(norm)
    for old in _recent_text[user_id]:
        g2 = grams(old)
        inter = len(g1 & g2)
        union = len(g1 | g2) or 1
        if inter / union >= threshold:
            return True
    _recent_text[user_id].append(norm)
    return False
