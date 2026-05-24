from unittest.mock import MagicMock

import pytest

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
        eventos,
        [{"id": "nm1", "recurringEventId": "m1-new", "status": "confirmed",
          "start": {"dateTime": "2026-04-08T10:00:00-03:00"}, "colorId": "7"}],
        [],
    ]
    calendar.get_event.return_value = master
    calendar.insert_event.side_effect = [
        {"id": "m1-new"},
        {"id": "novo-master"},
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
    assert calendar.insert_event.call_count == 1


def test_substituir_recorrencia_sem_passadas_raises():
    calendar = MagicMock()
    calendar.list_events.side_effect = [[]]
    with pytest.raises(ValueError, match="Sem aulas"):
        substituir_recorrencia(
            calendar,
            id_antigo=105, id_novo=427, nome="X",
            data_termino_dd_mm_yyyy="13/05/2026",
            sleep_after_insert=0,
        )
