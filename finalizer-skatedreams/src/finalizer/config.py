"""Application settings loaded from env vars."""

import base64
import json
from functools import cached_property

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    google_service_account_json: str
    google_calendar_id: str = "escolaskatedreams@gmail.com"

    sheets_controle_id: str

    apps_script_webhook_url: str
    apps_script_webhook_token: str

    finalizer_api_token: str
    finalizer_cron_hour: int = 3
    finalizer_cron_minute: int = 0
    finalizer_timezone: str = "America/Sao_Paulo"

    dry_run: bool = False
    grupo_a_max_per_cycle: int = 50

    log_level: str = "INFO"

    @cached_property
    def service_account_dict(self) -> dict:
        return json.loads(base64.b64decode(self.google_service_account_json))


def get_settings() -> Settings:
    return Settings()
