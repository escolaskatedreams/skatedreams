from datetime import date
from unittest.mock import AsyncMock, MagicMock

import pytest

from finalizer.pipeline import CicloReport, Pipeline


@pytest.fixture
def fake_controle_rows():
    return [
        ["contador", "id", "cpf", "nome", "situacao", "cancelado_em", "nome_filho", "obs",
         "inicio", "termino", "motivo", "valor", "valor_aula", "freq", "plano", "P", "R", "extra", "Q", "S"],
        # zerado (Grupo A)
        ["1", "105", "111", "Leandro", "ativo", "", "", "", "01/04/2026", "", "", "1200", "100", "1x", "Mensal", "12", "0", "", "12", "0"],
        # estourado (Grupo B)
        ["1", "200", "222", "Lilian", "ativo", "", "", "", "01/04/2026", "", "", "400", "100", "1x", "Mensal", "4", "0", "", "5", "-1"],
        # intermediário (Grupo C)
        ["1", "300", "333", "Renata", "ativo", "", "", "", "01/04/2026", "", "Automático", "1200", "100", "1x", "Mensal", "12", "0", "", "5", "7"],
        # OK
        ["1", "400", "444", "OK", "ativo", "", "", "", "01/04/2026", "", "", "1200", "100", "1x", "Mensal", "12", "0", "", "5", "7"],
    ]


@pytest.fixture
def fake_calendario_rows():
    return [
        ["L|id:105", "7", "01/04/2026 10:00", "01/04/2026 11:00", "", "Presença", "105", "", "", "", ""],
        ["L|id:105", "7", "13/05/2026 10:00", "13/05/2026 11:00", "", "Presença", "105", "", "", "", ""],
        ["Li|id:200", "7", "01/04/2026 10:00", "01/04/2026 11:00", "", "Presença", "200", "", "", "", ""],
        ["Li|id:200", "7", "08/04/2026 10:00", "08/04/2026 11:00", "", "Presença", "200", "", "", "", ""],
    ]


@pytest.mark.asyncio
async def test_pipeline_aplica_grupo_a_e_reporta_b_c(fake_controle_rows, fake_calendario_rows):
    sheets = MagicMock()
    sheets.read.side_effect = [
        fake_controle_rows,
        fake_calendario_rows,
        [["data"]],
        [["id"], ["105"], ["200"], ["300"], ["400"]],
        fake_controle_rows,
        fake_calendario_rows,
        [["data"]],
    ]
    calendar = MagicMock()
    calendar.list_events.return_value = []
    substituir = MagicMock(return_value={"status": "OK", "colorId": "7", "newEventId": "n1", "masters": []})
    sync = AsyncMock()
    pipe = Pipeline(
        calendar=calendar, sheets=sheets,
        substituir_recorrencia=substituir, dispara_sync=sync,
        max_grupo_a=50, dry_run=False, today=date(2026, 5, 24),
    )
    report: CicloReport = await pipe.run_ciclo()

    assert len(report.grupo_a_aplicados) == 1
    assert report.grupo_a_aplicados[0]["id_antigo"] == 105
    assert len(report.grupo_b_pendente) == 1
    assert report.grupo_b_pendente[0]["id_antigo"] == 200
    assert len(report.grupo_c_pendente) == 1
    assert report.grupo_c_pendente[0]["id"] == 300
    sync.assert_called_once()


@pytest.mark.asyncio
async def test_pipeline_dry_run_nao_aplica(fake_controle_rows, fake_calendario_rows):
    sheets = MagicMock()
    sheets.read.side_effect = [
        fake_controle_rows, fake_calendario_rows, [["data"]],
    ]
    calendar = MagicMock()
    substituir = MagicMock()
    sync = AsyncMock()
    pipe = Pipeline(
        calendar=calendar, sheets=sheets,
        substituir_recorrencia=substituir, dispara_sync=sync,
        max_grupo_a=50, dry_run=True, today=date(2026, 5, 24),
    )
    report = await pipe.run_ciclo()
    substituir.assert_not_called()
    sync.assert_not_called()
    assert len(report.grupo_a_aplicados) == 0
    assert len(report.grupo_a_candidatos_dry_run) == 1


@pytest.mark.asyncio
async def test_pipeline_sentinela_aborta(fake_controle_rows, fake_calendario_rows):
    # 60 zerados (> max 50)
    big_rows = fake_controle_rows[:1] + [fake_controle_rows[1]] * 60
    sheets = MagicMock()
    sheets.read.side_effect = [big_rows, fake_calendario_rows, [["data"]]]
    pipe = Pipeline(
        calendar=MagicMock(), sheets=sheets,
        substituir_recorrencia=MagicMock(), dispara_sync=AsyncMock(),
        max_grupo_a=50, dry_run=False, today=date(2026, 5, 24),
    )
    report = await pipe.run_ciclo()
    assert report.abortado_por_sentinela is True
    assert report.grupo_a_aplicados == []
