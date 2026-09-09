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

    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_db: str = "yueying"

    redis_url: str = ""

    ai_api_key: str = ""
    ai_api_base: str = "https://api.openai.com/v1"
    ai_model: str = "gpt-4o-mini"

    webapp_url: str = ""
    webhook_url: str = ""
    webhook_secret: str = ""

    env: str = "development"
    log_level: str = "INFO"

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


@lru_cache
def get_settings() -> Settings:
    return Settings()
