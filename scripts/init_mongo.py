"""初始化 MongoDB 索引（可选，bot 启动时也会自动建索引）。"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from bot.db import close_db, connect_db


async def main() -> None:
    db = await connect_db()
    print(f"Connected to database: {db.name}")
    collections = await db.list_collection_names()
    print("Collections:", collections or "(empty, will create on first write)")
    await close_db()
    print("OK")


if __name__ == "__main__":
    asyncio.run(main())
