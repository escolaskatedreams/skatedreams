"""Shorten a recurrence master via DELETE+INSERT and re-apply color overrides.

NEVER use events.patch({recurrence}) on a master — it regenerates the master
(new eventId) and cancels all instance overrides (Tomate=falta, Flamingo=substituição).
"""

import time
from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from finalizer.domain.parse_helpers import fmt_yyyymmdd, parse_until_from_rrule, rrule_sem_until
from finalizer.operations.preserva_cores import mapear_overrides

Acao = Literal["MANTER", "DELETE_INSERT", "SEM_RRULE"]


@dataclass
class EncurtaResult:
    acao: Acao
    master_antigo_id: str
    master_novo_id: str | None = None
    until_anterior: str | None = None
    until_novo: str | None = None
    cores_reaplicadas: int = 0


def encurta_master(
    calendar,
    *,
    master: dict,
    eventos_do_id: list[dict],
    cut_date: datetime,
    pedido_id: int,
    sleep_after_insert: float = 1.5,
) -> EncurtaResult:
    rec_id = master["id"]
    rrule_list = master.get("recurrence") or []
    if not rrule_list:
        return EncurtaResult(acao="SEM_RRULE", master_antigo_id=rec_id)
    rrule = rrule_list[0]
    until_atual = parse_until_from_rrule(rrule)
    until_atual_str = fmt_yyyymmdd(until_atual) if until_atual else None

    if until_atual and until_atual <= cut_date:
        return EncurtaResult(acao="MANTER", master_antigo_id=rec_id, until_anterior=until_atual_str)

    master_color = master.get("colorId") or "7"
    overrides = mapear_overrides(eventos_do_id, master_color=master_color, cut_date=cut_date, rec_id=rec_id)

    calendar.delete_event(rec_id)

    cut_ymd = fmt_yyyymmdd(cut_date)
    nova_rrule = f"{rrule_sem_until(rrule)};UNTIL={cut_ymd}T235959Z"
    novo_master = calendar.insert_event({
        "summary": master.get("summary", ""),
        "start": master["start"],
        "end": master["end"],
        "recurrence": [nova_rrule],
        "colorId": master_color,
    })

    if sleep_after_insert > 0:
        time.sleep(sleep_after_insert)

    novas = calendar.list_events(
        query=f"id: {pedido_id}",
        time_min=(master["start"].get("dateTime") or master["start"].get("date")),
        time_max=f"{cut_ymd[:4]}-{cut_ymd[4:6]}-{cut_ymd[6:8]}T23:59:59Z",
    )
    reaplicadas = 0
    for e in novas:
        if e.get("status") != "confirmed":
            continue
        if e.get("recurringEventId") != novo_master["id"]:
            continue
        start = e.get("start") or {}
        iso = (start.get("dateTime") or start.get("date") or "")[:10]
        cor = overrides.get(iso)
        if cor:
            calendar.patch_event(e["id"], {"colorId": cor})
            reaplicadas += 1

    return EncurtaResult(
        acao="DELETE_INSERT",
        master_antigo_id=rec_id,
        master_novo_id=novo_master["id"],
        until_anterior=until_atual_str,
        until_novo=cut_ymd,
        cores_reaplicadas=reaplicadas,
    )
