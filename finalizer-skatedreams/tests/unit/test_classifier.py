from finalizer.domain.classifier import classificar
from finalizer.domain.models import PedidoControle


def _pedido(**kwargs):
    base = {"row": 2, "id": 1, "nome": "X", "situacao": "ativo"}
    base.update(kwargs)
    return PedidoControle(**base)


def test_classifica_grupo_a_zerados():
    pedidos = [
        _pedido(id=1, aulas_restantes=0, situacao="ativo"),
        _pedido(id=2, aulas_restantes=5, situacao="ativo"),
    ]
    c = classificar(pedidos)
    assert [p.id for p in c.grupo_a_auto] == [1]
    assert c.grupo_b_report == []


def test_classifica_grupo_b_estourados():
    pedidos = [
        _pedido(id=10, aulas_restantes=-2, situacao="ativo"),
        _pedido(id=11, aulas_restantes=-1, situacao="Ativo"),
    ]
    c = classificar(pedidos)
    # Ativo (maiúsculo) também conta como ativa pra classificação (case-insensitive)
    assert {p.id for p in c.grupo_b_report} == {10, 11}
    assert c.grupo_a_auto == []


def test_classifica_normalizacoes_e():
    pedidos = [
        _pedido(id=5, row=7, situacao="Ativo", aulas_restantes=3),
        _pedido(id=6, row=8, situacao="ativo", aulas_restantes=2),
    ]
    c = classificar(pedidos)
    assert c.normalizacoes_e == [7]


def test_classifica_grupo_c_intermediario():
    pedidos = [
        _pedido(id=20, situacao="ativo", aulas_restantes=5, motivo_termino="Automático"),
        _pedido(id=21, situacao="pendente", aulas_restantes=None, motivo_termino="Automático"),
        _pedido(id=22, situacao="ativo", aulas_restantes=5, termino="01/05/2026"),
    ]
    c = classificar(pedidos)
    assert {p.id for p in c.grupo_c_report} == {20, 21, 22}


def test_grupo_c_nao_inclui_grupo_a_ou_b():
    pedidos = [
        _pedido(id=1, situacao="ativo", aulas_restantes=0, motivo_termino="Automático"),
        _pedido(id=2, situacao="ativo", aulas_restantes=-1, motivo_termino="Automático"),
    ]
    c = classificar(pedidos)
    assert [p.id for p in c.grupo_a_auto] == [1]
    assert [p.id for p in c.grupo_b_report] == [2]
    assert c.grupo_c_report == []
