"""PostgreSQL 异步连接（SQLAlchemy 2 + asyncpg）。"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from bot.config import get_settings
from bot.models import Base

_engine: Optional[AsyncEngine] = None
_session_factory: Optional[async_sessionmaker[AsyncSession]] = None


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
