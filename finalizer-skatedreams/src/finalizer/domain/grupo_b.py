"""Propose honest-mode plan for estourados — report only, no exec."""

from finalizer.domain.models import PedidoControle, parse_int_or_none


def propor_grupo_b(p: PedidoControle, calendario_rows: list[list]) -> dict:
    P = p.aulas_contratadas or 0
    Q = p.aulas_realizadas_agenda or 0
    R = p.aulas_realizadas_estatico or 0
    S = (p.aulas_restantes if p.aulas_restantes is not None else (P - Q))
    excesso = -S if S < 0 else 0

    presencas: list[str] = []
    for row in calendario_rows:
        if len(row) < 11:
            row = list(row) + [""] * (11 - len(row))
        if parse_int_or_none(row[6]) != p.id:
            continue
        if str(row[5] or "").strip() != "Presença":
            continue
        inicio = str(row[2] or "").split(" ")[0]
        if "/" in inicio:
            presencas.append(inicio)
    presencas.sort(key=lambda s: tuple(reversed(s.split("/"))))

    datas_mover = presencas[-excesso:] if excesso > 0 else []
    data_corte = presencas[-(excesso + 1)] if excesso > 0 and len(presencas) > excesso else None

    return {
        "id_antigo": p.id,
        "nome": p.nome,
        "row": p.row,
        "P": P, "Q": Q, "R": R, "S": S,
        "excesso": excesso,
        "datas_mover": datas_mover,
        "data_corte": data_corte,
    }
