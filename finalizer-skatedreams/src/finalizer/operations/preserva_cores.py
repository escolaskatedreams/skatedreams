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
