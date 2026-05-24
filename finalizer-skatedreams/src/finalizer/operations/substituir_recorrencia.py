"""Replace a recurrence: shorten old master(s), POST a new master with id_novo."""

from datetime import datetime, timedelta

from finalizer.domain.parse_helpers import (
    limpa_titulo,
    parse_dd_mm_yyyy,
    rrule_sem_until,
)
from finalizer.operations.encurta_master import encurta_master


def _iso_local(d: datetime) -> str:
    return d.strftime("%Y-%m-%dT%H:%M:%S-03:00")


def substituir_recorrencia(
    calendar,
    *,
    id_antigo: int,
    id_novo: int,
    nome: str,
    data_termino_dd_mm_yyyy: str,
    sleep_after_insert: float = 1.5,
    time_min: str = "2025-11-01T00:00:00Z",
    time_max: str = "2027-12-31T00:00:00Z",
) -> dict:
    cut_date = parse_dd_mm_yyyy(data_termino_dd_mm_yyyy)
    eventos = calendar.list_events(
        query=f"id: {id_antigo}",
        time_min=time_min,
        time_max=time_max,
        single_events=True,
    )
    eventos = [e for e in eventos if e.get("status") == "confirmed"]
    rec_ids = list({e["recurringEventId"] for e in eventos if e.get("recurringEventId")})

    masters_result = []
    main_master_color = None
    main_master_rrule = None
    for rec_id in rec_ids:
        m = calendar.get_event(rec_id)
        if m.get("recurrence") or []:
            main_master_color = m.get("colorId") or "7"
            if m.get("recurrence"):
                main_master_rrule = m["recurrence"][0]
        result = encurta_master(
            calendar,
            master=m,
            eventos_do_id=eventos,
            cut_date=cut_date,
            pedido_id=id_antigo,
            sleep_after_insert=sleep_after_insert,
        )
        masters_result.append({
            "rec_id": result.master_antigo_id,
            "acao": result.acao,
            "until_anterior": result.until_anterior,
            "until_novo": result.until_novo,
            "cores_reaplicadas": result.cores_reaplicadas,
            "master_novo_id": result.master_novo_id,
        })

    color_id = main_master_color or "7"

    past = []
    for e in eventos:
        sd = e.get("start", {}).get("dateTime")
        if sd:
            try:
                if datetime.fromisoformat(sd[:19]) <= cut_date:
                    past.append(e)
            except ValueError:
                continue
    if not past:
        raise ValueError("Sem aulas passadas pra inferir horário/dia da semana")
    last_past = past[-1]
    last_start = datetime.fromisoformat(last_past["start"]["dateTime"][:19])
    last_end = datetime.fromisoformat(last_past["end"]["dateTime"][:19])
    dur = last_end - last_start
    tz = last_past["start"].get("timeZone") or "America/Sao_Paulo"

    nova_start = cut_date + timedelta(days=1)
    while nova_start.weekday() != last_start.weekday():
        nova_start += timedelta(days=1)
    nova_start = nova_start.replace(hour=last_start.hour, minute=last_start.minute, second=0, microsecond=0)
    nova_end = nova_start + dur

    nova_rrule = rrule_sem_until(main_master_rrule) if main_master_rrule else "RRULE:FREQ=WEEKLY"

    check_novo = calendar.list_events(
        query=f"id: {id_novo}",
        time_min=cut_date.isoformat() + "Z",
        time_max="2027-12-31T00:00:00Z",
        single_events=True,
    )
    ja_existe_master = None
    for e in check_novo:
        if e.get("status") == "confirmed" and e.get("recurringEventId"):
            ja_existe_master = e["recurringEventId"]
            break

    if ja_existe_master:
        return {
            "status": "OK",
            "colorId": color_id,
            "newEventId": ja_existe_master,
            "masters": masters_result,
            "post_skipped": "already_exists",
        }

    titulo = limpa_titulo(last_past.get("summary"), nome)
    novo_summary = f"{titulo} | id: {id_novo}"
    post = calendar.insert_event({
        "summary": novo_summary,
        "start": {"dateTime": _iso_local(nova_start), "timeZone": tz},
        "end": {"dateTime": _iso_local(nova_end), "timeZone": tz},
        "recurrence": [nova_rrule],
        "colorId": color_id,
    })
    return {
        "status": "OK",
        "colorId": color_id,
        "newEventId": post["id"],
        "masters": masters_result,
        "novo_summary": novo_summary,
    }
