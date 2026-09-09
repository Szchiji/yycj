"""应用配置：从环境变量加载。"""

from __future__ import annotations

from functools import lru_cache
from typing import List, Optional

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    bot_token: str = ""
    admin_ids: str = ""

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/yueying"

    # Redis（可选；未设置时防刷回退内存并打警告日志）
    redis_url: str = ""

    # 会话消息保留小时数（结束后再过这么久才清理正文/行）
    message_retention_hours: int = 24

    webhook_host: str = ""
    webhook_path: str = "/webhook"
    webhook_secret: str = ""

    webapp_url: str = ""

    env: str = "development"
    log_level: str = "INFO"
    port: int = 8080

    @field_validator(
        "bot_token",
        "webhook_secret",
        "webhook_host",
        "database_url",
        "redis_url",
        mode="before",
    )
    @classmethod
    def strip_str(cls, v):
        if v is None:
            return ""
        return str(v).strip()

    @field_validator("message_retention_hours", mode="before")
    @classmethod
    def coerce_retention(cls, v):
        if v is None or v == "":
            return 24
        try:
            n = int(v)
        except (TypeError, ValueError):
            return 24
        return max(1, n)

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
        """Railway 常见 postgres:// → postgresql+asyncpg://。"""
        url = self.database_url.strip()
        if url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://") :]
        if url.startswith("postgresql://") and "+asyncpg" not in url:
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    def normalized_redis_url(self) -> Optional[str]:
        url = (self.redis_url or "").strip()
        return url or None


@lru_cache
def get_settings() -> Settings:
    return Settings()
