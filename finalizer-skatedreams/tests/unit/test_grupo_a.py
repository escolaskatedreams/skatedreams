from datetime import date
from unittest.mock import MagicMock

import pytest

from finalizer.domain.grupo_a import GrupoAExecutor
from finalizer.domain.models import PedidoControle


def _ped(**kwargs):
    base = {"row": 5, "id": 105, "nome": "Leandro M Pinto", "situacao": "ativo",
            "aulas_contratadas": 12, "aulas_realizadas_agenda": 12, "aulas_restantes": 0,
            "valor": 1200, "freq": "1x", "plano": "Mensal", "nome_filho": "", "cpf": "123",
            "inicio": "01/04/2026"}
    base.update(kwargs)
    return PedidoControle(**base)


def test_executor_chama_substituir_e_escreve_sheets():
    calendar = MagicMock()
    sheets = MagicMock()
    substituir = MagicMock(return_value={"status": "OK", "colorId": "7", "newEventId": "new1", "masters": []})

    sheets.read.side_effect = [
        [["id"], ["1"], ["2"], ["105"]],
    ]
    calendario_rows = [
        ["Aluno | id: 105", "7", "01/04/2026 10:00", "01/04/2026 11:00", "", "Presença", "105", "", "Leandro", "100", "Carlos"],
        ["Aluno | id: 105", "7", "13/05/2026 10:00", "13/05/2026 11:00", "", "Presença", "105", "", "Leandro", "100", "Carlos"],
    ]
    pedido = _ped()

    executor = GrupoAExecutor(
        calendar=calendar,
        sheets=sheets,
        substituir_recorrencia=substituir,
        today=date(2026, 5, 24),
    )
    result = executor.executar(pedido, calendario_rows=calendario_rows)
    assert result["status"] == "OK"
    assert result["id_antigo"] == 105
    assert result["id_novo"] == 106
    assert result["data_termino"] == "13/05/2026"
    substituir.assert_called_once()

    assert sheets.update.call_count == 3
    sheets.update.assert_any_call("Controle!E5", [["finalizado"]], value_input_option="RAW")
    sheets.update.assert_any_call("Controle!J5", [["13/05/2026"]], value_input_option="RAW")
    sheets.update.assert_any_call("Controle!K5", [["Automático"]], value_input_option="RAW")

    assert sheets.append.call_count == 2
    controle_append = [c for c in sheets.append.call_args_list if c.args[0] == "Controle!A:S"][0]
    values = controle_append.args[1]
    assert len(values) == 1
    assert len(values[0]) == 19
    assert values[0][0] == ""
    assert values[0][1] == 106
    assert values[0][3] == "Leandro M Pinto"
    assert values[0][4] == "pendente"


def test_executor_aborta_sem_data_termino():
    calendar = MagicMock()
    sheets = MagicMock()
    sheets.read.return_value = [["id"], ["1"], ["105"]]
    substituir = MagicMock()
    executor = GrupoAExecutor(calendar=calendar, sheets=sheets, substituir_recorrencia=substituir, today=date(2026, 5, 24))
    pedido = _ped()
    with pytest.raises(ValueError, match="data_termino"):
        executor.executar(pedido, calendario_rows=[])
