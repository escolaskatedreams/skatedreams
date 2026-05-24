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


def test_insert_event_retries_on_429():
    api = MagicMock()
    err = HttpError(_make_resp(429), b"rate")
    api.events().insert().execute.side_effect = [err, err, {"id": "new"}]
    c = CalendarClient(api, "cal@x.com", retry_delays=[0, 0, 0])
    result = c.insert_event({"summary": "x"})
    assert result["id"] == "new"
    assert api.events().insert().execute.call_count == 3


def test_insert_event_no_retry_on_400():
    api = MagicMock()
    err = HttpError(_make_resp(400), b"bad")
    api.events().insert().execute.side_effect = err
    c = CalendarClient(api, "cal@x.com", retry_delays=[0, 0, 0])
    with pytest.raises(HttpError):
        c.insert_event({"summary": "x"})
    assert api.events().insert().execute.call_count == 1
