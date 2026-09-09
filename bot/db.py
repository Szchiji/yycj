"""MongoDB 异步连接（motor）。"""

from __future__ import annotations

from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from bot.config import get_settings

_client: Optional[AsyncIOMotorClient] = None
_db: Optional[AsyncIOMotorDatabase] = None


async def connect_db() -> AsyncIOMotorDatabase:
    global _client, _db
    if _db is not None:
        return _db
    settings = get_settings()
    _client = AsyncIOMotorClient(settings.mongodb_url)
    _db = _client[settings.mongodb_db]
    await _ensure_indexes(_db)
    return _db


async def close_db() -> None:
    global _client, _db
    if _client is not None:
        _client.close()
    _client = None
    _db = None


def get_db() -> AsyncIOMotorDatabase:
    if _db is None:
        raise RuntimeError("数据库尚未连接，请先调用 connect_db()")
    return _db


async def _ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    await db.users.create_index("user_id", unique=True)
    await db.lamps.create_index([("city", 1), ("status", 1), ("updated_at", -1)])
    await db.lamps.create_index("lamp_id", unique=True)
    await db.sessions.create_index("session_id", unique=True)
    await db.sessions.create_index([("status", 1), ("expire_at", 1)])
    await db.sessions.create_index("user_a_id")
    await db.sessions.create_index("user_b_id")
    await db.posts.create_index([("user_id", 1), ("created_at", -1)])
    await db.reports.create_index([("lamp_id", 1), ("reporter_id", 1)])
    await db.credit_history.create_index([("user_id", 1), ("time", -1)])
