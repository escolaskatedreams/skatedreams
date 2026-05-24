import base64
import json

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def env(monkeypatch):
    fake = base64.b64encode(json.dumps({
        "type": "service_account", "client_email": "x@x.iam",
        "token_uri": "https://oauth2.googleapis.com/token",
        "private_key": "-----BEGIN PRIVATE KEY-----\nFAKE\n-----END PRIVATE KEY-----\n",
        "project_id": "x",
    }).encode()).decode()
    monkeypatch.setenv("GOOGLE_SERVICE_ACCOUNT_JSON", fake)
    monkeypatch.setenv("SHEETS_CONTROLE_ID", "1abc")
    monkeypatch.setenv("APPS_SCRIPT_WEBHOOK_URL", "https://x")
    monkeypatch.setenv("APPS_SCRIPT_WEBHOOK_TOKEN", "tk")
    monkeypatch.setenv("FINALIZER_API_TOKEN", "apitok")
    monkeypatch.setenv("FINALIZER_CRON_HOUR", "3")


def test_app_starts_and_health_ok(env, monkeypatch):
    from finalizer import main
    monkeypatch.setattr(main, "build_credentials", lambda b64, scopes: object())
    monkeypatch.setattr(main, "build", lambda service, version, credentials, cache_discovery=False: object())
    app = main.create_app()
    client = TestClient(app)
    r = client.get("/health")
    assert r.status_code == 200
