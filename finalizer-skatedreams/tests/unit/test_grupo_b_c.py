from finalizer.domain.grupo_b import propor_grupo_b
from finalizer.domain.grupo_c import diagnosticar_grupo_c
from finalizer.domain.models import PedidoControle


def _ped(**kwargs):
    base = {"row": 5, "id": 105, "nome": "Aluno", "situacao": "ativo",
            "aulas_contratadas": 4, "aulas_realizadas_agenda": 5, "aulas_restantes": -1,
            "aulas_realizadas_estatico": 0}
    base.update(kwargs)
    return PedidoControle(**base)


def test_grupo_b_propose_honest_mode():
    p = _ped()
    calendario = [
        ["X|id:105", "7", "01/04/2026 10:00", "01/04/2026 11:00", "", "Presença", "105", "", "", "", ""],
        ["X|id:105", "7", "08/04/2026 10:00", "08/04/2026 11:00", "", "Presença", "105", "", "", "", ""],
        ["X|id:105", "7", "15/04/2026 10:00", "15/04/2026 11:00", "", "Presença", "105", "", "", "", ""],
        ["X|id:105", "7", "22/04/2026 10:00", "22/04/2026 11:00", "", "Presença", "105", "", "", "", ""],
        ["X|id:105", "7", "29/04/2026 10:00", "29/04/2026 11:00", "", "Presença", "105", "", "", "", ""],
    ]
    proposta = propor_grupo_b(p, calendario)
    assert proposta["excesso"] == 1
    assert proposta["datas_mover"] == ["29/04/2026"]
    assert proposta["data_corte"] == "22/04/2026"


def test_grupo_c_subcaso_1():
    p = _ped(aulas_restantes=1, termino="17/04/2026", motivo_termino="Automático")
    d = diagnosticar_grupo_c(p)
    assert d["subcaso"] == "1"


def test_grupo_c_subcaso_2():
    p = _ped(situacao="ativo", termino="", motivo_termino="Automático")
    d = diagnosticar_grupo_c(p)
    assert d["subcaso"] == "2"


def test_grupo_c_subcaso_3():
    p = _ped(situacao="pendente", termino="", motivo_termino="Automático", aulas_restantes=None)
    d = diagnosticar_grupo_c(p)
    assert d["subcaso"] == "3"
