# Finalizer SkateDreams — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `finalizer-skatedreams` Python service that replaces the n8n `Finalizacao de Perdidos Latest` workflow (W2) and re-enables W3 validation, incorporating the corrections learned in 2026-05-23/24 (DELETE+INSERT for master recurrence, "only shorten UNTIL", master color preservation).

**Architecture:** Standalone FastAPI service running inside the existing Hetzner Docker Swarm. APScheduler triggers the reconciliation pipeline once a day at 03:00 BRT. The pipeline reads Controle/Calendario/Logs from the Google Sheet, classifies into Grupo A (auto-finalize), Grupo B/C (report only), executes Grupo A, validates with W3, and exposes the last report at `GET /status`. Stateless — no DB.

**Tech Stack:** Python 3.12, FastAPI + uvicorn, APScheduler 3.x, googleapiclient + google-auth, pydantic v2 + pydantic-settings, structlog, httpx (async), pytest + pytest-mock, uv (deps manager), Docker multi-stage on `python:3.12-slim`.

**Spec:** `docs/superpowers/specs/2026-05-24-finalizer-skatedreams-design.md`

---

## Task 1: Project scaffold (pyproject + uv + folders)

**Files:**
- Create: `finalizer-skatedreams/.python-version`
- Create: `finalizer-skatedreams/pyproject.toml`
- Create: `finalizer-skatedreams/.gitignore`
- Create: `finalizer-skatedreams/src/finalizer/__init__.py`
- Create: `finalizer-skatedreams/tests/__init__.py`
- Create: `finalizer-skatedreams/tests/unit/__init__.py`
- Create: `finalizer-skatedreams/tests/integration/__init__.py`
- Create: `finalizer-skatedreams/tests/fixtures/__init__.py`

- [ ] **Step 1: Set Python version**

Write `finalizer-skatedreams/.python-version`:
```
3.12
```

- [ ] **Step 2: Write pyproject.toml**

Write `finalizer-skatedreams/pyproject.toml`:
```toml
[project]
name = "finalizer-skatedreams"
version = "0.1.0"
description = "Substitui o W2/W3 do n8n da Skate Dreams (finalização de pedidos + validação)"
requires-python = ">=3.12"
dependencies = [
  "fastapi>=0.115",
  "uvicorn[standard]>=0.32",
  "apscheduler>=3.10,<4",
  "google-api-python-client>=2.149",
  "google-auth>=2.35",
  "pydantic>=2.9",
  "pydantic-settings>=2.6",
  "structlog>=24.4",
  "httpx>=0.27",
  "python-dateutil>=2.9",
]

[dependency-groups]
dev = [
  "pytest>=8.3",
  "pytest-asyncio>=0.24",
  "pytest-mock>=3.14",
  "pytest-cov>=5.0",
  "respx>=0.21",
  "ruff>=0.7",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src/finalizer"]

[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"
addopts = "-ra --strict-markers"

[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "I", "B", "UP", "N"]
ignore = ["E501"]
```

- [ ] **Step 3: Write .gitignore**

Write `finalizer-skatedreams/.gitignore`:
```
__pycache__/
*.py[cod]
*$py.class
.pytest_cache/
.ruff_cache/
.coverage
htmlcov/
.venv/
.env
.env.local
*.egg-info/
dist/
build/
docker/stack.env
docker/stack.deploy.yml
secrets/
uv.lock
```

- [ ] **Step 4: Create package skeletons**

Write `finalizer-skatedreams/src/finalizer/__init__.py`:
```python
"""Finalizer SkateDreams — replaces n8n W2/W3."""

__version__ = "0.1.0"
```

Write `finalizer-skatedreams/tests/__init__.py`, `tests/unit/__init__.py`, `tests/integration/__init__.py`, `tests/fixtures/__init__.py` as empty files.

- [ ] **Step 5: Install deps and verify**

Run:
```bash
cd finalizer-skatedreams && uv sync --all-groups
uv run pytest --collect-only
```
Expected: `no tests ran in 0.XXs`. No errors.

- [ ] **Step 6: Commit**

```bash
git add finalizer-skatedreams/pyproject.toml finalizer-skatedreams/.python-version \
        finalizer-skatedreams/.gitignore \
        finalizer-skatedreams/src/finalizer/__init__.py \
        finalizer-skatedreams/tests/__init__.py \
        finalizer-skatedreams/tests/unit/__init__.py \
        finalizer-skatedreams/tests/integration/__init__.py \
        finalizer-skatedreams/tests/fixtures/__init__.py
git commit -m "chore(finalizer): scaffold projeto Python (uv + pyproject)"
```

---

## Task 2: Settings (pydantic-settings)

**Files:**
- Create: `finalizer-skatedreams/src/finalizer/config.py`
- Test: `finalizer-skatedreams/tests/unit/test_config.py`

- [ ] **Step 1: Write the failing test**

Write `finalizer-skatedreams/tests/unit/test_config.py`:
```python
import base64
import json
import os

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/unit/test_config.py -v`
Expected: `ImportError` / `ModuleNotFoundError: finalizer.config`.

- [ ] **Step 3: Implement config.py**

Write `finalizer-skatedreams/src/finalizer/config.py`:
```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/unit/test_config.py -v`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add finalizer-skatedreams/src/finalizer/config.py finalizer-skatedreams/tests/unit/test_config.py
git commit -m "feat(finalizer): config Settings com pydantic-settings"
```

---

## Task 3: Google auth + creds factory

**Files:**
- Create: `finalizer-skatedreams/src/finalizer/google/__init__.py`
- Create: `finalizer-skatedreams/src/finalizer/google/auth.py`
- Test: `finalizer-skatedreams/tests/unit/test_google_auth.py`

- [ ] **Step 1: Write the failing test**

Write `finalizer-skatedreams/tests/unit/test_google_auth.py`:
```python
import base64
import json
from unittest.mock import patch

from finalizer.google.auth import build_credentials, CALENDAR_SCOPE, SHEETS_SCOPE


def test_scopes_constants():
    assert CALENDAR_SCOPE == "https://www.googleapis.com/auth/calendar.events"
    assert SHEETS_SCOPE == "https://www.googleapis.com/auth/spreadsheets"


def test_build_credentials_decodes_b64():
    sa_dict = {"type": "service_account", "client_email": "x@x.iam", "token_uri": "https://oauth2.googleapis.com/token"}
    b64 = base64.b64encode(json.dumps(sa_dict).encode()).decode()
    with patch("finalizer.google.auth.service_account.Credentials.from_service_account_info") as m:
        m.return_value = "fake-creds"
        creds = build_credentials(b64, [CALENDAR_SCOPE, SHEETS_SCOPE])
    m.assert_called_once_with(sa_dict, scopes=[CALENDAR_SCOPE, SHEETS_SCOPE])
    assert creds == "fake-creds"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/unit/test_google_auth.py -v`
Expected: ImportError.

- [ ] **Step 3: Implement google/auth.py**

Write `finalizer-skatedreams/src/finalizer/google/__init__.py` (empty).

Write `finalizer-skatedreams/src/finalizer/google/auth.py`:
```python
"""Service Account credential factory."""

import base64
import json

from google.oauth2 import service_account

CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events"
SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets"


def build_credentials(sa_json_b64: str, scopes: list[str]):
    sa_dict = json.loads(base64.b64decode(sa_json_b64))
    return service_account.Credentials.from_service_account_info(sa_dict, scopes=scopes)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/unit/test_google_auth.py -v`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add finalizer-skatedreams/src/finalizer/google/
git commit -m "feat(finalizer): google.auth — service account creds factory"
```

---

## Task 4: Domain models (pydantic)

**Files:**
- Create: `finalizer-skatedreams/src/finalizer/domain/__init__.py`
- Create: `finalizer-skatedreams/src/finalizer/domain/models.py`
- Test: `finalizer-skatedreams/tests/unit/test_models.py`

- [ ] **Step 1: Write the failing test**

Write `finalizer-skatedreams/tests/unit/test_models.py`:
```python
import pytest

from finalizer.domain.models import PedidoControle, parse_int_or_none


def test_parse_int_or_none():
    assert parse_int_or_none("5") == 5
    assert parse_int_or_none("") is None
    assert parse_int_or_none(None) is None
    assert parse_int_or_none("abc") is None
    assert parse_int_or_none("-3") == -3
    assert parse_int_or_none("12.0") == 12


def test_pedido_from_row():
    row = ["1", "100", "12345", "Aluno X", "ativo", "", "Filho Y", "obs", "01/04/2026", "", "", "1200", "100", "1x", "Mensal", "12", "0", "", "0", "12"]
    p = PedidoControle.from_row(row, 5)
    assert p.row == 5
    assert p.id == 100
    assert p.nome == "Aluno X"
    assert p.situacao == "ativo"
    assert p.aulas_contratadas == 12
    assert p.aulas_realizadas_agenda == 12
    assert p.aulas_restantes == 0


def test_pedido_from_row_short_row():
    row = ["1", "200", "12345", "Outro", "pendente"]
    p = PedidoControle.from_row(row, 8)
    assert p.id == 200
    assert p.nome == "Outro"
    assert p.aulas_contratadas is None
    assert p.aulas_restantes is None


def test_pedido_rejects_no_id():
    with pytest.raises(ValueError):
        PedidoControle.from_row(["1", "", "", "x", "ativo"], 3)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/unit/test_models.py -v`
Expected: ImportError.

- [ ] **Step 3: Implement models.py**

Write `finalizer-skatedreams/src/finalizer/domain/__init__.py` (empty).

Write `finalizer-skatedreams/src/finalizer/domain/models.py`:
```python
"""Domain models for Controle, Calendario, Logs."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


def parse_int_or_none(v) -> int | None:
    if v is None:
        return None
    s = str(v).strip()
    if not s:
        return None
    try:
        return int(float(s))
    except (ValueError, TypeError):
        return None


def parse_float_or_none(v) -> float | None:
    if v is None:
        return None
    s = str(v).strip().replace(",", ".")
    if not s:
        return None
    try:
        return float(s)
    except (ValueError, TypeError):
        return None


Situacao = Literal["pendente", "ativo", "Ativo", "finalizado", "encerrado", "machucado", "credito"]


class PedidoControle(BaseModel):
    row: int
    contador: str = ""
    id: int
    cpf: str | None = None
    nome: str
    situacao: str
    cancelado_em: str | None = None
    nome_filho: str | None = None
    obs: str | None = None
    inicio: str | None = None
    termino: str | None = None
    motivo_termino: str | None = None
    valor: float | None = None
    valor_aula: float | None = None
    freq: str | None = None
    plano: str | None = None
    aulas_contratadas: int | None = None
    aulas_realizadas_estatico: int | None = None
    extra: str | None = None
    aulas_realizadas_agenda: int | None = None
    aulas_restantes: int | None = None

    @classmethod
    def from_row(cls, row: list, row_number: int) -> "PedidoControle":
        padded = list(row) + [""] * max(0, 19 - len(row))
        id_int = parse_int_or_none(padded[1])
        if id_int is None:
            raise ValueError(f"Row {row_number}: id (col B) missing or invalid: {padded[1]!r}")
        return cls(
            row=row_number,
            contador=str(padded[0] or ""),
            id=id_int,
            cpf=(padded[2] or None) and str(padded[2]),
            nome=str(padded[3] or ""),
            situacao=str(padded[4] or ""),
            cancelado_em=(padded[5] or None) and str(padded[5]),
            nome_filho=(padded[6] or None) and str(padded[6]),
            obs=(padded[7] or None) and str(padded[7]),
            inicio=(padded[8] or None) and str(padded[8]),
            termino=(padded[9] or None) and str(padded[9]),
            motivo_termino=(padded[10] or None) and str(padded[10]),
            valor=parse_float_or_none(padded[11]),
            valor_aula=parse_float_or_none(padded[12]),
            freq=(padded[13] or None) and str(padded[13]),
            plano=(padded[14] or None) and str(padded[14]),
            aulas_contratadas=parse_int_or_none(padded[15]),
            aulas_realizadas_estatico=parse_int_or_none(padded[16]),
            extra=(padded[17] or None) and str(padded[17]),
            aulas_realizadas_agenda=parse_int_or_none(padded[18]),
            aulas_restantes=parse_int_or_none(padded[19]) if len(padded) > 19 else None,
        )


class EventoCalendario(BaseModel):
    titulo: str
    cor: int | None = None
    inicio: datetime | None = None
    fim: datetime | None = None
    info_descricao: str | None = None
    presenca: str | None = None
    id: int | None = None
    teste: str | None = None
    nome_controle: str | None = None
    preco_por_aula: float | None = None
    professor: str | None = None

    @classmethod
    def from_row(cls, row: list) -> "EventoCalendario":
        padded = list(row) + [""] * max(0, 11 - len(row))
        return cls(
            titulo=str(padded[0] or ""),
            cor=parse_int_or_none(padded[1]),
            inicio=_parse_iso_or_dd_mm_yyyy(padded[2]),
            fim=_parse_iso_or_dd_mm_yyyy(padded[3]),
            info_descricao=(padded[4] or None) and str(padded[4]),
            presenca=(padded[5] or None) and str(padded[5]),
            id=parse_int_or_none(padded[6]),
            teste=(padded[7] or None) and str(padded[7]),
            nome_controle=(padded[8] or None) and str(padded[8]),
            preco_por_aula=parse_float_or_none(padded[9]),
            professor=(padded[10] or None) and str(padded[10]),
        )


class LogRow(BaseModel):
    data: str
    id_antigo: int
    id_novo: int
    pedido_finalizado: str
    pedido_novo_criado: str
    agenda_recorrente_antiga_finalizada: str
    agenda_recorrente_nova_criada: str
    cor_atribuida: str
    nome: str
    check_automatico: str = ""

    @classmethod
    def from_row(cls, row: list) -> "LogRow":
        padded = list(row) + [""] * max(0, 10 - len(row))
        return cls(
            data=str(padded[0] or ""),
            id_antigo=parse_int_or_none(padded[1]) or 0,
            id_novo=parse_int_or_none(padded[2]) or 0,
            pedido_finalizado=str(padded[3] or ""),
            pedido_novo_criado=str(padded[4] or ""),
            agenda_recorrente_antiga_finalizada=str(padded[5] or ""),
            agenda_recorrente_nova_criada=str(padded[6] or ""),
            cor_atribuida=str(padded[7] or ""),
            nome=str(padded[8] or ""),
            check_automatico=str(padded[9] or ""),
        )


def _parse_iso_or_dd_mm_yyyy(v) -> datetime | None:
    if not v:
        return None
    s = str(v).strip()
    if not s:
        return None
    if "/" in s:
        try:
            d, m, y = s.split(" ")[0].split("/")
            time_part = s.split(" ")[1] if " " in s else "00:00"
            hh, mm = time_part.split(":")
            return datetime(int(y), int(m), int(d), int(hh), int(mm))
        except (ValueError, IndexError):
            return None
    try:
        return datetime.fromisoformat(s)
    except ValueError:
        return None
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/unit/test_models.py -v`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add finalizer-skatedreams/src/finalizer/domain/ finalizer-skatedreams/tests/unit/test_models.py
git commit -m "feat(finalizer): models PedidoControle, EventoCalendario, LogRow"
```

---

## Task 5: Parse helpers (RRULE, datas, título)

**Files:**
- Create: `finalizer-skatedreams/src/finalizer/domain/parse_helpers.py`
- Test: `finalizer-skatedreams/tests/unit/test_parse_helpers.py`

- [ ] **Step 1: Write the failing test**

Write `finalizer-skatedreams/tests/unit/test_parse_helpers.py`:
```python
from datetime import datetime

from finalizer.domain.parse_helpers import (
    fmt_yyyymmdd,
    limpa_titulo,
    parse_dd_mm_yyyy,
    parse_id_from_summary,
    parse_until_from_rrule,
)


def test_limpa_titulo_pipe():
    assert limpa_titulo("Leandro M Pinto | id: 105", "fallback") == "Leandro M Pinto"


def test_limpa_titulo_sem_pipe():
    assert limpa_titulo("Leandro id: 105", "fallback") == "Leandro"


def test_limpa_titulo_vazio_usa_fallback():
    assert limpa_titulo("id: 105", "Aluno X") == "Aluno X"


def test_limpa_titulo_dash():
    assert limpa_titulo("Aluno - id: 99", "fallback") == "Aluno"


def test_parse_id_from_summary():
    assert parse_id_from_summary("Aluno | id: 12") == 12
    assert parse_id_from_summary("Aluno id:34") == 34
    assert parse_id_from_summary("Sem id") is None


def test_parse_until_from_rrule():
    assert parse_until_from_rrule("RRULE:FREQ=WEEKLY;UNTIL=20260517T235959Z") == datetime(2026, 5, 17, 23, 59, 59)
    assert parse_until_from_rrule("RRULE:FREQ=WEEKLY") is None
    assert parse_until_from_rrule(None) is None


def test_parse_dd_mm_yyyy():
    assert parse_dd_mm_yyyy("17/05/2026") == datetime(2026, 5, 17)


def test_fmt_yyyymmdd():
    assert fmt_yyyymmdd(datetime(2026, 5, 17)) == "20260517"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/unit/test_parse_helpers.py -v`
Expected: ImportError.

- [ ] **Step 3: Implement parse_helpers.py**

Write `finalizer-skatedreams/src/finalizer/domain/parse_helpers.py`:
```python
"""Parsing helpers for titles, RRULE, and dates."""

import re
from datetime import datetime

_ID_IN_SUMMARY = re.compile(r"\bid\s*:?\s*(\d+)\b", re.IGNORECASE)
_ID_FOR_CLEAN = re.compile(r"\s*(?:\||-)?\s*\bid\s*:?\s*\d+\b", re.IGNORECASE)
_TRAILING_PUNCT = re.compile(r"[|:\-]+$")
_MULTI_SPACE = re.compile(r"\s{2,}")
_UNTIL = re.compile(r"UNTIL=(\d{8}T\d{6}Z|\d{8})")


def limpa_titulo(s: str | None, fallback: str) -> str:
    if not s:
        return fallback
    cleaned = _ID_FOR_CLEAN.sub("", s)
    cleaned = _MULTI_SPACE.sub(" ", cleaned)
    cleaned = _TRAILING_PUNCT.sub("", cleaned).strip()
    return cleaned or fallback


def parse_id_from_summary(summary: str | None) -> int | None:
    if not summary:
        return None
    m = _ID_IN_SUMMARY.search(summary)
    return int(m.group(1)) if m else None


def parse_until_from_rrule(rrule: str | None) -> datetime | None:
    if not rrule:
        return None
    m = _UNTIL.search(rrule)
    if not m:
        return None
    raw = m.group(1)
    if "T" in raw:
        return datetime.strptime(raw, "%Y%m%dT%H%M%SZ")
    return datetime.strptime(raw, "%Y%m%d")


def parse_dd_mm_yyyy(s: str) -> datetime:
    d, m, y = s.split("/")
    return datetime(int(y), int(m), int(d))


def fmt_yyyymmdd(d: datetime) -> str:
    return d.strftime("%Y%m%d")


def rrule_sem_until(rrule: str) -> str:
    return re.sub(r";UNTIL=[^;]*", "", rrule)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/unit/test_parse_helpers.py -v`
Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add finalizer-skatedreams/src/finalizer/domain/parse_helpers.py finalizer-skatedreams/tests/unit/test_parse_helpers.py
git commit -m "feat(finalizer): parse helpers (RRULE, datas, título)"
```

---

## Task 6: Google Calendar wrapper

**Files:**
- Create: `finalizer-skatedreams/src/finalizer/google/calendar.py`
- Test: `finalizer-skatedreams/tests/unit/test_google_calendar.py`

- [ ] **Step 1: Write the failing test**

Write `finalizer-skatedreams/tests/unit/test_google_calendar.py`:
```python
from unittest.mock import MagicMock

import pytest
from googleapiclient.errors import HttpError

from finalizer.google.calendar import CalendarClient


def _make_resp(status: int):
    r = MagicMock()
    r.status = status
    r.reason = "x"
    return r


def test_list_events_calls_api():
    api = MagicMock()
    api.events().list().execute.return_value = {"items": [{"id": "evt1"}]}
    c = CalendarClient(api, "cal@x.com")
    items = c.list_events(query="id: 12", time_min="2025-11-01T00:00:00Z", time_max="2027-12-31T00:00:00Z")
    assert items == [{"id": "evt1"}]


def test_get_event_calls_api():
    api = MagicMock()
    api.events().get().execute.return_value = {"id": "m1", "recurrence": ["RRULE:FREQ=WEEKLY"]}
    c = CalendarClient(api, "cal@x.com")
    ev = c.get_event("m1")
    assert ev["id"] == "m1"


def test_insert_event_retries_on_429(mocker):
    api = MagicMock()
    err = HttpError(_make_resp(429), b"rate")
    api.events().insert().execute.side_effect = [err, err, {"id": "new"}]
    c = CalendarClient(api, "cal@x.com", retry_delays=[0, 0, 0])
    result = c.insert_event({"summary": "x"})
    assert result["id"] == "new"
    assert api.events().insert().execute.call_count == 3


def test_insert_event_no_retry_on_400(mocker):
    api = MagicMock()
    err = HttpError(_make_resp(400), b"bad")
    api.events().insert().execute.side_effect = err
    c = CalendarClient(api, "cal@x.com", retry_delays=[0, 0, 0])
    with pytest.raises(HttpError):
        c.insert_event({"summary": "x"})
    assert api.events().insert().execute.call_count == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/unit/test_google_calendar.py -v`
Expected: ImportError.

- [ ] **Step 3: Implement calendar.py**

Write `finalizer-skatedreams/src/finalizer/google/calendar.py`:
```python
"""Google Calendar API wrapper with retries."""

import time
from typing import Any

from googleapiclient.errors import HttpError

RETRYABLE_STATUS = {429, 500, 502, 503, 504}
DEFAULT_RETRY_DELAYS = [1, 4, 16]


class CalendarClient:
    def __init__(self, api, calendar_id: str, retry_delays: list[int] | None = None):
        self._api = api
        self.calendar_id = calendar_id
        self._delays = retry_delays if retry_delays is not None else DEFAULT_RETRY_DELAYS

    def _with_retry(self, request_fn):
        last_err: Exception | None = None
        attempts = len(self._delays) + 1
        for i in range(attempts):
            try:
                return request_fn().execute()
            except HttpError as e:
                last_err = e
                status = getattr(e.resp, "status", None)
                if status not in RETRYABLE_STATUS or i == attempts - 1:
                    raise
                time.sleep(self._delays[i] if i < len(self._delays) else self._delays[-1])
        raise last_err  # type: ignore[misc]

    def list_events(
        self,
        query: str | None = None,
        time_min: str | None = None,
        time_max: str | None = None,
        single_events: bool = True,
        order_by: str = "startTime",
        max_results: int = 500,
    ) -> list[dict[str, Any]]:
        items: list[dict] = []
        page_token: str | None = None
        while True:
            params = {
                "calendarId": self.calendar_id,
                "singleEvents": single_events,
                "maxResults": max_results,
            }
            if query:
                params["q"] = query
            if time_min:
                params["timeMin"] = time_min
            if time_max:
                params["timeMax"] = time_max
            if single_events:
                params["orderBy"] = order_by
            if page_token:
                params["pageToken"] = page_token
            resp = self._with_retry(lambda p=dict(params): self._api.events().list(**p))
            items.extend(resp.get("items", []))
            page_token = resp.get("nextPageToken")
            if not page_token:
                break
        return items

    def get_event(self, event_id: str) -> dict[str, Any]:
        return self._with_retry(lambda: self._api.events().get(calendarId=self.calendar_id, eventId=event_id))

    def insert_event(self, body: dict) -> dict[str, Any]:
        return self._with_retry(lambda: self._api.events().insert(calendarId=self.calendar_id, body=body))

    def delete_event(self, event_id: str) -> None:
        self._with_retry(lambda: self._api.events().delete(calendarId=self.calendar_id, eventId=event_id))

    def patch_event(self, event_id: str, body: dict) -> dict[str, Any]:
        return self._with_retry(lambda: self._api.events().patch(calendarId=self.calendar_id, eventId=event_id, body=body))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/unit/test_google_calendar.py -v`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add finalizer-skatedreams/src/finalizer/google/calendar.py finalizer-skatedreams/tests/unit/test_google_calendar.py
git commit -m "feat(finalizer): CalendarClient wrapper com retry/backoff"
```

---

## Task 7: Google Sheets wrapper

**Files:**
- Create: `finalizer-skatedreams/src/finalizer/google/sheets.py`
- Test: `finalizer-skatedreams/tests/unit/test_google_sheets.py`

- [ ] **Step 1: Write the failing test**

Write `finalizer-skatedreams/tests/unit/test_google_sheets.py`:
```python
from unittest.mock import MagicMock

from finalizer.google.sheets import SheetsClient


def test_read_returns_values():
    api = MagicMock()
    api.spreadsheets().values().get().execute.return_value = {"values": [["a", "b"], ["c", "d"]]}
    c = SheetsClient(api, "sheet-id")
    assert c.read("Controle!A:S") == [["a", "b"], ["c", "d"]]


def test_read_empty():
    api = MagicMock()
    api.spreadsheets().values().get().execute.return_value = {}
    c = SheetsClient(api, "sheet-id")
    assert c.read("Controle!A:S") == []


def test_update_calls_api():
    api = MagicMock()
    api.spreadsheets().values().update().execute.return_value = {"updatedCells": 1}
    c = SheetsClient(api, "sheet-id")
    c.update("Controle!E5", [["finalizado"]], value_input_option="RAW")
    api.spreadsheets().values().update.assert_called_with(
        spreadsheetId="sheet-id", range="Controle!E5",
        valueInputOption="RAW", body={"values": [["finalizado"]]},
    )


def test_append_calls_api():
    api = MagicMock()
    api.spreadsheets().values().append().execute.return_value = {"updates": {"updatedRange": "Controle!A100"}}
    c = SheetsClient(api, "sheet-id")
    c.append("Controle!A:S", [["", "1", "x"]], value_input_option="USER_ENTERED")
    api.spreadsheets().values().append.assert_called_with(
        spreadsheetId="sheet-id", range="Controle!A:S",
        valueInputOption="USER_ENTERED", insertDataOption="INSERT_ROWS",
        body={"values": [["", "1", "x"]]},
    )
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/unit/test_google_sheets.py -v`
Expected: ImportError.

- [ ] **Step 3: Implement sheets.py**

Write `finalizer-skatedreams/src/finalizer/google/sheets.py`:
```python
"""Google Sheets API wrapper with retries."""

import time

from googleapiclient.errors import HttpError

RETRYABLE_STATUS = {429, 500, 502, 503, 504}
DEFAULT_RETRY_DELAYS = [1, 4, 16]


class SheetsClient:
    def __init__(self, api, spreadsheet_id: str, retry_delays: list[int] | None = None):
        self._api = api
        self.spreadsheet_id = spreadsheet_id
        self._delays = retry_delays if retry_delays is not None else DEFAULT_RETRY_DELAYS

    def _with_retry(self, request_fn):
        last_err: Exception | None = None
        attempts = len(self._delays) + 1
        for i in range(attempts):
            try:
                return request_fn().execute()
            except HttpError as e:
                last_err = e
                status = getattr(e.resp, "status", None)
                if status not in RETRYABLE_STATUS or i == attempts - 1:
                    raise
                time.sleep(self._delays[i] if i < len(self._delays) else self._delays[-1])
        raise last_err  # type: ignore[misc]

    def read(self, range_a1: str) -> list[list]:
        resp = self._with_retry(
            lambda: self._api.spreadsheets().values().get(spreadsheetId=self.spreadsheet_id, range=range_a1)
        )
        return resp.get("values", [])

    def update(self, range_a1: str, values: list[list], value_input_option: str = "RAW") -> dict:
        return self._with_retry(
            lambda: self._api.spreadsheets().values().update(
                spreadsheetId=self.spreadsheet_id,
                range=range_a1,
                valueInputOption=value_input_option,
                body={"values": values},
            )
        )

    def append(self, range_a1: str, values: list[list], value_input_option: str = "USER_ENTERED") -> dict:
        return self._with_retry(
            lambda: self._api.spreadsheets().values().append(
                spreadsheetId=self.spreadsheet_id,
                range=range_a1,
                valueInputOption=value_input_option,
                insertDataOption="INSERT_ROWS",
                body={"values": values},
            )
        )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/unit/test_google_sheets.py -v`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add finalizer-skatedreams/src/finalizer/google/sheets.py finalizer-skatedreams/tests/unit/test_google_sheets.py
git commit -m "feat(finalizer): SheetsClient wrapper com retry/backoff"
```

---

## Task 8: Classifier (Grupo A/B/C)

**Files:**
- Create: `finalizer-skatedreams/src/finalizer/domain/classifier.py`
- Test: `finalizer-skatedreams/tests/unit/test_classifier.py`

- [ ] **Step 1: Write the failing test**

Write `finalizer-skatedreams/tests/unit/test_classifier.py`:
```python
from finalizer.domain.classifier import classificar
from finalizer.domain.models import PedidoControle


def _pedido(**kwargs):
    base = {"row": 2, "id": 1, "nome": "X", "situacao": "ativo"}
    base.update(kwargs)
    return PedidoControle(**base)


def test_classifica_grupo_a_zerados():
    pedidos = [
        _pedido(id=1, aulas_restantes=0, situacao="ativo"),
        _pedido(id=2, aulas_restantes=5, situacao="ativo"),
    ]
    c = classificar(pedidos)
    assert [p.id for p in c.grupo_a_auto] == [1]
    assert c.grupo_b_report == []


def test_classifica_grupo_b_estourados():
    pedidos = [
        _pedido(id=10, aulas_restantes=-2, situacao="ativo"),
        _pedido(id=11, aulas_restantes=-1, situacao="Ativo"),
    ]
    c = classificar(pedidos)
    assert {p.id for p in c.grupo_b_report} == {10, 11}
    assert c.grupo_a_auto == []


def test_classifica_normalizacoes_e():
    pedidos = [
        _pedido(id=5, row=7, situacao="Ativo", aulas_restantes=3),
        _pedido(id=6, row=8, situacao="ativo", aulas_restantes=2),
    ]
    c = classificar(pedidos)
    assert c.normalizacoes_e == [7]


def test_classifica_grupo_c_intermediario():
    pedidos = [
        _pedido(id=20, situacao="ativo", aulas_restantes=5, motivo_termino="Automático"),
        _pedido(id=21, situacao="pendente", aulas_restantes=None, motivo_termino="Automático"),
        _pedido(id=22, situacao="ativo", aulas_restantes=5, termino="01/05/2026"),
    ]
    c = classificar(pedidos)
    assert {p.id for p in c.grupo_c_report} == {20, 21, 22}


def test_grupo_c_nao_inclui_grupo_a_ou_b():
    pedidos = [
        _pedido(id=1, situacao="ativo", aulas_restantes=0, motivo_termino="Automático"),
        _pedido(id=2, situacao="ativo", aulas_restantes=-1, motivo_termino="Automático"),
    ]
    c = classificar(pedidos)
    assert [p.id for p in c.grupo_a_auto] == [1]
    assert [p.id for p in c.grupo_b_report] == [2]
    assert c.grupo_c_report == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/unit/test_classifier.py -v`
Expected: ImportError.

- [ ] **Step 3: Implement classifier.py**

Write `finalizer-skatedreams/src/finalizer/domain/classifier.py`:
```python
"""Classify Controle rows into Grupo A (auto-finalize), B (estourados report), C (intermediate state)."""

from pydantic import BaseModel

from finalizer.domain.models import PedidoControle


class Classificacao(BaseModel):
    grupo_a_auto: list[PedidoControle]
    grupo_b_report: list[PedidoControle]
    grupo_c_report: list[PedidoControle]
    normalizacoes_e: list[int]  # row numbers where situacao=='Ativo' → 'ativo'


def classificar(pedidos: list[PedidoControle]) -> Classificacao:
    grupo_a, grupo_b, grupo_c = [], [], []
    norm_e = []
    in_a_or_b: set[int] = set()

    for p in pedidos:
        sit = (p.situacao or "").lower()
        if p.situacao == "Ativo":
            norm_e.append(p.row)
        restantes = p.aulas_restantes
        if sit == "ativo" and restantes is not None and restantes == 0:
            grupo_a.append(p)
            in_a_or_b.add(p.row)
        elif sit == "ativo" and restantes is not None and restantes < 0:
            grupo_b.append(p)
            in_a_or_b.add(p.row)

    for p in pedidos:
        sit = (p.situacao or "").lower()
        if p.row in in_a_or_b:
            continue
        if sit in ("ativo", "pendente") and ((p.motivo_termino or "").strip() or (p.termino or "").strip()):
            grupo_c.append(p)

    return Classificacao(
        grupo_a_auto=grupo_a,
        grupo_b_report=grupo_b,
        grupo_c_report=grupo_c,
        normalizacoes_e=norm_e,
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/unit/test_classifier.py -v`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add finalizer-skatedreams/src/finalizer/domain/classifier.py finalizer-skatedreams/tests/unit/test_classifier.py
git commit -m "feat(finalizer): classifier (Grupo A/B/C + normalizações)"
```

---

## Task 9: data_termino calculator (from Calendario)

**Files:**
- Create: `finalizer-skatedreams/src/finalizer/domain/data_termino.py`
- Test: `finalizer-skatedreams/tests/unit/test_data_termino.py`

- [ ] **Step 1: Write the failing test**

Write `finalizer-skatedreams/tests/unit/test_data_termino.py`:
```python
from finalizer.domain.data_termino import compute_data_termino


def test_data_termino_max_presenca():
    calendario_rows = [
        # titulo, cor, inicio, fim, info, presenca, id, teste, nome_ctrl, preco, prof
        ["Aluno | id: 12", "7", "01/04/2026 10:00", "01/04/2026 11:00", "", "Presença", "12", "", "Aluno", "100", "Carlos"],
        ["Aluno | id: 12", "11", "08/04/2026 10:00", "08/04/2026 11:00", "", "Falta", "12", "", "Aluno", "100", "Carlos"],
        ["Aluno | id: 12", "7", "15/04/2026 10:00", "15/04/2026 11:00", "", "Presença", "12", "", "Aluno", "100", "Carlos"],
        ["Aluno | id: 99", "7", "20/04/2026 10:00", "20/04/2026 11:00", "", "Presença", "99", "", "Outro", "100", "Carlos"],
    ]
    assert compute_data_termino(calendario_rows, 12) == "15/04/2026"


def test_data_termino_no_presenca_returns_none():
    calendario_rows = [
        ["Aluno | id: 12", "11", "01/04/2026 10:00", "01/04/2026 11:00", "", "Falta", "12", "", "", "", ""],
    ]
    assert compute_data_termino(calendario_rows, 12) is None


def test_data_termino_id_not_found():
    assert compute_data_termino([], 12) is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/unit/test_data_termino.py -v`
Expected: ImportError.

- [ ] **Step 3: Implement data_termino.py**

Write `finalizer-skatedreams/src/finalizer/domain/data_termino.py`:
```python
"""Compute data_termino from the Calendario sheet (filtered by Apps Script)."""

from finalizer.domain.models import parse_int_or_none


def compute_data_termino(calendario_rows: list[list], pedido_id: int) -> str | None:
    """Return max(inicio) where id=pedido_id and presenca='Presença', formatted as dd/MM/yyyy."""
    presencas: list[tuple[int, int, int]] = []  # (y, m, d) sortable
    for row in calendario_rows:
        if len(row) < 11:
            row = list(row) + [""] * (11 - len(row))
        if parse_int_or_none(row[6]) != pedido_id:
            continue
        presenca = str(row[5] or "").strip()
        if presenca != "Presença":
            continue
        inicio = str(row[2] or "").strip()
        if not inicio or "/" not in inicio:
            continue
        date_part = inicio.split(" ")[0]
        try:
            d, m, y = date_part.split("/")
            presencas.append((int(y), int(m), int(d)))
        except ValueError:
            continue
    if not presencas:
        return None
    y, m, d = max(presencas)
    return f"{d:02d}/{m:02d}/{y:04d}"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/unit/test_data_termino.py -v`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add finalizer-skatedreams/src/finalizer/domain/data_termino.py finalizer-skatedreams/tests/unit/test_data_termino.py
git commit -m "feat(finalizer): data_termino calc (max Presença da Calendario)"
```

---

## Task 10: preserva_cores helper

**Files:**
- Create: `finalizer-skatedreams/src/finalizer/operations/__init__.py`
- Create: `finalizer-skatedreams/src/finalizer/operations/preserva_cores.py`
- Test: `finalizer-skatedreams/tests/unit/test_preserva_cores.py`

- [ ] **Step 1: Write the failing test**

Write `finalizer-skatedreams/tests/unit/test_preserva_cores.py`:
```python
from datetime import datetime

from finalizer.operations.preserva_cores import mapear_overrides


def _evt(start_iso: str, color: str | None, rec_id: str = "master-1"):
    return {"start": {"dateTime": start_iso}, "colorId": color, "recurringEventId": rec_id, "status": "confirmed"}


def test_mapear_overrides_picks_diff_from_master():
    events = [
        _evt("2026-04-01T10:00:00-03:00", "7"),    # master color
        _evt("2026-04-08T10:00:00-03:00", "11"),   # Tomate
        _evt("2026-04-15T10:00:00-03:00", "4"),    # Flamingo
    ]
    cut = datetime(2026, 5, 1)
    out = mapear_overrides(events, master_color="7", cut_date=cut, rec_id="master-1")
    assert out == {"2026-04-08": "11", "2026-04-15": "4"}


def test_mapear_overrides_skips_past_cut():
    events = [
        _evt("2026-04-08T10:00:00-03:00", "11"),
        _evt("2026-05-08T10:00:00-03:00", "11"),  # after cut → skip
    ]
    cut = datetime(2026, 5, 1)
    out = mapear_overrides(events, master_color="7", cut_date=cut, rec_id="master-1")
    assert out == {"2026-04-08": "11"}


def test_mapear_overrides_filters_by_rec_id():
    events = [
        _evt("2026-04-08T10:00:00-03:00", "11", rec_id="other"),
    ]
    cut = datetime(2026, 5, 1)
    assert mapear_overrides(events, master_color="7", cut_date=cut, rec_id="master-1") == {}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/unit/test_preserva_cores.py -v`
Expected: ImportError.

- [ ] **Step 3: Implement preserva_cores.py**

Write `finalizer-skatedreams/src/finalizer/operations/__init__.py` (empty).

Write `finalizer-skatedreams/src/finalizer/operations/preserva_cores.py`:
```python
"""Map color overrides on instances so they can be re-applied after DELETE+INSERT of the master."""

from datetime import datetime


def mapear_overrides(
    events: list[dict],
    master_color: str,
    cut_date: datetime,
    rec_id: str,
) -> dict[str, str]:
    """Return {YYYY-MM-DD: colorId} for instances of `rec_id` with cor != master_color and date <= cut_date."""
    overrides: dict[str, str] = {}
    for e in events:
        if e.get("recurringEventId") != rec_id:
            continue
        if e.get("status") != "confirmed":
            continue
        start = e.get("start") or {}
        iso = start.get("dateTime") or start.get("date")
        if not iso:
            continue
        date_part = iso[:10]
        try:
            d = datetime.fromisoformat(date_part)
        except ValueError:
            continue
        if d > cut_date:
            continue
        color = e.get("colorId")
        if color and color != master_color:
            overrides[date_part] = color
    return overrides
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/unit/test_preserva_cores.py -v`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add finalizer-skatedreams/src/finalizer/operations/ finalizer-skatedreams/tests/unit/test_preserva_cores.py
git commit -m "feat(finalizer): mapear cores override pra re-aplicar após DELETE+INSERT"
```

---

## Task 11: encurta_master (DELETE+INSERT + reaplicar cores)

**Files:**
- Create: `finalizer-skatedreams/src/finalizer/operations/encurta_master.py`
- Test: `finalizer-skatedreams/tests/unit/test_encurta_master.py`

- [ ] **Step 1: Write the failing test**

Write `finalizer-skatedreams/tests/unit/test_encurta_master.py`:
```python
from datetime import datetime
from unittest.mock import MagicMock, call

from finalizer.operations.encurta_master import encurta_master, EncurtaResult


def test_encurta_master_mantem_se_until_menor_ou_igual():
    calendar = MagicMock()
    master = {
        "id": "m1",
        "summary": "Aluno | id: 12",
        "recurrence": ["RRULE:FREQ=WEEKLY;UNTIL=20260401T235959Z"],
        "colorId": "7",
        "start": {"dateTime": "2026-01-01T10:00:00-03:00", "timeZone": "America/Sao_Paulo"},
        "end": {"dateTime": "2026-01-01T11:00:00-03:00", "timeZone": "America/Sao_Paulo"},
    }
    result = encurta_master(calendar, master=master, eventos_do_id=[], cut_date=datetime(2026, 5, 1), pedido_id=12)
    assert result.acao == "MANTER"
    calendar.delete_event.assert_not_called()
    calendar.insert_event.assert_not_called()


def test_encurta_master_delete_insert_quando_until_maior():
    calendar = MagicMock()
    master = {
        "id": "m1",
        "summary": "Aluno | id: 12",
        "recurrence": ["RRULE:FREQ=WEEKLY;UNTIL=20260801T235959Z"],
        "colorId": "7",
        "start": {"dateTime": "2026-01-01T10:00:00-03:00", "timeZone": "America/Sao_Paulo"},
        "end": {"dateTime": "2026-01-01T11:00:00-03:00", "timeZone": "America/Sao_Paulo"},
    }
    eventos = [
        {"id": "i1", "recurringEventId": "m1", "status": "confirmed",
         "start": {"dateTime": "2026-04-08T10:00:00-03:00"}, "colorId": "11"},
        {"id": "i2", "recurringEventId": "m1", "status": "confirmed",
         "start": {"dateTime": "2026-04-15T10:00:00-03:00"}, "colorId": "7"},
    ]
    calendar.insert_event.return_value = {"id": "m1-new"}
    calendar.list_events.return_value = [
        {"id": "newi1", "recurringEventId": "m1-new", "status": "confirmed",
         "start": {"dateTime": "2026-04-08T10:00:00-03:00"}, "colorId": "7"},
        {"id": "newi2", "recurringEventId": "m1-new", "status": "confirmed",
         "start": {"dateTime": "2026-04-15T10:00:00-03:00"}, "colorId": "7"},
    ]
    result = encurta_master(
        calendar, master=master, eventos_do_id=eventos,
        cut_date=datetime(2026, 4, 30), pedido_id=12, sleep_after_insert=0,
    )
    assert result.acao == "DELETE_INSERT"
    assert result.master_novo_id == "m1-new"
    assert result.cores_reaplicadas == 1
    calendar.delete_event.assert_called_once_with("m1")
    # Re-apply cor 11 in 2026-04-08
    calendar.patch_event.assert_any_call("newi1", {"colorId": "11"})


def test_encurta_master_sem_rrule():
    calendar = MagicMock()
    master = {"id": "m1", "summary": "x", "colorId": "7", "start": {}, "end": {}}
    result = encurta_master(calendar, master=master, eventos_do_id=[], cut_date=datetime(2026, 5, 1), pedido_id=12)
    assert result.acao == "SEM_RRULE"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/unit/test_encurta_master.py -v`
Expected: ImportError.

- [ ] **Step 3: Implement encurta_master.py**

Write `finalizer-skatedreams/src/finalizer/operations/encurta_master.py`:
```python
"""Shorten a recurrence master via DELETE+INSERT and re-apply color overrides.

NEVER use events.patch({recurrence}) on a master — it regenerates the master
(new eventId) and cancels all instance overrides (Tomate=falta, Flamingo=substituição).
"""

import time
from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from finalizer.domain.parse_helpers import fmt_yyyymmdd, parse_until_from_rrule, rrule_sem_until
from finalizer.operations.preserva_cores import mapear_overrides

Acao = Literal["MANTER", "DELETE_INSERT", "SEM_RRULE"]


@dataclass
class EncurtaResult:
    acao: Acao
    master_antigo_id: str
    master_novo_id: str | None = None
    until_anterior: str | None = None
    until_novo: str | None = None
    cores_reaplicadas: int = 0


def encurta_master(
    calendar,
    *,
    master: dict,
    eventos_do_id: list[dict],
    cut_date: datetime,
    pedido_id: int,
    sleep_after_insert: float = 1.5,
) -> EncurtaResult:
    rec_id = master["id"]
    rrule_list = master.get("recurrence") or []
    if not rrule_list:
        return EncurtaResult(acao="SEM_RRULE", master_antigo_id=rec_id)
    rrule = rrule_list[0]
    until_atual = parse_until_from_rrule(rrule)
    until_atual_str = fmt_yyyymmdd(until_atual) if until_atual else None

    if until_atual and until_atual <= cut_date:
        return EncurtaResult(acao="MANTER", master_antigo_id=rec_id, until_anterior=until_atual_str)

    master_color = master.get("colorId") or "7"
    overrides = mapear_overrides(eventos_do_id, master_color=master_color, cut_date=cut_date, rec_id=rec_id)

    calendar.delete_event(rec_id)

    cut_ymd = fmt_yyyymmdd(cut_date)
    nova_rrule = f"{rrule_sem_until(rrule)};UNTIL={cut_ymd}T235959Z"
    novo_master = calendar.insert_event({
        "summary": master.get("summary", ""),
        "start": master["start"],
        "end": master["end"],
        "recurrence": [nova_rrule],
        "colorId": master_color,
    })

    if sleep_after_insert > 0:
        time.sleep(sleep_after_insert)

    novas = calendar.list_events(
        query=f"id: {pedido_id}",
        time_min=(master["start"].get("dateTime") or master["start"].get("date")),
        time_max=f"{cut_ymd[:4]}-{cut_ymd[4:6]}-{cut_ymd[6:8]}T23:59:59Z",
    )
    reaplicadas = 0
    for e in novas:
        if e.get("status") != "confirmed":
            continue
        if e.get("recurringEventId") != novo_master["id"]:
            continue
        start = e.get("start") or {}
        iso = (start.get("dateTime") or start.get("date") or "")[:10]
        cor = overrides.get(iso)
        if cor:
            calendar.patch_event(e["id"], {"colorId": cor})
            reaplicadas += 1

    return EncurtaResult(
        acao="DELETE_INSERT",
        master_antigo_id=rec_id,
        master_novo_id=novo_master["id"],
        until_anterior=until_atual_str,
        until_novo=cut_ymd,
        cores_reaplicadas=reaplicadas,
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/unit/test_encurta_master.py -v`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add finalizer-skatedreams/src/finalizer/operations/encurta_master.py finalizer-skatedreams/tests/unit/test_encurta_master.py
git commit -m "feat(finalizer): encurta_master via DELETE+INSERT, preserva cores override"
```

---

## Task 12: substituir_recorrencia (orquestra encurta + POST novo)

**Files:**
- Create: `finalizer-skatedreams/src/finalizer/operations/substituir_recorrencia.py`
- Test: `finalizer-skatedreams/tests/unit/test_substituir_recorrencia.py`

- [ ] **Step 1: Write the failing test**

Write `finalizer-skatedreams/tests/unit/test_substituir_recorrencia.py`:
```python
from datetime import datetime
from unittest.mock import MagicMock

from finalizer.operations.substituir_recorrencia import substituir_recorrencia


def _make_events(master_id="m1", color="7"):
    return [
        {"id": "i1", "recurringEventId": master_id, "status": "confirmed",
         "start": {"dateTime": "2026-04-08T10:00:00-03:00", "timeZone": "America/Sao_Paulo"},
         "end": {"dateTime": "2026-04-08T11:00:00-03:00", "timeZone": "America/Sao_Paulo"},
         "summary": "Aluno | id: 105", "colorId": color},
        {"id": "i2", "recurringEventId": master_id, "status": "confirmed",
         "start": {"dateTime": "2026-05-13T10:00:00-03:00", "timeZone": "America/Sao_Paulo"},
         "end": {"dateTime": "2026-05-13T11:00:00-03:00", "timeZone": "America/Sao_Paulo"},
         "summary": "Aluno | id: 105", "colorId": color},
    ]


def test_substituir_recorrencia_happy_path():
    calendar = MagicMock()
    eventos = _make_events()
    master = {"id": "m1", "summary": "Aluno | id: 105", "colorId": "7",
              "recurrence": ["RRULE:FREQ=WEEKLY;UNTIL=20260801T235959Z"],
              "start": {"dateTime": "2026-01-07T10:00:00-03:00", "timeZone": "America/Sao_Paulo"},
              "end": {"dateTime": "2026-01-07T11:00:00-03:00", "timeZone": "America/Sao_Paulo"}}
    calendar.list_events.side_effect = [
        eventos,                                       # initial list of id_antigo
        [{"id": "nm1", "recurringEventId": "m1-new", "status": "confirmed",
          "start": {"dateTime": "2026-04-08T10:00:00-03:00"}, "colorId": "7"}],  # listing for re-apply (inside encurta)
        [],                                            # idempotência check for id_novo
    ]
    calendar.get_event.return_value = master
    calendar.insert_event.side_effect = [
        {"id": "m1-new"},                              # encurta INSERT
        {"id": "novo-master"},                         # POST novo id
    ]
    result = substituir_recorrencia(
        calendar,
        id_antigo=105, id_novo=427, nome="Leandro M Pinto",
        data_termino_dd_mm_yyyy="13/05/2026",
        sleep_after_insert=0,
    )
    assert result["status"] == "OK"
    assert result["colorId"] == "7"
    assert result["newEventId"] == "novo-master"
    assert any(m["acao"] == "DELETE_INSERT" for m in result["masters"])


def test_substituir_recorrencia_idempotente_quando_id_novo_existe():
    calendar = MagicMock()
    eventos = _make_events()
    master = {"id": "m1", "summary": "Aluno | id: 105", "colorId": "7",
              "recurrence": ["RRULE:FREQ=WEEKLY;UNTIL=20260801T235959Z"],
              "start": {"dateTime": "2026-01-07T10:00:00-03:00", "timeZone": "America/Sao_Paulo"},
              "end": {"dateTime": "2026-01-07T11:00:00-03:00", "timeZone": "America/Sao_Paulo"}}
    calendar.list_events.side_effect = [
        eventos,
        [],
        [{"id": "ex1", "recurringEventId": "existing-novo-master", "status": "confirmed",
          "start": {"dateTime": "2026-05-20T10:00:00-03:00"}}],
    ]
    calendar.get_event.return_value = master
    calendar.insert_event.return_value = {"id": "m1-new"}
    result = substituir_recorrencia(
        calendar,
        id_antigo=105, id_novo=427, nome="Aluno",
        data_termino_dd_mm_yyyy="13/05/2026",
        sleep_after_insert=0,
    )
    assert result["newEventId"] == "existing-novo-master"
    # Only 1 insert (the encurta), no POST id_novo because it already exists
    assert calendar.insert_event.call_count == 1


def test_substituir_recorrencia_sem_passadas_raises():
    calendar = MagicMock()
    calendar.list_events.side_effect = [[]]
    import pytest
    with pytest.raises(ValueError, match="Sem aulas"):
        substituir_recorrencia(
            calendar,
            id_antigo=105, id_novo=427, nome="X",
            data_termino_dd_mm_yyyy="13/05/2026",
            sleep_after_insert=0,
        )
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/unit/test_substituir_recorrencia.py -v`
Expected: ImportError.

- [ ] **Step 3: Implement substituir_recorrencia.py**

Write `finalizer-skatedreams/src/finalizer/operations/substituir_recorrencia.py`:
```python
"""Replace a recurrence: shorten old master(s), POST a new master with id_novo."""

from datetime import datetime, timedelta

from finalizer.domain.parse_helpers import (
    fmt_yyyymmdd,
    limpa_titulo,
    parse_dd_mm_yyyy,
    rrule_sem_until,
)
from finalizer.operations.encurta_master import encurta_master


def _iso_local(d: datetime) -> str:
    return d.strftime("%Y-%m-%dT%H:%M:%S-03:00")


def substituir_recorrencia(
    calendar,
    *,
    id_antigo: int,
    id_novo: int,
    nome: str,
    data_termino_dd_mm_yyyy: str,
    sleep_after_insert: float = 1.5,
    time_min: str = "2025-11-01T00:00:00Z",
    time_max: str = "2027-12-31T00:00:00Z",
) -> dict:
    cut_date = parse_dd_mm_yyyy(data_termino_dd_mm_yyyy)
    eventos = calendar.list_events(
        query=f"id: {id_antigo}",
        time_min=time_min,
        time_max=time_max,
        single_events=True,
    )
    eventos = [e for e in eventos if e.get("status") == "confirmed"]
    rec_ids = list({e["recurringEventId"] for e in eventos if e.get("recurringEventId")})

    masters_result = []
    main_master = None
    main_master_color = None
    main_master_rrule = None
    for rec_id in rec_ids:
        m = calendar.get_event(rec_id)
        if (m.get("recurrence") or []):
            main_master = m
            main_master_color = m.get("colorId") or "7"
            main_master_rrule = m["recurrence"][0]
        result = encurta_master(
            calendar,
            master=m,
            eventos_do_id=eventos,
            cut_date=cut_date,
            pedido_id=id_antigo,
            sleep_after_insert=sleep_after_insert,
        )
        masters_result.append({
            "rec_id": result.master_antigo_id,
            "acao": result.acao,
            "until_anterior": result.until_anterior,
            "until_novo": result.until_novo,
            "cores_reaplicadas": result.cores_reaplicadas,
            "master_novo_id": result.master_novo_id,
        })

    color_id = main_master_color or "7"

    past = [e for e in eventos if (e.get("start", {}).get("dateTime") and datetime.fromisoformat(e["start"]["dateTime"][:19]) <= cut_date)]
    if not past:
        raise ValueError("Sem aulas passadas pra inferir horário/dia da semana")
    last_past = past[-1]
    last_start = datetime.fromisoformat(last_past["start"]["dateTime"][:19])
    last_end = datetime.fromisoformat(last_past["end"]["dateTime"][:19])
    dur = last_end - last_start
    tz = last_past["start"].get("timeZone") or "America/Sao_Paulo"

    nova_start = cut_date + timedelta(days=1)
    while nova_start.weekday() != last_start.weekday():
        nova_start += timedelta(days=1)
    nova_start = nova_start.replace(hour=last_start.hour, minute=last_start.minute, second=0, microsecond=0)
    nova_end = nova_start + dur

    nova_rrule = rrule_sem_until(main_master_rrule) if main_master_rrule else "RRULE:FREQ=WEEKLY"

    check_novo = calendar.list_events(
        query=f"id: {id_novo}",
        time_min=cut_date.isoformat() + "Z",
        time_max="2027-12-31T00:00:00Z",
        single_events=True,
    )
    ja_existe_master = None
    for e in check_novo:
        if e.get("status") == "confirmed" and e.get("recurringEventId"):
            ja_existe_master = e["recurringEventId"]
            break

    if ja_existe_master:
        return {
            "status": "OK",
            "colorId": color_id,
            "newEventId": ja_existe_master,
            "masters": masters_result,
            "post_skipped": "already_exists",
        }

    titulo = limpa_titulo(last_past.get("summary"), nome)
    novo_summary = f"{titulo} | id: {id_novo}"
    post = calendar.insert_event({
        "summary": novo_summary,
        "start": {"dateTime": _iso_local(nova_start), "timeZone": tz},
        "end": {"dateTime": _iso_local(nova_end), "timeZone": tz},
        "recurrence": [nova_rrule],
        "colorId": color_id,
    })
    return {
        "status": "OK",
        "colorId": color_id,
        "newEventId": post["id"],
        "masters": masters_result,
        "novo_summary": novo_summary,
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/unit/test_substituir_recorrencia.py -v`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add finalizer-skatedreams/src/finalizer/operations/substituir_recorrencia.py finalizer-skatedreams/tests/unit/test_substituir_recorrencia.py
git commit -m "feat(finalizer): substituir_recorrencia (encurta + POST novo, idempotente)"
```

---

## Task 13: Grupo A executor (zerados — full pipeline)

**Files:**
- Create: `finalizer-skatedreams/src/finalizer/domain/grupo_a.py`
- Test: `finalizer-skatedreams/tests/unit/test_grupo_a.py`

- [ ] **Step 1: Write the failing test**

Write `finalizer-skatedreams/tests/unit/test_grupo_a.py`:
```python
from datetime import date
from unittest.mock import MagicMock

import pytest

from finalizer.domain.grupo_a import GrupoAExecutor
from finalizer.domain.models import PedidoControle


def _ped(**kwargs):
    base = {"row": 5, "id": 105, "nome": "Leandro M Pinto", "situacao": "ativo",
            "aulas_contratadas": 12, "aulas_realizadas_agenda": 12, "aulas_restantes": 0,
            "valor": 1200, "freq": "1x", "plano": "Mensal", "nome_filho": "", "cpf": "123",
            "inicio": "01/04/2026"}
    base.update(kwargs)
    return PedidoControle(**base)


def test_executor_chama_substituir_e_escreve_sheets():
    calendar = MagicMock()
    sheets = MagicMock()
    substituir = MagicMock(return_value={"status": "OK", "colorId": "7", "newEventId": "new1", "masters": []})

    # Controle re-read to get id_novo:
    sheets.read.side_effect = [
        # First call: read Controle!B:B for id_novo
        [["id"], ["1"], ["2"], ["105"]],
    ]
    calendario_rows = [
        ["Aluno | id: 105", "7", "01/04/2026 10:00", "01/04/2026 11:00", "", "Presença", "105", "", "Leandro", "100", "Carlos"],
        ["Aluno | id: 105", "7", "13/05/2026 10:00", "13/05/2026 11:00", "", "Presença", "105", "", "Leandro", "100", "Carlos"],
    ]
    pedido = _ped()

    executor = GrupoAExecutor(
        calendar=calendar,
        sheets=sheets,
        substituir_recorrencia=substituir,
        today=date(2026, 5, 24),
    )
    result = executor.executar(pedido, calendario_rows=calendario_rows)
    assert result["status"] == "OK"
    assert result["id_antigo"] == 105
    assert result["id_novo"] == 106  # max(B) + 1
    assert result["data_termino"] == "13/05/2026"
    substituir.assert_called_once()

    # Controle E/J/K updated (3 calls)
    assert sheets.update.call_count == 3
    sheets.update.assert_any_call("Controle!E5", [["finalizado"]], value_input_option="RAW")
    sheets.update.assert_any_call("Controle!J5", [["13/05/2026"]], value_input_option="RAW")
    sheets.update.assert_any_call("Controle!K5", [["Automático"]], value_input_option="RAW")

    # Append Controle row pendente (19 vals, first empty, USER_ENTERED)
    assert sheets.append.call_count == 2  # 1 Controle + 1 Logs
    controle_append = [c for c in sheets.append.call_args_list if c.args[0] == "Controle!A:S"][0]
    values = controle_append.args[1]
    assert len(values) == 1
    assert len(values[0]) == 19
    assert values[0][0] == ""
    assert values[0][1] == 106
    assert values[0][3] == "Leandro M Pinto"
    assert values[0][4] == "pendente"


def test_executor_aborta_sem_data_termino():
    calendar = MagicMock()
    sheets = MagicMock()
    sheets.read.return_value = [["id"], ["1"], ["105"]]
    substituir = MagicMock()
    executor = GrupoAExecutor(calendar=calendar, sheets=sheets, substituir_recorrencia=substituir, today=date(2026, 5, 24))
    pedido = _ped()
    with pytest.raises(ValueError, match="data_termino"):
        executor.executar(pedido, calendario_rows=[])
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/unit/test_grupo_a.py -v`
Expected: ImportError.

- [ ] **Step 3: Implement grupo_a.py**

Write `finalizer-skatedreams/src/finalizer/domain/grupo_a.py`:
```python
"""Execute Grupo A (zerados) end-to-end: substituir recorrência + escrever Controle + Logs."""

from datetime import date

from finalizer.domain.data_termino import compute_data_termino
from finalizer.domain.models import PedidoControle, parse_int_or_none


class GrupoAExecutor:
    def __init__(self, *, calendar, sheets, substituir_recorrencia, today: date):
        self.calendar = calendar
        self.sheets = sheets
        self.substituir = substituir_recorrencia
        self.today = today

    def _proximo_id(self) -> int:
        col_b = self.sheets.read("Controle!B:B")
        ids = []
        for row in col_b:
            if not row:
                continue
            v = parse_int_or_none(row[0])
            if v is not None:
                ids.append(v)
        return (max(ids) + 1) if ids else 1

    def executar(self, p: PedidoControle, *, calendario_rows: list[list]) -> dict:
        data_termino = compute_data_termino(calendario_rows, p.id)
        if not data_termino:
            raise ValueError(f"data_termino vazio pra id={p.id} (sem Presença na Calendario)")

        id_novo = self._proximo_id()
        sub = self.substituir(
            self.calendar,
            id_antigo=p.id,
            id_novo=id_novo,
            nome=p.nome,
            data_termino_dd_mm_yyyy=data_termino,
        )
        cor = str(sub.get("colorId") or "7")

        self.sheets.update(f"Controle!E{p.row}", [["finalizado"]], value_input_option="RAW")
        self.sheets.update(f"Controle!J{p.row}", [[data_termino]], value_input_option="RAW")
        self.sheets.update(f"Controle!K{p.row}", [["Automático"]], value_input_option="RAW")

        nova_row = [
            "",                              # A — ARRAYFORMULA
            id_novo,                         # B
            p.cpf or "",                     # C
            p.nome,                          # D
            "pendente",                      # E
            "",                              # F
            p.nome_filho or "",              # G
            "",                              # H
            data_termino,                    # I (inicio)
            "",                              # J (termino)
            "",                              # K (motivo)
            p.valor or "",                   # L
            "",                              # M — ARRAYFORMULA
            p.freq or "",                    # N
            p.plano or "",                   # O
            p.aulas_contratadas or "",       # P
            "",                              # Q removed (ARRAYFORMULA in Q is actually col S; staying conservative — Q via formula)
            "",                              # R
            "",                              # S — ARRAYFORMULA
        ]
        self.sheets.append("Controle!A:S", [nova_row], value_input_option="USER_ENTERED")

        hoje = self.today.strftime("%d/%m/%Y")
        log_row = [hoje, p.id, id_novo, "*", "*", "*", "*", cor, p.nome, ""]
        self.sheets.append("Logs!A:J", [log_row], value_input_option="RAW")

        return {
            "status": "OK",
            "id_antigo": p.id,
            "id_novo": id_novo,
            "data_termino": data_termino,
            "colorId": cor,
            "newEventId": sub.get("newEventId"),
            "masters": sub.get("masters", []),
        }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/unit/test_grupo_a.py -v`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add finalizer-skatedreams/src/finalizer/domain/grupo_a.py finalizer-skatedreams/tests/unit/test_grupo_a.py
git commit -m "feat(finalizer): GrupoAExecutor (substituir + Controle + Logs)"
```

---

## Task 14: Grupo B + C report (no exec)

**Files:**
- Create: `finalizer-skatedreams/src/finalizer/domain/grupo_b.py`
- Create: `finalizer-skatedreams/src/finalizer/domain/grupo_c.py`
- Test: `finalizer-skatedreams/tests/unit/test_grupo_b_c.py`

- [ ] **Step 1: Write the failing test**

Write `finalizer-skatedreams/tests/unit/test_grupo_b_c.py`:
```python
from finalizer.domain.grupo_b import propor_grupo_b
from finalizer.domain.grupo_c import diagnosticar_grupo_c
from finalizer.domain.models import PedidoControle


def _ped(**kwargs):
    base = {"row": 5, "id": 105, "nome": "Aluno", "situacao": "ativo",
            "aulas_contratadas": 4, "aulas_realizadas_agenda": 5, "aulas_restantes": -1,
            "aulas_realizadas_estatico": 0}
    base.update(kwargs)
    return PedidoControle(**base)


def test_grupo_b_propose_honest_mode():
    p = _ped()
    calendario = [
        ["X|id:105", "7", "01/04/2026 10:00", "01/04/2026 11:00", "", "Presença", "105", "", "", "", ""],
        ["X|id:105", "7", "08/04/2026 10:00", "08/04/2026 11:00", "", "Presença", "105", "", "", "", ""],
        ["X|id:105", "7", "15/04/2026 10:00", "15/04/2026 11:00", "", "Presença", "105", "", "", "", ""],
        ["X|id:105", "7", "22/04/2026 10:00", "22/04/2026 11:00", "", "Presença", "105", "", "", "", ""],
        ["X|id:105", "7", "29/04/2026 10:00", "29/04/2026 11:00", "", "Presença", "105", "", "", "", ""],
    ]
    proposta = propor_grupo_b(p, calendario)
    assert proposta["excesso"] == 1
    assert proposta["datas_mover"] == ["29/04/2026"]
    assert proposta["data_corte"] == "22/04/2026"


def test_grupo_c_subcaso_1():
    p = _ped(aulas_restantes=1, termino="17/04/2026", motivo_termino="Automático")
    d = diagnosticar_grupo_c(p)
    assert d["subcaso"] == "1"


def test_grupo_c_subcaso_2():
    p = _ped(situacao="ativo", termino="", motivo_termino="Automático")
    d = diagnosticar_grupo_c(p)
    assert d["subcaso"] == "2"


def test_grupo_c_subcaso_3():
    p = _ped(situacao="pendente", termino="", motivo_termino="Automático", aulas_restantes=None)
    d = diagnosticar_grupo_c(p)
    assert d["subcaso"] == "3"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/unit/test_grupo_b_c.py -v`
Expected: ImportError.

- [ ] **Step 3: Implement grupo_b.py and grupo_c.py**

Write `finalizer-skatedreams/src/finalizer/domain/grupo_b.py`:
```python
"""Propose honest-mode plan for estourados — report only, no exec."""

from finalizer.domain.models import PedidoControle, parse_int_or_none


def propor_grupo_b(p: PedidoControle, calendario_rows: list[list]) -> dict:
    P = p.aulas_contratadas or 0
    Q = p.aulas_realizadas_agenda or 0
    R = p.aulas_realizadas_estatico or 0
    S = (p.aulas_restantes if p.aulas_restantes is not None else (P - Q))
    excesso = -S if S < 0 else 0

    presencas: list[str] = []
    for row in calendario_rows:
        if len(row) < 11:
            row = list(row) + [""] * (11 - len(row))
        if parse_int_or_none(row[6]) != p.id:
            continue
        if str(row[5] or "").strip() != "Presença":
            continue
        inicio = str(row[2] or "").split(" ")[0]
        if "/" in inicio:
            presencas.append(inicio)
    presencas.sort(key=lambda s: tuple(reversed(s.split("/"))))

    datas_mover = presencas[-excesso:] if excesso > 0 else []
    data_corte = presencas[-(excesso + 1)] if excesso > 0 and len(presencas) > excesso else None

    return {
        "id_antigo": p.id,
        "nome": p.nome,
        "row": p.row,
        "P": P, "Q": Q, "R": R, "S": S,
        "excesso": excesso,
        "datas_mover": datas_mover,
        "data_corte": data_corte,
    }
```

Write `finalizer-skatedreams/src/finalizer/domain/grupo_c.py`:
```python
"""Diagnose intermediate states — report only."""

from finalizer.domain.models import PedidoControle


def diagnosticar_grupo_c(p: PedidoControle) -> dict:
    sit = (p.situacao or "").lower()
    has_termino = bool((p.termino or "").strip())
    has_motivo = bool((p.motivo_termino or "").strip())

    if sit == "pendente" and has_motivo:
        subcaso = "3"
        proposta = f"updateGoogleSheet Controle!K{p.row} = '' (RAW)"
    elif sit in ("ativo", "Ativo".lower()) and has_termino and has_motivo == "Automático":
        subcaso = "1"
        proposta = "Inspecionar Calendar (aulas futuras?) → completar ou reverter"
    elif sit in ("ativo", "Ativo".lower()) and has_termino:
        subcaso = "1"
        proposta = "Inspecionar Calendar (aulas futuras?) → completar ou reverter"
    elif sit in ("ativo", "Ativo".lower()) and not has_termino and has_motivo:
        subcaso = "2"
        proposta = f"updateGoogleSheet Controle!K{p.row} = '' (RAW)"
    else:
        subcaso = "4"
        proposta = "Apresentar dado completo pra decisão humana"

    return {
        "id": p.id, "row": p.row, "nome": p.nome,
        "situacao": p.situacao, "termino": p.termino, "motivo_termino": p.motivo_termino,
        "subcaso": subcaso, "proposta": proposta,
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/unit/test_grupo_b_c.py -v`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add finalizer-skatedreams/src/finalizer/domain/grupo_b.py finalizer-skatedreams/src/finalizer/domain/grupo_c.py finalizer-skatedreams/tests/unit/test_grupo_b_c.py
git commit -m "feat(finalizer): grupo_b (estourados) e grupo_c (estados) — report only"
```

---

## Task 15: W3 validation

**Files:**
- Create: `finalizer-skatedreams/src/finalizer/validacao/__init__.py`
- Create: `finalizer-skatedreams/src/finalizer/validacao/w3.py`
- Test: `finalizer-skatedreams/tests/unit/test_w3.py`

- [ ] **Step 1: Write the failing test**

Write `finalizer-skatedreams/tests/unit/test_w3.py`:
```python
from datetime import date, datetime
from unittest.mock import MagicMock

from finalizer.domain.models import LogRow, PedidoControle
from finalizer.validacao.w3 import validar


def _log(id_antigo, id_novo, days_ago=1):
    return LogRow(
        data=f"{(date(2026,5,24)).strftime('%d/%m/%Y')}", id_antigo=id_antigo, id_novo=id_novo,
        pedido_finalizado="*", pedido_novo_criado="*",
        agenda_recorrente_antiga_finalizada="*", agenda_recorrente_nova_criada="*",
        cor_atribuida="7", nome="X",
    )


def _ped(id, situacao):
    return PedidoControle(row=10, id=id, nome="X", situacao=situacao)


def test_valida_ok_quando_antigo_finalizado_novo_existe_sem_futuros():
    cal = MagicMock()
    cal.list_events.return_value = []
    pedidos = [_ped(1, "finalizado"), _ped(2, "pendente")]
    logs = [_log(1, 2)]
    issues = validar(cal, pedidos=pedidos, logs=logs, today=date(2026, 5, 24))
    assert issues == []


def test_issue_antigo_nao_finalizado():
    cal = MagicMock()
    cal.list_events.return_value = []
    pedidos = [_ped(1, "ativo"), _ped(2, "pendente")]
    logs = [_log(1, 2)]
    issues = validar(cal, pedidos=pedidos, logs=logs, today=date(2026, 5, 24))
    assert any("não finalizado" in i["motivo"].lower() for i in issues)


def test_issue_novo_id_nao_existe():
    cal = MagicMock()
    cal.list_events.return_value = []
    pedidos = [_ped(1, "finalizado")]
    logs = [_log(1, 99)]
    issues = validar(cal, pedidos=pedidos, logs=logs, today=date(2026, 5, 24))
    assert any("id novo 99" in i["motivo"].lower() for i in issues)


def test_issue_eventos_futuros_do_antigo():
    cal = MagicMock()
    cal.list_events.return_value = [{"id": "x", "status": "confirmed", "start": {"dateTime": "2026-06-01T10:00:00-03:00"}}]
    pedidos = [_ped(1, "finalizado"), _ped(2, "pendente")]
    logs = [_log(1, 2)]
    issues = validar(cal, pedidos=pedidos, logs=logs, today=date(2026, 5, 24))
    assert any("evento futuro" in i["motivo"].lower() for i in issues)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/unit/test_w3.py -v`
Expected: ImportError.

- [ ] **Step 3: Implement w3.py**

Write `finalizer-skatedreams/src/finalizer/validacao/__init__.py` (empty).

Write `finalizer-skatedreams/src/finalizer/validacao/w3.py`:
```python
"""W3 — validate Controle ↔ Calendar ↔ Logs cross-consistency for recent transitions."""

from datetime import date, datetime, timedelta

from finalizer.domain.models import LogRow, PedidoControle


def _parse_dmy(s: str) -> date | None:
    try:
        d, m, y = s.split("/")
        return date(int(y), int(m), int(d))
    except (ValueError, AttributeError):
        return None


def validar(
    calendar,
    *,
    pedidos: list[PedidoControle],
    logs: list[LogRow],
    today: date,
    janela_dias: int = 7,
) -> list[dict]:
    issues: list[dict] = []
    pedidos_by_id = {p.id: p for p in pedidos}
    janela_inicio = today - timedelta(days=janela_dias)

    for log in logs:
        log_date = _parse_dmy(log.data)
        if log_date is None or log_date < janela_inicio:
            continue

        ped_antigo = pedidos_by_id.get(log.id_antigo)
        if ped_antigo is None:
            issues.append({
                "id_antigo": log.id_antigo, "id_novo": log.id_novo,
                "motivo": f"Pedido antigo {log.id_antigo} não encontrado em Controle",
            })
        elif ped_antigo.situacao.lower() != "finalizado":
            issues.append({
                "id_antigo": log.id_antigo, "id_novo": log.id_novo,
                "motivo": f"Pedido antigo {log.id_antigo} não finalizado (situacao={ped_antigo.situacao})",
            })

        if log.id_novo not in pedidos_by_id:
            issues.append({
                "id_antigo": log.id_antigo, "id_novo": log.id_novo,
                "motivo": f"Id novo {log.id_novo} não existe em Controle",
            })

        time_min = today.isoformat() + "T00:00:00Z"
        eventos_futuros = calendar.list_events(
            query=f"id: {log.id_antigo}", time_min=time_min, time_max="2027-12-31T00:00:00Z",
        )
        confirmados = [e for e in eventos_futuros if e.get("status") == "confirmed"]
        if confirmados:
            issues.append({
                "id_antigo": log.id_antigo, "id_novo": log.id_novo,
                "motivo": f"Evento futuro confirmado do id antigo {log.id_antigo} (esperado vazio)",
                "exemplos": [e.get("id") for e in confirmados[:3]],
            })

    return issues
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/unit/test_w3.py -v`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add finalizer-skatedreams/src/finalizer/validacao/ finalizer-skatedreams/tests/unit/test_w3.py
git commit -m "feat(finalizer): validação W3 (Controle ↔ Calendar ↔ Logs)"
```

---

## Task 16: Apps Script sync trigger

**Files:**
- Create: `finalizer-skatedreams/src/finalizer/sync.py`
- Test: `finalizer-skatedreams/tests/unit/test_sync.py`

- [ ] **Step 1: Write the failing test**

Write `finalizer-skatedreams/tests/unit/test_sync.py`:
```python
import pytest
import respx
from httpx import Response

from finalizer.sync import dispara_sync, SyncError


@pytest.mark.asyncio
@respx.mock
async def test_sync_ok():
    url = "https://script.google.com/macros/s/x/exec"
    respx.get(url).mock(return_value=Response(200, text="OK"))
    await dispara_sync(url, "tok")


@pytest.mark.asyncio
@respx.mock
async def test_sync_forbidden_raises():
    url = "https://script.google.com/macros/s/x/exec"
    respx.get(url).mock(return_value=Response(200, text="forbidden"))
    with pytest.raises(SyncError):
        await dispara_sync(url, "tok")


@pytest.mark.asyncio
@respx.mock
async def test_sync_error_raises():
    url = "https://script.google.com/macros/s/x/exec"
    respx.get(url).mock(return_value=Response(200, text="error: boom"))
    with pytest.raises(SyncError):
        await dispara_sync(url, "tok")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/unit/test_sync.py -v`
Expected: ImportError.

- [ ] **Step 3: Implement sync.py**

Write `finalizer-skatedreams/src/finalizer/sync.py`:
```python
"""Trigger the Apps Script `puxar_calendario()` web app webhook."""

import httpx


class SyncError(Exception):
    pass


async def dispara_sync(url: str, token: str, timeout_seconds: int = 120) -> None:
    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        r = await client.get(url, params={"token": token})
    body = r.text.strip()
    if body == "OK":
        return
    raise SyncError(f"Apps Script returned: {body!r}")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/unit/test_sync.py -v`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add finalizer-skatedreams/src/finalizer/sync.py finalizer-skatedreams/tests/unit/test_sync.py
git commit -m "feat(finalizer): dispara_sync (Apps Script webhook)"
```

---

## Task 17: Pipeline orchestrator

**Files:**
- Create: `finalizer-skatedreams/src/finalizer/pipeline.py`
- Test: `finalizer-skatedreams/tests/integration/test_pipeline.py`

- [ ] **Step 1: Write the failing test**

Write `finalizer-skatedreams/tests/integration/test_pipeline.py`:
```python
from datetime import date
from unittest.mock import AsyncMock, MagicMock

import pytest

from finalizer.pipeline import Pipeline, CicloReport


@pytest.fixture
def fake_controle_rows():
    # row 1 = header
    return [
        ["contador", "id", "cpf", "nome", "situacao", "cancelado_em", "nome_filho", "obs",
         "inicio", "termino", "motivo", "valor", "valor_aula", "freq", "plano", "P", "R", "extra", "Q", "S"],
        # zerado (Grupo A)
        ["1", "105", "111", "Leandro", "ativo", "", "", "", "01/04/2026", "", "", "1200", "100", "1x", "Mensal", "12", "0", "", "12", "0"],
        # estourado (Grupo B)
        ["1", "200", "222", "Lilian", "ativo", "", "", "", "01/04/2026", "", "", "400", "100", "1x", "Mensal", "4", "0", "", "5", "-1"],
        # intermediário (Grupo C)
        ["1", "300", "333", "Renata", "ativo", "", "", "", "01/04/2026", "", "Automático", "1200", "100", "1x", "Mensal", "12", "0", "", "5", "7"],
        # OK (não classificável)
        ["1", "400", "444", "OK", "ativo", "", "", "", "01/04/2026", "", "", "1200", "100", "1x", "Mensal", "12", "0", "", "5", "7"],
    ]


@pytest.fixture
def fake_calendario_rows():
    return [
        ["L|id:105", "7", "01/04/2026 10:00", "01/04/2026 11:00", "", "Presença", "105", "", "", "", ""],
        ["L|id:105", "7", "13/05/2026 10:00", "13/05/2026 11:00", "", "Presença", "105", "", "", "", ""],
        ["Li|id:200", "7", "01/04/2026 10:00", "01/04/2026 11:00", "", "Presença", "200", "", "", "", ""],
        ["Li|id:200", "7", "08/04/2026 10:00", "08/04/2026 11:00", "", "Presença", "200", "", "", "", ""],
    ]


@pytest.mark.asyncio
async def test_pipeline_aplica_grupo_a_e_reporta_b_c(fake_controle_rows, fake_calendario_rows):
    sheets = MagicMock()
    # read calls:
    sheets.read.side_effect = [
        fake_controle_rows,      # Controle!A:S
        fake_calendario_rows,    # Calendario!A:K
        [["data"]],              # Logs!A:J
        [["id"], ["105"], ["200"], ["300"], ["400"]],  # B:B for id_novo
        # re-snapshot after applying:
        fake_controle_rows,
        fake_calendario_rows,
        [["data"]],
    ]
    calendar = MagicMock()
    substituir = MagicMock(return_value={"status": "OK", "colorId": "7", "newEventId": "n1", "masters": []})
    sync = AsyncMock()
    pipe = Pipeline(
        calendar=calendar, sheets=sheets,
        substituir_recorrencia=substituir, dispara_sync=sync,
        max_grupo_a=50, dry_run=False, today=date(2026, 5, 24),
    )
    report: CicloReport = await pipe.run_ciclo()

    assert len(report.grupo_a_aplicados) == 1
    assert report.grupo_a_aplicados[0]["id_antigo"] == 105
    assert len(report.grupo_b_pendente) == 1
    assert report.grupo_b_pendente[0]["id_antigo"] == 200
    assert len(report.grupo_c_pendente) == 1
    assert report.grupo_c_pendente[0]["id"] == 300
    sync.assert_called_once()


@pytest.mark.asyncio
async def test_pipeline_dry_run_nao_aplica(fake_controle_rows, fake_calendario_rows):
    sheets = MagicMock()
    sheets.read.side_effect = [
        fake_controle_rows, fake_calendario_rows, [["data"]],
        [["id"], ["105"]],
        fake_controle_rows, fake_calendario_rows, [["data"]],
    ]
    calendar = MagicMock()
    substituir = MagicMock()
    sync = AsyncMock()
    pipe = Pipeline(
        calendar=calendar, sheets=sheets,
        substituir_recorrencia=substituir, dispara_sync=sync,
        max_grupo_a=50, dry_run=True, today=date(2026, 5, 24),
    )
    report = await pipe.run_ciclo()
    substituir.assert_not_called()
    sync.assert_not_called()
    # Dry run still classifies and reports
    assert len(report.grupo_a_aplicados) == 0
    assert len(report.grupo_a_candidatos_dry_run) == 1


@pytest.mark.asyncio
async def test_pipeline_sentinela_aborta(fake_controle_rows, fake_calendario_rows):
    big_rows = fake_controle_rows[:1] + fake_controle_rows[1:2] * 60   # 60 zerados
    sheets = MagicMock()
    sheets.read.side_effect = [big_rows, fake_calendario_rows, [["data"]]]
    pipe = Pipeline(
        calendar=MagicMock(), sheets=sheets,
        substituir_recorrencia=MagicMock(), dispara_sync=AsyncMock(),
        max_grupo_a=50, dry_run=False, today=date(2026, 5, 24),
    )
    report = await pipe.run_ciclo()
    assert report.abortado_por_sentinela is True
    assert report.grupo_a_aplicados == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/integration/test_pipeline.py -v`
Expected: ImportError.

- [ ] **Step 3: Implement pipeline.py**

Write `finalizer-skatedreams/src/finalizer/pipeline.py`:
```python
"""Orchestrate one reconciliation cycle."""

import asyncio
import logging
from dataclasses import asdict, dataclass, field
from datetime import date, datetime
from typing import Any, Awaitable, Callable

import structlog

from finalizer.domain.classifier import classificar
from finalizer.domain.grupo_a import GrupoAExecutor
from finalizer.domain.grupo_b import propor_grupo_b
from finalizer.domain.grupo_c import diagnosticar_grupo_c
from finalizer.domain.models import LogRow, PedidoControle
from finalizer.validacao.w3 import validar as validar_w3

log = structlog.get_logger("finalizer.pipeline")


@dataclass
class CicloReport:
    inicio: datetime
    fim: datetime | None = None
    duracao_s: float | None = None
    dry_run: bool = False
    abortado_por_sentinela: bool = False
    grupo_a_aplicados: list[dict] = field(default_factory=list)
    grupo_a_falhas: list[dict] = field(default_factory=list)
    grupo_a_candidatos_dry_run: list[dict] = field(default_factory=list)
    grupo_b_pendente: list[dict] = field(default_factory=list)
    grupo_c_pendente: list[dict] = field(default_factory=list)
    w3_issues: list[dict] = field(default_factory=list)
    normalizacoes_aplicadas: int = 0

    def has_pendencias(self) -> bool:
        return bool(self.grupo_b_pendente or self.grupo_c_pendente or self.w3_issues or self.grupo_a_falhas)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class Pipeline:
    def __init__(
        self,
        *,
        calendar,
        sheets,
        substituir_recorrencia: Callable,
        dispara_sync: Callable[[], Awaitable[None]] | Callable[..., Awaitable[None]],
        max_grupo_a: int,
        dry_run: bool,
        today: date,
    ):
        self.calendar = calendar
        self.sheets = sheets
        self.substituir = substituir_recorrencia
        self.dispara_sync = dispara_sync
        self.max_grupo_a = max_grupo_a
        self.dry_run = dry_run
        self.today = today
        self.last_report: CicloReport | None = None
        self.last_run_at: datetime | None = None
        self._lock = asyncio.Lock()

    async def run_ciclo(self) -> CicloReport:
        async with self._lock:
            report = CicloReport(inicio=datetime.now(), dry_run=self.dry_run)
            log.info("ciclo_inicio", dry_run=self.dry_run)
            try:
                pedidos, calendario, logs = self._snapshot()
                cls = classificar(pedidos)
                log.info(
                    "classificacao",
                    grupo_a=len(cls.grupo_a_auto),
                    grupo_b=len(cls.grupo_b_report),
                    grupo_c=len(cls.grupo_c_report),
                    normalizacoes_e=len(cls.normalizacoes_e),
                )

                if len(cls.grupo_a_auto) > self.max_grupo_a:
                    log.error("sentinela_disparada", count=len(cls.grupo_a_auto), max=self.max_grupo_a)
                    report.abortado_por_sentinela = True
                    return self._finalize(report)

                if not self.dry_run:
                    for row in cls.normalizacoes_e:
                        self.sheets.update(f"Controle!E{row}", [["ativo"]], value_input_option="RAW")
                        report.normalizacoes_aplicadas += 1

                if self.dry_run:
                    for p in cls.grupo_a_auto:
                        report.grupo_a_candidatos_dry_run.append({
                            "id_antigo": p.id, "nome": p.nome, "row": p.row,
                        })
                else:
                    executor = GrupoAExecutor(
                        calendar=self.calendar,
                        sheets=self.sheets,
                        substituir_recorrencia=self.substituir,
                        today=self.today,
                    )
                    for p in cls.grupo_a_auto:
                        try:
                            result = executor.executar(p, calendario_rows=calendario)
                            report.grupo_a_aplicados.append(result)
                            log.info("grupo_a_aplicado", **{k: result.get(k) for k in ("id_antigo", "id_novo", "data_termino")})
                        except Exception as e:
                            report.grupo_a_falhas.append({"id_antigo": p.id, "nome": p.nome, "erro": str(e)})
                            log.error("grupo_a_falha", id_antigo=p.id, erro=str(e))

                for p in cls.grupo_b_report:
                    report.grupo_b_pendente.append(propor_grupo_b(p, calendario))
                for p in cls.grupo_c_report:
                    report.grupo_c_pendente.append(diagnosticar_grupo_c(p))

                if not self.dry_run and (report.grupo_a_aplicados or report.normalizacoes_aplicadas):
                    try:
                        await self.dispara_sync()
                        # Re-snapshot for W3
                        pedidos_pos, _, logs_pos = self._snapshot()
                        report.w3_issues = validar_w3(self.calendar, pedidos=pedidos_pos, logs=logs_pos, today=self.today)
                    except Exception as e:
                        log.error("sync_ou_w3_falhou", erro=str(e))
                        report.w3_issues.append({"motivo": f"Sync/W3 falhou: {e}"})

                return self._finalize(report)
            except Exception as e:
                log.exception("ciclo_erro_fatal", erro=str(e))
                report.w3_issues.append({"motivo": f"Erro fatal no ciclo: {e}"})
                return self._finalize(report)

    def _snapshot(self) -> tuple[list[PedidoControle], list[list], list[LogRow]]:
        controle_raw = self.sheets.read("Controle!A:S")
        calendario_raw = self.sheets.read("Calendario!A:K")
        logs_raw = self.sheets.read("Logs!A:J")

        pedidos = []
        for idx, row in enumerate(controle_raw[1:], start=2):  # start=2 (header is row 1)
            try:
                pedidos.append(PedidoControle.from_row(row, idx))
            except (ValueError, Exception) as e:
                log.warning("pedido_invalido", row=idx, erro=str(e))

        logs = []
        for row in logs_raw[1:]:  # skip header
            try:
                logs.append(LogRow.from_row(row))
            except Exception:
                continue

        return pedidos, calendario_raw, logs

    def _finalize(self, report: CicloReport) -> CicloReport:
        report.fim = datetime.now()
        report.duracao_s = (report.fim - report.inicio).total_seconds()
        log.info(
            "ciclo_fim",
            duracao_s=report.duracao_s,
            grupo_a_aplicados=len(report.grupo_a_aplicados),
            grupo_a_falhas=len(report.grupo_a_falhas),
            grupo_b=len(report.grupo_b_pendente),
            grupo_c=len(report.grupo_c_pendente),
            w3_issues=len(report.w3_issues),
        )
        self.last_report = report
        self.last_run_at = report.fim
        return report
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/integration/test_pipeline.py -v`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add finalizer-skatedreams/src/finalizer/pipeline.py finalizer-skatedreams/tests/integration/test_pipeline.py
git commit -m "feat(finalizer): Pipeline orquestrador (1 ciclo idempotente)"
```

---

## Task 18: HTTP routes (FastAPI)

**Files:**
- Create: `finalizer-skatedreams/src/finalizer/http/__init__.py`
- Create: `finalizer-skatedreams/src/finalizer/http/routes.py`
- Test: `finalizer-skatedreams/tests/integration/test_http.py`

- [ ] **Step 1: Write the failing test**

Write `finalizer-skatedreams/tests/integration/test_http.py`:
```python
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/integration/test_http.py -v`
Expected: ImportError.

- [ ] **Step 3: Implement routes.py**

Write `finalizer-skatedreams/src/finalizer/http/__init__.py` (empty).

Write `finalizer-skatedreams/src/finalizer/http/routes.py`:
```python
"""HTTP routes for the finalizer service."""

from fastapi import APIRouter, Depends, Header, HTTPException, status


def build_router(pipeline, *, api_token: str) -> APIRouter:
    router = APIRouter()

    def require_token(x_finalizer_token: str | None = Header(default=None)):
        if not x_finalizer_token or x_finalizer_token != api_token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    @router.get("/health")
    async def health():
        return {"status": "ok"}

    @router.get("/status", dependencies=[Depends(require_token)])
    async def get_status():
        rep = pipeline.last_report
        return {
            "last_run_at": pipeline.last_run_at.isoformat() if pipeline.last_run_at else None,
            "report": rep.to_dict() if rep else None,
        }

    @router.post("/run", dependencies=[Depends(require_token)])
    async def run():
        report = await pipeline.run_ciclo()
        return {"status": "ok", "report": report.to_dict()}

    return router
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/integration/test_http.py -v`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add finalizer-skatedreams/src/finalizer/http/ finalizer-skatedreams/tests/integration/test_http.py
git commit -m "feat(finalizer): HTTP routes /health /status /run com auth"
```

---

## Task 19: main.py boot (FastAPI lifespan + APScheduler)

**Files:**
- Create: `finalizer-skatedreams/src/finalizer/main.py`
- Test: `finalizer-skatedreams/tests/integration/test_main_boot.py`

- [ ] **Step 1: Write the failing test**

Write `finalizer-skatedreams/tests/integration/test_main_boot.py`:
```python
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
    # Patch build_credentials to avoid loading the fake private key
    from finalizer import main
    monkeypatch.setattr(main, "build_credentials", lambda b64, scopes: object())
    monkeypatch.setattr(main, "build", lambda service, version, credentials, cache_discovery=False: object())
    app = main.create_app()
    client = TestClient(app)
    r = client.get("/health")
    assert r.status_code == 200
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/integration/test_main_boot.py -v`
Expected: ImportError or AttributeError.

- [ ] **Step 3: Implement main.py**

Write `finalizer-skatedreams/src/finalizer/main.py`:
```python
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


app = None


def main():
    global app
    app = create_app()
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/integration/test_main_boot.py -v`
Expected: 1 passed.

- [ ] **Step 5: Run full suite**

Run: `uv run pytest -v`
Expected: All previous tests still pass.

- [ ] **Step 6: Commit**

```bash
git add finalizer-skatedreams/src/finalizer/main.py finalizer-skatedreams/tests/integration/test_main_boot.py
git commit -m "feat(finalizer): main.create_app — FastAPI + APScheduler lifespan"
```

---

## Task 20: Dockerfile multi-stage

**Files:**
- Create: `finalizer-skatedreams/docker/Dockerfile`
- Create: `finalizer-skatedreams/docker/entrypoint.sh`
- Create: `finalizer-skatedreams/.dockerignore`

- [ ] **Step 1: Write Dockerfile**

Write `finalizer-skatedreams/docker/Dockerfile`:
```dockerfile
# syntax=docker/dockerfile:1.7

FROM python:3.12-slim AS builder
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy

RUN pip install --no-cache-dir uv

WORKDIR /build
COPY pyproject.toml ./
COPY src ./src

RUN uv venv /opt/venv && \
    VIRTUAL_ENV=/opt/venv uv pip install --no-cache .

FROM python:3.12-slim AS runner
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PATH=/opt/venv/bin:$PATH

WORKDIR /app
COPY --from=builder /opt/venv /opt/venv
COPY src /app/src
COPY docker/entrypoint.sh /app/entrypoint.sh

RUN chmod +x /app/entrypoint.sh && \
    useradd --create-home --uid 1000 finalizer && \
    chown -R finalizer:finalizer /app
USER finalizer

ENV PYTHONPATH=/app/src
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health').read()" || exit 1

CMD ["/app/entrypoint.sh"]
```

- [ ] **Step 2: Write entrypoint.sh**

Write `finalizer-skatedreams/docker/entrypoint.sh`:
```bash
#!/bin/sh
set -e
exec uvicorn finalizer.main:create_app --factory --host 0.0.0.0 --port 8080 --log-config=/dev/null
```

- [ ] **Step 3: Write .dockerignore**

Write `finalizer-skatedreams/.dockerignore`:
```
.git
.venv
__pycache__
*.pyc
.pytest_cache
.ruff_cache
.coverage
htmlcov
tests
docs
docker/stack.env
docker/stack.deploy.yml
.env*
secrets
README.md
```

- [ ] **Step 4: Build image locally**

Run:
```bash
cd finalizer-skatedreams
docker build -f docker/Dockerfile -t finalizer:dev .
```
Expected: build succeeds.

- [ ] **Step 5: Run image with fake env to verify boot**

Run:
```bash
docker run --rm -d --name finalizer-dev -p 8080:8080 \
  -e GOOGLE_SERVICE_ACCOUNT_JSON="$(echo -n '{"type":"service_account","client_email":"x@x","private_key":"-----BEGIN PRIVATE KEY-----\nFAKE\n-----END PRIVATE KEY-----\n","token_uri":"https://oauth2.googleapis.com/token","project_id":"x"}' | base64 -w0)" \
  -e SHEETS_CONTROLE_ID=fake \
  -e APPS_SCRIPT_WEBHOOK_URL=https://x \
  -e APPS_SCRIPT_WEBHOOK_TOKEN=tk \
  -e FINALIZER_API_TOKEN=tok \
  finalizer:dev
sleep 3
curl -fsS http://localhost:8080/health
docker stop finalizer-dev
```
Expected: `{"status":"ok"}`.

- [ ] **Step 6: Commit**

```bash
git add finalizer-skatedreams/docker/Dockerfile finalizer-skatedreams/docker/entrypoint.sh finalizer-skatedreams/.dockerignore
git commit -m "chore(finalizer): Dockerfile multi-stage + entrypoint"
```

---

## Task 21: docker-compose.yml (dev) + stack.yml (Swarm)

**Files:**
- Create: `finalizer-skatedreams/docker/docker-compose.yml`
- Create: `finalizer-skatedreams/docker/stack.yml`
- Create: `finalizer-skatedreams/docker/stack.env.example`

- [ ] **Step 1: docker-compose.yml**

Write `finalizer-skatedreams/docker/docker-compose.yml`:
```yaml
version: "3.9"

services:
  finalizer:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    image: finalizer:dev
    ports:
      - "8080:8080"
    environment:
      GOOGLE_SERVICE_ACCOUNT_JSON: ${GOOGLE_SERVICE_ACCOUNT_JSON}
      GOOGLE_CALENDAR_ID: ${GOOGLE_CALENDAR_ID:-escolaskatedreams@gmail.com}
      SHEETS_CONTROLE_ID: ${SHEETS_CONTROLE_ID}
      APPS_SCRIPT_WEBHOOK_URL: ${APPS_SCRIPT_WEBHOOK_URL}
      APPS_SCRIPT_WEBHOOK_TOKEN: ${APPS_SCRIPT_WEBHOOK_TOKEN}
      FINALIZER_API_TOKEN: ${FINALIZER_API_TOKEN}
      FINALIZER_CRON_HOUR: ${FINALIZER_CRON_HOUR:-3}
      FINALIZER_TIMEZONE: ${FINALIZER_TIMEZONE:-America/Sao_Paulo}
      DRY_RUN: ${DRY_RUN:-true}
      LOG_LEVEL: ${LOG_LEVEL:-INFO}
```

- [ ] **Step 2: stack.yml (Swarm)**

Write `finalizer-skatedreams/docker/stack.yml`:
```yaml
version: "3.9"

# Stack do Swarm — template versionado.
# stack.deploy.yml (gitignored) é a cópia renderizada com segredos.
#
# Variáveis esperadas:
#   REGISTRY, TAG, FINALIZER_HOST, TRAEFIK_CERT_RESOLVER
#   GOOGLE_SERVICE_ACCOUNT_JSON (base64), GOOGLE_CALENDAR_ID
#   SHEETS_CONTROLE_ID
#   APPS_SCRIPT_WEBHOOK_URL, APPS_SCRIPT_WEBHOOK_TOKEN
#   FINALIZER_API_TOKEN

services:
  app:
    image: ${REGISTRY}/finalizer:${TAG:-latest}
    environment:
      GOOGLE_SERVICE_ACCOUNT_JSON: ${GOOGLE_SERVICE_ACCOUNT_JSON}
      GOOGLE_CALENDAR_ID: ${GOOGLE_CALENDAR_ID:-escolaskatedreams@gmail.com}
      SHEETS_CONTROLE_ID: ${SHEETS_CONTROLE_ID}
      APPS_SCRIPT_WEBHOOK_URL: ${APPS_SCRIPT_WEBHOOK_URL}
      APPS_SCRIPT_WEBHOOK_TOKEN: ${APPS_SCRIPT_WEBHOOK_TOKEN}
      FINALIZER_API_TOKEN: ${FINALIZER_API_TOKEN}
      FINALIZER_CRON_HOUR: ${FINALIZER_CRON_HOUR:-3}
      FINALIZER_CRON_MINUTE: ${FINALIZER_CRON_MINUTE:-0}
      FINALIZER_TIMEZONE: ${FINALIZER_TIMEZONE:-America/Sao_Paulo}
      DRY_RUN: ${DRY_RUN:-false}
      GRUPO_A_MAX_PER_CYCLE: ${GRUPO_A_MAX_PER_CYCLE:-50}
      LOG_LEVEL: ${LOG_LEVEL:-INFO}
    deploy:
      replicas: 1
      restart_policy:
        condition: on-failure
      labels:
        - "traefik.enable=true"
        - "traefik.docker.network=network_swarm_public"
        - "traefik.http.routers.finalizer.rule=Host(`${FINALIZER_HOST}`)"
        - "traefik.http.routers.finalizer.entrypoints=websecure"
        - "traefik.http.routers.finalizer.tls=true"
        - "traefik.http.routers.finalizer.tls.certresolver=${TRAEFIK_CERT_RESOLVER:-letsencryptresolver}"
        - "traefik.http.services.finalizer.loadbalancer.server.port=8080"
    networks: [network_swarm_public]

networks:
  network_swarm_public:
    external: true
    name: network_swarm_public
```

- [ ] **Step 3: stack.env.example**

Write `finalizer-skatedreams/docker/stack.env.example`:
```
REGISTRY=ghcr.io/escolaskatedreams
TAG=latest
FINALIZER_HOST=finalizer.skatedreams.com.br
TRAEFIK_CERT_RESOLVER=letsencryptresolver

GOOGLE_SERVICE_ACCOUNT_JSON=<base64 da JSON da SA>
GOOGLE_CALENDAR_ID=escolaskatedreams@gmail.com
SHEETS_CONTROLE_ID=1gGUc9eWNhcKXHaftG7xdsTV_exmz-DSWNXynYyJymwU

APPS_SCRIPT_WEBHOOK_URL=<URL do Web App do Apps Script>
APPS_SCRIPT_WEBHOOK_TOKEN=<token>

FINALIZER_API_TOKEN=<gerar com openssl rand -hex 32>
FINALIZER_CRON_HOUR=3
FINALIZER_CRON_MINUTE=0
FINALIZER_TIMEZONE=America/Sao_Paulo

DRY_RUN=false
GRUPO_A_MAX_PER_CYCLE=50
LOG_LEVEL=INFO
```

- [ ] **Step 4: Commit**

```bash
git add finalizer-skatedreams/docker/docker-compose.yml finalizer-skatedreams/docker/stack.yml finalizer-skatedreams/docker/stack.env.example
git commit -m "chore(finalizer): docker-compose (dev) + stack.yml (Swarm)"
```

---

## Task 22: GitHub Actions workflow

**Files:**
- Create: `.github/workflows/finalizer-build-and-deploy.yml`

- [ ] **Step 1: Write workflow**

Write `.github/workflows/finalizer-build-and-deploy.yml`:
```yaml
name: finalizer-build-and-deploy

on:
  push:
    branches: [main]
    tags: ["finalizer-v*"]
    paths:
      - "finalizer-skatedreams/**"
      - ".github/workflows/finalizer-build-and-deploy.yml"
  workflow_dispatch:

concurrency:
  group: finalizer-build-${{ github.ref }}
  cancel-in-progress: true

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository_owner }}/finalizer

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: astral-sh/setup-uv@v3
        with:
          enable-cache: true
      - name: Sync deps
        run: cd finalizer-skatedreams && uv sync --all-groups
      - name: Run tests
        run: cd finalizer-skatedreams && uv run pytest -v

  build:
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v6
      - uses: docker/setup-buildx-action@v4
      - uses: docker/login-action@v4
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - id: meta
        uses: docker/metadata-action@v6
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=sha,prefix=,format=short
            type=ref,event=branch
            type=raw,value=latest,enable={{is_default_branch}}
      - uses: docker/build-push-action@v7
        with:
          context: finalizer-skatedreams
          file: finalizer-skatedreams/docker/Dockerfile
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Notify Portainer to redeploy
        env:
          WEBHOOK: ${{ secrets.PORTAINER_FINALIZER_WEBHOOK_URL }}
        run: |
          if [ -z "$WEBHOOK" ]; then
            echo "PORTAINER_FINALIZER_WEBHOOK_URL secret não configurado — pulando."
            exit 0
          fi
          echo "Triggering Portainer webhook..."
          curl -fsS -X POST "$WEBHOOK"
          echo " ok"
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/finalizer-build-and-deploy.yml
git commit -m "ci(finalizer): GH Actions test+build+deploy via webhook Portainer"
```

---

## Task 23: README

**Files:**
- Create: `finalizer-skatedreams/README.md`

- [ ] **Step 1: Write README**

Write `finalizer-skatedreams/README.md`:
```markdown
# finalizer-skatedreams

Substitui o workflow n8n `Finalizacao de Perdidos Latest` (W2) e reabilita o `Check Automático` (W3), incorporando os fixes aprendidos em 2026-05-23/24.

## O que faz

Ciclo diário (03:00 BRT, configurável) que lê Controle 2026 + Calendar + Logs e:

- **Grupo A (zerados)** — `situacao=ativo` + `aulas_restantes=0`: encurta recorrência antiga (DELETE+INSERT preservando cores override), cria nova com `id` novo, atualiza Controle (`finalizado`, `Automático`) + Logs.
- **Grupo B (estourados)** — `S<0`: gera proposta de honest mode no report. Não executa.
- **Grupo C (estados intermediários)** — `motivo`/`termino` preenchidos sem finalização: diagnóstico do sub-caso no report. Não executa.
- **W3** — valida `Controle ↔ Calendar ↔ Logs` para transições dos últimos 7 dias; issues no report.

## Endpoints

- `GET /health` (sem auth) — liveness
- `GET /status` — último report (header `X-Finalizer-Token`)
- `POST /run` — dispara ciclo manualmente (mesmo header)

## Stack

Python 3.12, FastAPI + APScheduler, googleapiclient, structlog, pydantic v2, uv.

## Dev local

```bash
cd finalizer-skatedreams
uv sync --all-groups
cp docker/stack.env.example .env  # preencher
uv run uvicorn finalizer.main:create_app --factory --reload
```

Tests:
```bash
uv run pytest -v
```

## Deploy

- Imagem em `ghcr.io/escolaskatedreams/finalizer:latest`
- Stack Swarm `finalizer` no Portainer
- Domínio `finalizer.skatedreams.com.br` (Traefik label)

CI pipeline: push em `main` → `tests` → `docker build/push` → `webhook Portainer`.

## Pré-cutover (manual)

1. Compartilhar planilha Controle 2026 com SA `geral-google@automacoes-n8n-491322.iam.gserviceaccount.com` como **Editor**.
2. DNS `finalizer.skatedreams.com.br` → `178.156.235.107`.
3. Criar stack `finalizer` no Portainer com `docker/stack.deploy.yml` renderizado.
4. Configurar GitHub Secret `PORTAINER_FINALIZER_WEBHOOK_URL`.
5. Subir env vars no painel do Portainer (template em `docker/stack.env.example`).

## Cutover

1. `DRY_RUN=true` → 1° ciclo manual via `POST /run` → conferir report.
2. `DRY_RUN=false` → redeploy.
3. Desativar W2 do n8n (`Urgspel6dgvdAZ6n`).

Spec: `docs/superpowers/specs/2026-05-24-finalizer-skatedreams-design.md`.
```

- [ ] **Step 2: Commit**

```bash
git add finalizer-skatedreams/README.md
git commit -m "docs(finalizer): README com endpoints, dev local, cutover"
```

---

## Task 24: Final full test run + lint

- [ ] **Step 1: Run all tests**

Run:
```bash
cd finalizer-skatedreams && uv run pytest -v --tb=short
```
Expected: ALL passed. Note total count (~60+).

- [ ] **Step 2: Run ruff**

Run:
```bash
cd finalizer-skatedreams && uv run ruff check src tests
```
Expected: no errors. Fix any reported.

- [ ] **Step 3: Run ruff format check**

Run:
```bash
cd finalizer-skatedreams && uv run ruff format --check src tests
```
Fix with `uv run ruff format src tests` if needed.

- [ ] **Step 4: Commit any lint fixes**

```bash
git add -A finalizer-skatedreams/
git commit -m "chore(finalizer): lint pass (ruff)" --allow-empty
```

---

## Self-review checklist (executed after writing this plan)

- [x] Spec coverage: every section of `docs/superpowers/specs/2026-05-24-finalizer-skatedreams-design.md` mapped to a task above.
- [x] No placeholders: every step has exact code/commands.
- [x] Type consistency: `Pipeline.run_ciclo` async, `CicloReport` dataclass, `GrupoAExecutor.executar` sync, `dispara_sync` async — references match throughout.
- [x] TDD: every src module has a failing test → impl → pass cycle.
- [x] Bite-sized commits: 23 commits across tasks.
