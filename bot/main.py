"""月影车姬入口：polling 启动 + 定时任务。"""

from __future__ import annotations

import asyncio
import logging
import sys

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.fsm.storage.memory import MemoryStorage
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from bot.config import get_settings
from bot.db import close_db, connect_db
from bot.handlers import register_handlers
from bot.middlewares import ErrorLogMiddleware
from bot.services import credit_service, session_service

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("yueying")


async def on_startup(bot: Bot) -> None:
    await connect_db()
    me = await bot.get_me()
    logger.info("Bot @%s started", me.username)


async def on_shutdown(bot: Bot) -> None:
    await close_db()
    logger.info("Bot stopped")


async def job_expire_sessions() -> None:
    try:
        n = await session_service.expire_old_sessions()
        if n:
            logger.info("Expired %s sessions", n)
    except Exception:
        logger.exception("expire sessions failed")


async def job_daily_credit() -> None:
    try:
        n = await credit_service.tick_shadow_daily()
        logger.info("Daily credit tick updated %s users", n)
    except Exception:
        logger.exception("daily credit failed")


async def main() -> None:
    settings = get_settings()
    if not settings.bot_token:
        raise RuntimeError("请设置环境变量 BOT_TOKEN")

    logging.getLogger().setLevel(settings.log_level.upper())

    bot = Bot(
        token=settings.bot_token,
        default=DefaultBotProperties(parse_mode=ParseMode.MARKDOWN),
    )
    dp = Dispatcher(storage=MemoryStorage())
    dp.update.middleware(ErrorLogMiddleware())
    register_handlers(dp)

    dp.startup.register(on_startup)
    dp.shutdown.register(on_shutdown)

    scheduler = AsyncIOScheduler()
    scheduler.add_job(job_expire_sessions, "interval", minutes=5, id="expire_sessions")
    scheduler.add_job(job_daily_credit, "cron", hour=0, minute=5, id="daily_credit")
    scheduler.start()

    logger.info("Starting polling...")
    try:
        await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())
    finally:
        scheduler.shutdown(wait=False)
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
