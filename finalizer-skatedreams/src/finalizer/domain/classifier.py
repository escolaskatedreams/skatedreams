"""Classify Controle rows into Grupo A (auto-finalize), B (estourados report), C (intermediate state)."""

from pydantic import BaseModel

from finalizer.domain.models import PedidoControle


class Classificacao(BaseModel):
    grupo_a_auto: list[PedidoControle]
    grupo_b_report: list[PedidoControle]
    grupo_c_report: list[PedidoControle]
    normalizacoes_e: list[int]


def classificar(pedidos: list[PedidoControle]) -> Classificacao:
    grupo_a, grupo_b, grupo_c = [], [], []
    norm_e = []
    in_a_or_b: set[int] = set()

    for p in pedidos:
        sit = (p.situacao or "").lower()
        if p.situacao == "Ativo":
            norm_e.append(p.row)
        restantes = p.aulas_restantes
        if sit == "ativo" and restantes is not None and restantes == 0:
            grupo_a.append(p)
            in_a_or_b.add(p.row)
        elif sit == "ativo" and restantes is not None and restantes < 0:
            grupo_b.append(p)
            in_a_or_b.add(p.row)

    for p in pedidos:
        sit = (p.situacao or "").lower()
        if p.row in in_a_or_b:
            continue
        if sit in ("ativo", "pendente") and ((p.motivo_termino or "").strip() or (p.termino or "").strip()):
            grupo_c.append(p)

    return Classificacao(
        grupo_a_auto=grupo_a,
        grupo_b_report=grupo_b,
        grupo_c_report=grupo_c,
        normalizacoes_e=norm_e,
    )
