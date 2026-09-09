import os
import logging
from telegram.ext import Application
from handlers import register as register_handlers

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

TOKEN = os.getenv("TELEGRAM_TOKEN") or os.getenv("TELEGRAM_BOT_TOKEN")
if not TOKEN:
    raise RuntimeError("请设置环境变量 TELEGRAM_TOKEN（或 TELEGRAM_BOT_TOKEN）")


def main():
    application = Application.builder().token(TOKEN).build()
    register_handlers(application)
    logger.info("Bot started (polling)...")
    application.run_polling(allowed_updates=["message", "callback_query", "chat_member"])


if __name__ == "__main__":
    main()
