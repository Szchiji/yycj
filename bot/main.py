"""月影车姬入口：Webhook（FastAPI）+ 可选本地 polling。"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
from contextlib import asynccontextmanager

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import Update
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse, PlainTextResponse

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

settings = get_settings()
bot = Bot(
    token=settings.bot_token or "0:init",
    default=DefaultBotProperties(parse_mode=ParseMode.HTML),
)
dp = Dispatcher(storage=MemoryStorage())
dp.update.middleware(ErrorLogMiddleware())
register_handlers(dp)
scheduler = AsyncIOScheduler()

_ready = False
_startup_error: str | None = None


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


async def _startup() -> None:
    global _ready, _startup_error
    try:
        if not settings.bot_token:
            raise RuntimeError("请设置环境变量 BOT_TOKEN")
        logging.getLogger().setLevel(settings.log_level.upper())

        await connect_db()
        logger.info("Database connected")

        if not scheduler.running:
            scheduler.add_job(
                job_expire_sessions,
                "interval",
                minutes=5,
                id="expire_sessions",
                replace_existing=True,
            )
            scheduler.add_job(
                job_daily_credit,
                "cron",
                hour=0,
                minute=5,
                id="daily_credit",
                replace_existing=True,
            )
            scheduler.start()

        if settings.use_webhook:
            await bot.set_webhook(
                url=settings.webhook_url,
                secret_token=settings.webhook_secret or None,
                drop_pending_updates=True,
                allowed_updates=dp.resolve_used_update_types(),
            )
            me = await bot.get_me()
            logger.info("Webhook set -> %s | Bot @%s", settings.webhook_url, me.username)
        else:
            logger.warning("WEBHOOK_HOST 未配置：仅 HTTP 健康检查；本地请走 polling")

        _ready = True
        _startup_error = None
    except Exception as exc:
        _startup_error = str(exc)
        logger.exception("Startup failed: %s", exc)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    task = asyncio.create_task(_startup())
    yield
    if not task.done():
        task.cancel()
        try:
            await task
        except (asyncio.CancelledError, Exception):
            pass
    if scheduler.running:
        scheduler.shutdown(wait=False)
    if settings.use_webhook:
        try:
            await bot.delete_webhook(drop_pending_updates=False)
        except Exception:
            pass
    await close_db()
    await bot.session.close()
    logger.info("Bot stopped")


app = FastAPI(title="月影车姬", lifespan=lifespan)


@app.get("/")
async def root() -> dict:
    return {
        "ok": True,
        "service": "yueying-cheji",
        "ready": _ready,
        "mode": "webhook" if settings.use_webhook else "idle",
        "error": _startup_error,
    }


@app.get("/health")
async def healthz() -> PlainTextResponse:
    return PlainTextResponse("ok")


@app.post(settings.webhook_path or "/webhook")
async def telegram_webhook(
    request: Request,
    x_telegram_bot_api_secret_token: str | None = Header(default=None),
):
    if not _ready:
        raise HTTPException(status_code=503, detail=_startup_error or "starting")
    if settings.webhook_secret and x_telegram_bot_api_secret_token != settings.webhook_secret:
        raise HTTPException(status_code=403, detail="invalid secret")
    data = await request.json()
    update = Update.model_validate(data, context={"bot": bot})
    await dp.feed_update(bot, update)
    return JSONResponse({"ok": True})


async def run_polling() -> None:
    if not settings.bot_token:
        raise RuntimeError("请设置环境变量 BOT_TOKEN")
    logging.getLogger().setLevel(settings.log_level.upper())
    await connect_db()
    await bot.delete_webhook(drop_pending_updates=True)
    if not scheduler.running:
        scheduler.add_job(
            job_expire_sessions,
            "interval",
            minutes=5,
            id="expire_sessions",
            replace_existing=True,
        )
        scheduler.add_job(
            job_daily_credit,
            "cron",
            hour=0,
            minute=5,
            id="daily_credit",
            replace_existing=True,
        )
        scheduler.start()
    me = await bot.get_me()
    logger.info("Polling mode | Bot @%s", me.username)
    try:
        await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())
    finally:
        if scheduler.running:
            scheduler.shutdown(wait=False)
        await close_db()
        await bot.session.close()


def main() -> None:
    import uvicorn

    port = int(os.environ.get("PORT") or settings.port or 8080)

    if settings.use_webhook or os.environ.get("PORT"):
        if not settings.use_webhook:
            logger.warning("PORT 已注入但 WEBHOOK_HOST 为空，仍启动 HTTP 服务")
        uvicorn.run(
            app,
            host="0.0.0.0",
            port=port,
            log_level=settings.log_level.lower(),
        )
    else:
        asyncio.run(run_polling())


if __name__ == "__main__":
    main()
