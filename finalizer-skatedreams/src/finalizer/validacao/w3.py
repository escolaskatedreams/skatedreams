"""W3 — validate Controle ↔ Calendar ↔ Logs cross-consistency for recent transitions."""

from datetime import date, timedelta

from finalizer.domain.models import LogRow, PedidoControle


def _parse_dmy(s: str) -> date | None:
    try:
        d, m, y = s.split("/")
        return date(int(y), int(m), int(d))
    except (ValueError, AttributeError):
        return None


def validar(
    calendar,
    *,
    pedidos: list[PedidoControle],
    logs: list[LogRow],
    today: date,
    janela_dias: int = 7,
) -> list[dict]:
    issues: list[dict] = []
    pedidos_by_id = {p.id: p for p in pedidos}
    janela_inicio = today - timedelta(days=janela_dias)

    for log in logs:
        log_date = _parse_dmy(log.data)
        if log_date is None or log_date < janela_inicio:
            continue

        ped_antigo = pedidos_by_id.get(log.id_antigo)
        if ped_antigo is None:
            issues.append({
                "id_antigo": log.id_antigo, "id_novo": log.id_novo,
                "motivo": f"Pedido antigo {log.id_antigo} não encontrado em Controle",
            })
        elif ped_antigo.situacao.lower() != "finalizado":
            issues.append({
                "id_antigo": log.id_antigo, "id_novo": log.id_novo,
                "motivo": f"Pedido antigo {log.id_antigo} não finalizado (situacao={ped_antigo.situacao})",
            })

        if log.id_novo not in pedidos_by_id:
            issues.append({
                "id_antigo": log.id_antigo, "id_novo": log.id_novo,
                "motivo": f"Id novo {log.id_novo} não existe em Controle",
            })

        time_min = today.isoformat() + "T00:00:00Z"
        eventos_futuros = calendar.list_events(
            query=f"id: {log.id_antigo}", time_min=time_min, time_max="2027-12-31T00:00:00Z",
        )
        confirmados = [e for e in eventos_futuros if e.get("status") == "confirmed"]
        if confirmados:
            issues.append({
                "id_antigo": log.id_antigo, "id_novo": log.id_novo,
                "motivo": f"Evento futuro confirmado do id antigo {log.id_antigo} (esperado vazio)",
                "exemplos": [e.get("id") for e in confirmados[:3]],
            })

    return issues
