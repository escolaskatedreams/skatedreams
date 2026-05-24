from datetime import datetime
from unittest.mock import MagicMock

from finalizer.operations.encurta_master import encurta_master


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
    calendar.patch_event.assert_any_call("newi1", {"colorId": "11"})


def test_encurta_master_sem_rrule():
    calendar = MagicMock()
    master = {"id": "m1", "summary": "x", "colorId": "7", "start": {}, "end": {}}
    result = encurta_master(calendar, master=master, eventos_do_id=[], cut_date=datetime(2026, 5, 1), pedido_id=12)
    assert result.acao == "SEM_RRULE"
