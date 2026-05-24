"""Compute data_termino from the Calendario sheet (filtered by Apps Script)."""

from finalizer.domain.models import parse_int_or_none


def compute_data_termino(calendario_rows: list[list], pedido_id: int) -> str | None:
    """Return max(inicio) where id=pedido_id and presenca='Presença', formatted as dd/MM/yyyy."""
    presencas: list[tuple[int, int, int]] = []
    for row in calendario_rows:
        if len(row) < 11:
            row = list(row) + [""] * (11 - len(row))
        if parse_int_or_none(row[6]) != pedido_id:
            continue
        presenca = str(row[5] or "").strip()
        if presenca != "Presença":
            continue
        inicio = str(row[2] or "").strip()
        if not inicio or "/" not in inicio:
            continue
        date_part = inicio.split(" ")[0]
        try:
            d, m, y = date_part.split("/")
            presencas.append((int(y), int(m), int(d)))
        except ValueError:
            continue
    if not presencas:
        return None
    y, m, d = max(presencas)
    return f"{d:02d}/{m:02d}/{y:04d}"
