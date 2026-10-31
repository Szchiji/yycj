"""PostgreSQL 异步连接（SQLAlchemy 2 + asyncpg）。"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from bot.config import get_settings
from bot.models import Base
import bot.models_extra  # noqa: F401

logger = logging.getLogger(__name__)

_engine: Optional[AsyncEngine] = None
_session_factory: Optional[async_sessionmaker[AsyncSession]] = None

_ALTER_STATEMENTS = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(16)",
    "ALTER TABLE lamps ADD COLUMN IF NOT EXISTS district VARCHAR(64)",
    "ALTER TABLE lamps ADD COLUMN IF NOT EXISTS approx_lat DOUBLE PRECISION",
    "ALTER TABLE lamps ADD COLUMN IF NOT EXISTS approx_lng DOUBLE PRECISION",
    "ALTER TABLE lamps ADD COLUMN IF NOT EXISTS approx_label VARCHAR(128)",
    "ALTER TABLE lamps ADD COLUMN IF NOT EXISTS media JSONB DEFAULT '[]'::jsonb",
    "ALTER TABLE lamps ADD COLUMN IF NOT EXISTS publisher_role VARCHAR(16)",
    "ALTER TABLE lamps ADD COLUMN IF NOT EXISTS feed_pinned BOOLEAN DEFAULT FALSE",
    "ALTER TABLE lamps ADD COLUMN IF NOT EXISTS feed_pin_order INTEGER DEFAULT 0",
    "ALTER TABLE lamps ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP",
    "ALTER TABLE lamps ADD COLUMN IF NOT EXISTS unlist_reason VARCHAR(64)",
    "ALTER TABLE lamps ADD COLUMN IF NOT EXISTS feed_pin_expires_at TIMESTAMP",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason VARCHAR(256)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS guest_alias VARCHAR(32)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS role_locked_until TIMESTAMP",
    "ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS ops_config JSONB DEFAULT '{}'::jsonb",
    "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS messages_purge_at TIMESTAMP",
    "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS quality_score INTEGER DEFAULT 50",
    "ALTER TABLE lamps ADD COLUMN IF NOT EXISTS extras JSONB DEFAULT '{}'::jsonb",
    "ALTER TABLE lamps ADD COLUMN IF NOT EXISTS bc_chat VARCHAR(64)",
    "ALTER TABLE lamps ADD COLUMN IF NOT EXISTS bc_mid VARCHAR(32)",
    # Home feed: WHERE status='active' AND city=? ORDER BY feed_pinned DESC, feed_pin_order, created_at DESC.
    # Additive, IF NOT EXISTS; the lamps table is small so the build lock is brief.
    "CREATE INDEX IF NOT EXISTS ix_lamps_feed ON lamps (status, city, feed_pinned DESC, feed_pin_order, created_at DESC)",
    # 首页筛选: 价格档 (status, city, price) and 标签 (array overlap, GIN)
    "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS sections JSONB DEFAULT '{}'::jsonb",
    "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS proofs JSONB DEFAULT '[]'::jsonb",
    "CREATE INDEX IF NOT EXISTS ix_lamps_price ON lamps (status, city, price)",
    "CREATE INDEX IF NOT EXISTS ix_lamps_tags_gin ON lamps USING gin (tags)",
    # 搜索: substring ILIKE on name / district / location text. pg_trgm may be unavailable
    # (no permission): then these fail, get logged once, and search still works by scan.
    "CREATE EXTENSION IF NOT EXISTS pg_trgm",
    "CREATE INDEX IF NOT EXISTS ix_lamps_title_trgm ON lamps USING gin (title gin_trgm_ops)",
    "CREATE INDEX IF NOT EXISTS ix_lamps_district_trgm ON lamps USING gin (district gin_trgm_ops)",
    "CREATE INDEX IF NOT EXISTS ix_lamps_approx_trgm ON lamps USING gin (approx_label gin_trgm_ops)",
    "ALTER TABLE coupons ADD COLUMN IF NOT EXISTS post_chat VARCHAR(64)",
    "ALTER TABLE coupons ADD COLUMN IF NOT EXISTS post_mid INTEGER",
    "ALTER TABLE coupons ADD COLUMN IF NOT EXISTS post_closed BOOLEAN DEFAULT false",
]


async def _ensure_columns(engine) -> None:
    # One transaction per statement: in Postgres a failed statement aborts the whole
    # transaction, which used to make every later ALTER fail too.
    for stmt in _ALTER_STATEMENTS:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(stmt))
        except Exception:
            logger.exception("ensure column failed: %s", stmt)


async def connect_db() -> None:
    global _engine, _session_factory
    if _engine is not None:
        return
    settings = get_settings()
    url = settings.normalized_database_url()
    _engine = create_async_engine(
        url,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
        pool_recycle=300,
        connect_args={"timeout": 15},
    )
    _session_factory = async_sessionmaker(_engine, expire_on_commit=False, class_=AsyncSession)
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _ensure_columns(_engine)


async def close_db() -> None:
    global _engine, _session_factory
    if _engine is not None:
        await _engine.dispose()
    _engine = None
    _session_factory = None


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    if _session_factory is None:
        raise RuntimeError("数据库尚未连接，请先调用 connect_db()")
    return _session_factory


@asynccontextmanager
async def session_scope() -> AsyncGenerator[AsyncSession, None]:
    factory = get_session_factory()
    session = factory()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()
