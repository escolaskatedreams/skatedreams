"""Service Account credential factory."""

import base64
import json

from google.oauth2 import service_account

CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events"
SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets"


def build_credentials(sa_json_b64: str, scopes: list[str]):
    sa_dict = json.loads(base64.b64decode(sa_json_b64))
    return service_account.Credentials.from_service_account_info(sa_dict, scopes=scopes)
