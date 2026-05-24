from datetime import date
from unittest.mock import MagicMock

from finalizer.domain.models import LogRow, PedidoControle
from finalizer.validacao.w3 import validar


def _log(id_antigo, id_novo):
    return LogRow(
        data=date(2026, 5, 24).strftime("%d/%m/%Y"), id_antigo=id_antigo, id_novo=id_novo,
        pedido_finalizado="*", pedido_novo_criado="*",
        agenda_recorrente_antiga_finalizada="*", agenda_recorrente_nova_criada="*",
        cor_atribuida="7", nome="X",
    )


def _ped(id, situacao):
    return PedidoControle(row=10, id=id, nome="X", situacao=situacao)


def test_valida_ok_quando_antigo_finalizado_novo_existe_sem_futuros():
    cal = MagicMock()
    cal.list_events.return_value = []
    pedidos = [_ped(1, "finalizado"), _ped(2, "pendente")]
    logs = [_log(1, 2)]
    issues = validar(cal, pedidos=pedidos, logs=logs, today=date(2026, 5, 24))
    assert issues == []


def test_issue_antigo_nao_finalizado():
    cal = MagicMock()
    cal.list_events.return_value = []
    pedidos = [_ped(1, "ativo"), _ped(2, "pendente")]
    logs = [_log(1, 2)]
    issues = validar(cal, pedidos=pedidos, logs=logs, today=date(2026, 5, 24))
    assert any("não finalizado" in i["motivo"].lower() for i in issues)


def test_issue_novo_id_nao_existe():
    cal = MagicMock()
    cal.list_events.return_value = []
    pedidos = [_ped(1, "finalizado")]
    logs = [_log(1, 99)]
    issues = validar(cal, pedidos=pedidos, logs=logs, today=date(2026, 5, 24))
    assert any("id novo 99" in i["motivo"].lower() for i in issues)


def test_issue_eventos_futuros_do_antigo():
    cal = MagicMock()
    cal.list_events.return_value = [{"id": "x", "status": "confirmed", "start": {"dateTime": "2026-06-01T10:00:00-03:00"}}]
    pedidos = [_ped(1, "finalizado"), _ped(2, "pendente")]
    logs = [_log(1, 2)]
    issues = validar(cal, pedidos=pedidos, logs=logs, today=date(2026, 5, 24))
    assert any("evento futuro" in i["motivo"].lower() for i in issues)
