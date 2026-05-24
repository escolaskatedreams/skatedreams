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
