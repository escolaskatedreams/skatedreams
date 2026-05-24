from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from finalizer.http.routes import build_router
from finalizer.pipeline import CicloReport


def _app(pipeline, token="t0k"):
    app = FastAPI()
    app.include_router(build_router(pipeline, api_token=token))
    return app


def test_health_no_auth():
    app = _app(MagicMock())
    r = TestClient(app).get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_status_requires_token():
    pipe = MagicMock()
    pipe.last_report = None
    pipe.last_run_at = None
    client = TestClient(_app(pipe))
    r = client.get("/status")
    assert r.status_code == 401


def test_status_returns_last_report():
    pipe = MagicMock()
    pipe.last_report = CicloReport(inicio=datetime(2026, 5, 24, 3, 0))
    pipe.last_run_at = datetime(2026, 5, 24, 3, 5)
    client = TestClient(_app(pipe))
    r = client.get("/status", headers={"X-Finalizer-Token": "t0k"})
    assert r.status_code == 200
    body = r.json()
    assert body["last_run_at"] is not None
    assert body["report"]["inicio"]


def test_run_triggers_pipeline():
    pipe = MagicMock()
    pipe.run_ciclo = AsyncMock(return_value=CicloReport(inicio=datetime.now()))
    pipe.last_report = None
    client = TestClient(_app(pipe))
    r = client.post("/run", headers={"X-Finalizer-Token": "t0k"})
    assert r.status_code == 200
    pipe.run_ciclo.assert_awaited_once()
