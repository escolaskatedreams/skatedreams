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
