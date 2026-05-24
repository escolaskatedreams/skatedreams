from datetime import datetime

from finalizer.operations.preserva_cores import mapear_overrides


def _evt(start_iso: str, color: str | None, rec_id: str = "master-1"):
    return {"start": {"dateTime": start_iso}, "colorId": color, "recurringEventId": rec_id, "status": "confirmed"}


def test_mapear_overrides_picks_diff_from_master():
    events = [
        _evt("2026-04-01T10:00:00-03:00", "7"),
        _evt("2026-04-08T10:00:00-03:00", "11"),
        _evt("2026-04-15T10:00:00-03:00", "4"),
    ]
    cut = datetime(2026, 5, 1)
    out = mapear_overrides(events, master_color="7", cut_date=cut, rec_id="master-1")
    assert out == {"2026-04-08": "11", "2026-04-15": "4"}


def test_mapear_overrides_skips_past_cut():
    events = [
        _evt("2026-04-08T10:00:00-03:00", "11"),
        _evt("2026-05-08T10:00:00-03:00", "11"),
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
