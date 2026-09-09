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

logger = logging.getLogger(__name__)

_engine: Optional[AsyncEngine] = None
_session_factory: Optional[async_sessionmaker[AsyncSession]] = None

# create_all 不会给已有表加列；启动时幂等补齐（PostgreSQL）。
_ALTER_STATEMENTS = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(16)",
    "ALTER TABLE lamps ADD COLUMN IF NOT EXISTS district VARCHAR(64)",
    "ALTER TABLE lamps ADD COLUMN IF NOT EXISTS approx_lat DOUBLE PRECISION",
    "ALTER TABLE lamps ADD COLUMN IF NOT EXISTS approx_lng DOUBLE PRECISION",
    "ALTER TABLE lamps ADD COLUMN IF NOT EXISTS approx_label VARCHAR(128)",
    "ALTER TABLE lamps ADD COLUMN IF NOT EXISTS media JSONB DEFAULT '[]'::jsonb",
    "ALTER TABLE lamps ADD COLUMN IF NOT EXISTS publisher_role VARCHAR(16)",
    # sessions: columns added after table already existed in production
    "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS messages_purge_at TIMESTAMP",
    "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS quality_score INTEGER DEFAULT 50",
]


async def _ensure_columns(conn) -> None:
    for stmt in _ALTER_STATEMENTS:
        try:
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
        # Creates missing tables (Review/HomepagePin/SiteSettings/session_messages, etc.)
        await conn.run_sync(Base.metadata.create_all)
        await _ensure_columns(conn)


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
