"""月影车姬入口：Webhook（FastAPI）+ Mini App API/静态 + 可选本地 polling。"""

from __future__ import annotations

if __name__ == "__main__":
    # Railway starts us with `python -m bot.main`, which runs this file as module `__main__`. Every service
    # does `from bot.main import bot`, which would import a SECOND copy of this file: a second Bot whose
    # aiohttp session is never closed at shutdown ("Unclosed client session"). So hand over to the one real
    # module `bot.main` right away; nothing below runs in `__main__`.
    import importlib as _importlib

    _importlib.import_module("bot.main").main()
    raise SystemExit(0)

import asyncio
import hmac
import logging
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import BotCommand, MenuButtonWebApp, Update, WebAppInfo
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware

from bot.log_redact import install as _install_log_redact

_install_log_redact()

from bot.api import api_router
from bot.config import get_settings
from bot.db import close_db, connect_db
from bot.handlers import register_handlers
from bot.middlewares import ErrorLogMiddleware
from bot.services import anti_brush, credit_service, session_service

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

MINIAPP_DIR = Path(__file__).resolve().parent.parent / "miniapp"


# Mini App caching / gzip policy lives in bot/api/static_cache.py (versioned assets are immutable,
# HTML is never cached). Kept under the old name for anything importing it.
from bot.api.static_cache import MiniappCache as NoCacheMiniapp, SelectiveGZip  # noqa: E402


def _menu_webapp_url(webapp: str) -> str:
    base = (webapp or "").rstrip("/")
    return f"{base}/go.html" if base else ""


async def job_expire_sessions() -> None:
    try:
        n = await session_service.expire_old_sessions()
        if n:
            logger.info("Expired %s sessions", n)
    except Exception:
        logger.exception("expire sessions failed")


async def job_purge_session_messages() -> None:
    try:
        n = await session_service.purge_expired_messages()
        if n:
            logger.info("Purged %s session messages", n)
    except Exception:
        logger.exception("purge session messages failed")


async def job_daily_credit() -> None:
    try:
        n = await credit_service.tick_shadow_daily()
        logger.info("Daily credit tick updated %s users", n)
    except Exception:
        logger.exception("daily credit failed")


async def job_expire_listings() -> None:
    try:
        from bot.services import listing_ops
        n = await listing_ops.expire_due_lamps()
        if n:
            logger.info("Expired %s listings", n)
    except Exception:
        logger.exception("expire listings failed")


def _schedule_jobs() -> None:
    if scheduler.running:
        return
    scheduler.add_job(job_expire_sessions, "interval", minutes=5, id="expire_sessions", replace_existing=True)
    scheduler.add_job(job_purge_session_messages, "interval", minutes=30, id="purge_session_messages", replace_existing=True)
    scheduler.add_job(job_daily_credit, "cron", hour=0, minute=5, id="daily_credit", replace_existing=True)
    scheduler.add_job(job_expire_listings, "interval", minutes=30, id="expire_listings", replace_existing=True)
    scheduler.start()


# Telegram flood control at startup (several deploys / restarts in a row all call setWebhook etc.):
# wait the server's retry_after (+ a small buffer) and try again, a few times, with a cap on the total wait.
TG_RETRY_ATTEMPTS = 3
TG_RETRY_BUFFER = 1.5      # seconds on top of retry_after
TG_RETRY_MAX_WAIT = 90.0   # total seconds one call may spend waiting


async def _tg_call(label: str, make_call, *, attempts: int = TG_RETRY_ATTEMPTS, max_wait: float = TG_RETRY_MAX_WAIT,
                   sleep=asyncio.sleep):
    """Run ``await make_call()``; on TelegramRetryAfter wait and retry. Other errors propagate.
    Never logs the request itself (the URL carries the bot token)."""
    from aiogram.exceptions import TelegramRetryAfter
    waited = 0.0
    for n in range(1, attempts + 1):
        try:
            return await make_call()
        except TelegramRetryAfter as exc:
            delay = float(getattr(exc, "retry_after", 1) or 1) + TG_RETRY_BUFFER
            if n >= attempts or waited + delay > max_wait:
                logger.warning("%s: Telegram flood control, giving up after %s attempt(s) (retry_after=%ss, waited %.0fs)",
                               label, n, getattr(exc, "retry_after", "?"), waited)
                raise
            logger.info("%s: Telegram flood control, retry %s/%s in %.1fs", label, n + 1, attempts, delay)
            waited += delay
            await sleep(delay)


async def _setup_webhook() -> bool:
    """setWebhook (+ getMe for the log line). Flood errors are retried; if it still fails we keep serving:
    the webhook is almost always already set to this same URL by the previous / sibling deploy."""
    try:
        await _tg_call("set_webhook", lambda: bot.set_webhook(
            url=settings.webhook_url,
            secret_token=settings.webhook_secret or None,
            drop_pending_updates=False,
            allowed_updates=dp.resolve_used_update_types(),
        ))
    except Exception as exc:
        logger.error("Webhook setup failed (%s: %s); keeping the server up - the webhook set by the previous deploy "
                     "still points at %s", type(exc).__name__, str(exc)[:200], settings.webhook_url)
        return False
    try:
        me = await _tg_call("get_me", bot.get_me)
        logger.info("Webhook set -> %s | Bot @%s", settings.webhook_url, me.username)
    except Exception as exc:
        logger.info("Webhook set -> %s (getMe skipped: %s)", settings.webhook_url, type(exc).__name__)
    return True


async def _startup() -> None:
    global _ready, _startup_error
    try:
        if not settings.bot_token:
            raise RuntimeError("请设置环境变量 BOT_TOKEN")
        logging.getLogger().setLevel(settings.log_level.upper())
        _install_log_redact()
        for _quiet in ("httpx", "httpcore"):
            logging.getLogger(_quiet).setLevel(logging.WARNING)
        await connect_db()
        logger.info("Database connected")
        try:
            from bot.services import home_service
            from bot.services.demo_purge import purge_demo_listings
            home_service.seed_demo_if_empty = purge_demo_listings
            purged = await purge_demo_listings()
            if purged.get("purged"):
                logger.info("Demo purged: %s", purged.get("lamp_ids"))
        except Exception:
            logger.exception("demo purge skipped")
        await anti_brush.allow("__warmup__", limit=1, window_sec=1)
        _schedule_jobs()
        try:
            from bot.services import bot_info
            await bot_info.refresh_bot_identity(bot)
        except Exception:
            logger.exception("bot identity refresh skipped")
        try:
            from bot.services import bot_info
            await bot_info.startup_maintenance(scheduler)
        except Exception:
            logger.exception("startup maintenance skipped")
        if settings.use_webhook:
            if not settings.webhook_secret:
                logger.warning("WEBHOOK_SECRET is not set: webhook requests are not authenticated")
            await _setup_webhook()
        else:
            logger.warning("WEBHOOK_HOST 未配置：仅 HTTP 健康检查；本地请走 polling")
        webapp = settings.normalized_webapp_url
        if webapp:
            menu_url = _menu_webapp_url(webapp)
            logger.info("WEBAPP_URL=%s (menu=%s)", settings.webapp_url, menu_url)
            try:
                await _tg_call("set_chat_menu_button", lambda: bot.set_chat_menu_button(
                    menu_button=MenuButtonWebApp(text="首页", web_app=WebAppInfo(url=menu_url))
                ))
                logger.info("Chat menu button set -> %s", menu_url)
            except Exception:
                logger.exception("set_chat_menu_button failed")
        try:
            await _tg_call("set_my_commands", lambda: bot.set_my_commands(
                [
                    BotCommand(command="start", description="打开欢迎"),
                    BotCommand(command="help", description="使用说明"),
                    BotCommand(command="admin", description="管理后台（管理员）"),
                ]
            ))
            logger.info("Bot commands set: /start /help /admin")
        except Exception:
            logger.exception("set_my_commands failed")
        if MINIAPP_DIR.is_dir():
            logger.info("Mini App static: %s -> /app", MINIAPP_DIR)
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
    await _shutdown()


async def _close_http_clients() -> None:
    """Close every outbound HTTP session: the aiogram Bot's aiohttp session plus the pooled httpx client
    used for media. Each step is independent."""
    try:
        await bot.session.close()   # the only Bot instance in the app (bot.main.bot)
    except Exception:
        logger.exception("bot session close failed")
    try:
        from bot.api import routes_media
        client = getattr(routes_media, "_HTTP", None)
        if client is not None and not client.is_closed:
            await client.aclose()
    except Exception:
        logger.exception("media http client close failed")


async def _shutdown() -> None:
    """Every step guarded, sessions closed last: one failing step must not leave the aiohttp session open
    ('Unclosed client session' at exit)."""
    try:
        if scheduler.running:
            scheduler.shutdown(wait=False)
    except Exception:
        logger.exception("scheduler shutdown failed")
    for name, fn in (("redis", anti_brush.close_redis), ("db", close_db)):
        try:
            await fn()
        except Exception:
            logger.exception("%s close failed", name)
    await _close_http_clients()
    logger.info("Bot stopped")


app = FastAPI(title="月影车姬", lifespan=lifespan)
app.add_middleware(NoCacheMiniapp)
from bot.api.upload_guard import UploadSizeGuard  # noqa: E402
app.add_middleware(UploadSizeGuard)
app.add_middleware(SelectiveGZip, minimum_size=1024)
app.include_router(api_router)


@app.get("/")
async def root() -> dict:
    return {
        "ok": True,
        "service": "yueying-cheji",
        "ready": _ready,
        "mode": "webhook" if settings.use_webhook else "idle",
        "miniapp": "/app" if MINIAPP_DIR.is_dir() else None,
        "error": _startup_error,
    }


@app.get("/health")
async def healthz() -> PlainTextResponse:
    return PlainTextResponse("ok")


@app.get("/app")
async def miniapp_index():
    index = MINIAPP_DIR / "go.html"
    if not index.is_file():
        index = MINIAPP_DIR / "index.html"
    if not index.is_file():
        raise HTTPException(status_code=404, detail="miniapp missing")
    return FileResponse(index, headers={
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Pragma": "no-cache",
    })


def _admin_page() -> Path:
    desk = MINIAPP_DIR / "desk.html"
    if desk.is_file():
        return desk
    console = MINIAPP_DIR / "console.html"
    if console.is_file():
        return console
    return MINIAPP_DIR / "admin.html"


def _admin_file():
    page = _admin_page()
    if not page.is_file():
        raise HTTPException(status_code=404, detail="admin missing")
    return FileResponse(page, headers={
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Pragma": "no-cache",
    })


@app.get("/app/admin.html")
async def miniapp_admin():
    return _admin_file()


@app.get("/app/console.html")
async def miniapp_console():
    return _admin_file()


@app.get("/app/desk.html")
async def miniapp_desk():
    return _admin_file()


@app.post(settings.webhook_path or "/webhook")
async def telegram_webhook(
    request: Request,
    x_telegram_bot_api_secret_token: str | None = Header(default=None),
):
    if not _ready:
        raise HTTPException(status_code=503, detail=_startup_error or "starting")
    if settings.webhook_secret and not hmac.compare_digest(
        (x_telegram_bot_api_secret_token or "").encode("utf-8"), settings.webhook_secret.encode("utf-8")
    ):
        raise HTTPException(status_code=403, detail="invalid secret")
    data = await request.json()
    update = Update.model_validate(data, context={"bot": bot})
    await dp.feed_update(bot, update)
    return JSONResponse({"ok": True})


if MINIAPP_DIR.is_dir():
    app.mount("/app", StaticFiles(directory=str(MINIAPP_DIR), html=True), name="miniapp")


async def run_polling() -> None:
    if not settings.bot_token:
        raise RuntimeError("请设置环境变量 BOT_TOKEN")
    logging.getLogger().setLevel(settings.log_level.upper())
    await connect_db()
    await anti_brush.allow("__warmup__", limit=1, window_sec=1)
    await bot.delete_webhook(drop_pending_updates=True)
    _schedule_jobs()
    try:
        from bot.services import bot_info
        await bot_info.startup_maintenance(scheduler)
    except Exception:
        logger.exception("startup maintenance skipped")
    me = await bot.get_me()
    logger.info("Polling mode | Bot @%s", me.username)
    webapp = settings.normalized_webapp_url
    if webapp:
        try:
            await bot.set_chat_menu_button(
                menu_button=MenuButtonWebApp(text="首页", web_app=WebAppInfo(url=_menu_webapp_url(webapp)))
            )
        except Exception:
            logger.exception("set_chat_menu_button failed")
    try:
        await bot.set_my_commands(
            [
                BotCommand(command="start", description="打开欢迎"),
                BotCommand(command="help", description="使用说明"),
                BotCommand(command="admin", description="管理后台（管理员）"),
            ]
        )
    except Exception:
        logger.exception("set_my_commands failed")
    try:
        await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())
    finally:
        await _shutdown()


def main() -> None:
    import uvicorn
    port = int(os.environ.get("PORT") or settings.port or 8080)
    if settings.use_webhook or os.environ.get("PORT"):
        if not settings.use_webhook:
            logger.warning("PORT 已注入但 WEBHOOK_HOST 为空，仍启动 HTTP 服务")
        uvicorn.run(app, host="0.0.0.0", port=port, log_level=settings.log_level.lower())
    else:
        asyncio.run(run_polling())


