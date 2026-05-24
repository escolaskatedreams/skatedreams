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
            params: dict[str, Any] = {
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
