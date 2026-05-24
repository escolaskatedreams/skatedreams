"""FastAPI app + APScheduler boot."""

import logging
import sys
from contextlib import asynccontextmanager
from datetime import date

import structlog
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import FastAPI
from googleapiclient.discovery import build

from finalizer.config import Settings, get_settings
from finalizer.google.auth import CALENDAR_SCOPE, SHEETS_SCOPE, build_credentials
from finalizer.google.calendar import CalendarClient
from finalizer.google.sheets import SheetsClient
from finalizer.http.routes import build_router
from finalizer.operations.substituir_recorrencia import substituir_recorrencia
from finalizer.pipeline import Pipeline
from finalizer.sync import dispara_sync


def _configure_logging(level: str) -> None:
    logging.basicConfig(format="%(message)s", stream=sys.stdout, level=level)
    structlog.configure(
        processors=[
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
    )


def create_app(settings: Settings | None = None) -> FastAPI:
    s = settings or get_settings()
    _configure_logging(s.log_level)

    creds = build_credentials(s.google_service_account_json, [CALENDAR_SCOPE, SHEETS_SCOPE])
    cal_api = build("calendar", "v3", credentials=creds, cache_discovery=False)
    sheets_api = build("sheets", "v4", credentials=creds, cache_discovery=False)
    calendar_client = CalendarClient(cal_api, s.google_calendar_id)
    sheets_client = SheetsClient(sheets_api, s.sheets_controle_id)

    async def sync_partial():
        await dispara_sync(s.apps_script_webhook_url, s.apps_script_webhook_token)

    pipeline = Pipeline(
        calendar=calendar_client,
        sheets=sheets_client,
        substituir_recorrencia=substituir_recorrencia,
        dispara_sync=sync_partial,
        max_grupo_a=s.grupo_a_max_per_cycle,
        dry_run=s.dry_run,
        today=date.today(),
    )

    scheduler = AsyncIOScheduler(timezone=s.finalizer_timezone)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        scheduler.add_job(
            pipeline.run_ciclo,
            CronTrigger(hour=s.finalizer_cron_hour, minute=s.finalizer_cron_minute, timezone=s.finalizer_timezone),
            misfire_grace_time=3600,
            id="ciclo_diario",
            coalesce=True,
            max_instances=1,
        )
        scheduler.start()
        yield
        scheduler.shutdown()

    app = FastAPI(title="finalizer-skatedreams", version="0.1.0", lifespan=lifespan)
    app.include_router(build_router(pipeline, api_token=s.finalizer_api_token))
    app.state.pipeline = pipeline
    app.state.scheduler = scheduler
    return app


def main():
    app = create_app()
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)


if __name__ == "__main__":
    main()
