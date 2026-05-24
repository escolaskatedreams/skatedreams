from unittest.mock import MagicMock

from finalizer.google.sheets import SheetsClient


def test_read_returns_values():
    api = MagicMock()
    api.spreadsheets().values().get().execute.return_value = {"values": [["a", "b"], ["c", "d"]]}
    c = SheetsClient(api, "sheet-id")
    assert c.read("Controle!A:S") == [["a", "b"], ["c", "d"]]


def test_read_empty():
    api = MagicMock()
    api.spreadsheets().values().get().execute.return_value = {}
    c = SheetsClient(api, "sheet-id")
    assert c.read("Controle!A:S") == []


def test_update_calls_api():
    api = MagicMock()
    api.spreadsheets().values().update().execute.return_value = {"updatedCells": 1}
    c = SheetsClient(api, "sheet-id")
    c.update("Controle!E5", [["finalizado"]], value_input_option="RAW")
    api.spreadsheets().values().update.assert_called_with(
        spreadsheetId="sheet-id", range="Controle!E5",
        valueInputOption="RAW", body={"values": [["finalizado"]]},
    )


def test_append_calls_api():
    api = MagicMock()
    api.spreadsheets().values().append().execute.return_value = {"updates": {"updatedRange": "Controle!A100"}}
    c = SheetsClient(api, "sheet-id")
    c.append("Controle!A:S", [["", "1", "x"]], value_input_option="USER_ENTERED")
    api.spreadsheets().values().append.assert_called_with(
        spreadsheetId="sheet-id", range="Controle!A:S",
        valueInputOption="USER_ENTERED", insertDataOption="INSERT_ROWS",
        body={"values": [["", "1", "x"]]},
    )
