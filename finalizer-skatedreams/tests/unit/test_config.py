import base64
import json

import pytest

from finalizer.config import Settings


@pytest.fixture
def env(monkeypatch):
    fake_sa = base64.b64encode(json.dumps({"type": "service_account", "client_email": "x@x.iam"}).encode()).decode()
    monkeypatch.setenv("GOOGLE_SERVICE_ACCOUNT_JSON", fake_sa)
    monkeypatch.setenv("SHEETS_CONTROLE_ID", "1abc")
    monkeypatch.setenv("APPS_SCRIPT_WEBHOOK_URL", "https://script.google.com/macros/s/x/exec")
    monkeypatch.setenv("APPS_SCRIPT_WEBHOOK_TOKEN", "tok")
    monkeypatch.setenv("FINALIZER_API_TOKEN", "apitok")


def test_settings_defaults(env):
    s = Settings()
    assert s.google_calendar_id == "escolaskatedreams@gmail.com"
    assert s.finalizer_cron_hour == 3
    assert s.finalizer_cron_minute == 0
    assert s.finalizer_timezone == "America/Sao_Paulo"
    assert s.dry_run is False
    assert s.grupo_a_max_per_cycle == 50
    assert s.log_level == "INFO"


def test_settings_decoded_sa(env):
    s = Settings()
    sa = s.service_account_dict
    assert sa["client_email"] == "x@x.iam"


def test_settings_required_missing(monkeypatch):
    for v in ("GOOGLE_SERVICE_ACCOUNT_JSON", "SHEETS_CONTROLE_ID"):
        monkeypatch.delenv(v, raising=False)
    with pytest.raises(Exception):
        Settings()
