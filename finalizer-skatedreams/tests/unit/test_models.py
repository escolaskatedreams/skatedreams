import pytest

from finalizer.domain.models import PedidoControle, parse_int_or_none


def test_parse_int_or_none():
    assert parse_int_or_none("5") == 5
    assert parse_int_or_none("") is None
    assert parse_int_or_none(None) is None
    assert parse_int_or_none("abc") is None
    assert parse_int_or_none("-3") == -3
    assert parse_int_or_none("12.0") == 12


def test_pedido_from_row():
    row = ["1", "100", "12345", "Aluno X", "ativo", "", "Filho Y", "obs", "01/04/2026", "", "", "1200", "100", "1x", "Mensal", "12", "0", "", "12", "0"]
    p = PedidoControle.from_row(row, 5)
    assert p.row == 5
    assert p.id == 100
    assert p.nome == "Aluno X"
    assert p.situacao == "ativo"
    assert p.aulas_contratadas == 12
    assert p.aulas_realizadas_agenda == 12
    assert p.aulas_restantes == 0


def test_pedido_from_row_short_row():
    row = ["1", "200", "12345", "Outro", "pendente"]
    p = PedidoControle.from_row(row, 8)
    assert p.id == 200
    assert p.nome == "Outro"
    assert p.aulas_contratadas is None
    assert p.aulas_restantes is None


def test_pedido_rejects_no_id():
    with pytest.raises(ValueError):
        PedidoControle.from_row(["1", "", "", "x", "ativo"], 3)
