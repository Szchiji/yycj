"""应用配置：从环境变量加载。"""

from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    bot_token: str = ""
    admin_ids: str = ""

    # Postgres：推荐 postgresql+asyncpg://...
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/yueying"

    webhook_host: str = ""  # https://xxx.up.railway.app
    webhook_path: str = "/webhook"
    webhook_secret: str = ""

    webapp_url: str = ""

    env: str = "development"
    log_level: str = "INFO"
    port: int = 8080

    @property
    def admin_id_list(self) -> List[int]:
        if not self.admin_ids.strip():
            return []
        result: List[int] = []
        for part in self.admin_ids.split(","):
            part = part.strip()
            if part.isdigit():
                result.append(int(part))
        return result

    def is_admin(self, user_id: int) -> bool:
        return user_id in self.admin_id_list

    @property
    def webhook_url(self) -> str:
        host = self.webhook_host.rstrip("/")
        path = self.webhook_path if self.webhook_path.startswith("/") else f"/{self.webhook_path}"
        return f"{host}{path}" if host else ""

    @property
    def use_webhook(self) -> bool:
        return bool(self.webhook_host and self.bot_token)

    def normalized_database_url(self) -> str:
        """把 Railway 常见 postgres:// 转成 asyncpg 驱动。"""
        url = self.database_url.strip()
        if url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://") :]
        if url.startswith("postgresql://") and "+asyncpg" not in url:
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url


@lru_cache
def get_settings() -> Settings:
    return Settings()
