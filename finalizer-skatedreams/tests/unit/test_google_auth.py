import base64
import json
from unittest.mock import patch

from finalizer.google.auth import CALENDAR_SCOPE, SHEETS_SCOPE, build_credentials


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
