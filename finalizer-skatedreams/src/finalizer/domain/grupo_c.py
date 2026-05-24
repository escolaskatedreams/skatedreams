"""Diagnose intermediate states — report only."""

from finalizer.domain.models import PedidoControle


def diagnosticar_grupo_c(p: PedidoControle) -> dict:
    sit = (p.situacao or "").lower()
    has_termino = bool((p.termino or "").strip())
    has_motivo = bool((p.motivo_termino or "").strip())

    if sit == "pendente" and has_motivo:
        subcaso = "3"
        proposta = f"updateGoogleSheet Controle!K{p.row} = '' (RAW)"
    elif sit == "ativo" and has_termino:
        subcaso = "1"
        proposta = "Inspecionar Calendar (aulas futuras?) → completar finalização ou reverter (limpar J+K)"
    elif sit == "ativo" and not has_termino and has_motivo:
        subcaso = "2"
        proposta = f"updateGoogleSheet Controle!K{p.row} = '' (RAW)"
    else:
        subcaso = "4"
        proposta = "Apresentar dado completo pra decisão humana"

    return {
        "id": p.id, "row": p.row, "nome": p.nome,
        "situacao": p.situacao, "termino": p.termino, "motivo_termino": p.motivo_termino,
        "subcaso": subcaso, "proposta": proposta,
    }
