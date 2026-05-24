"""Domain models for Controle, Calendario, Logs."""

from datetime import datetime

from pydantic import BaseModel


def parse_int_or_none(v) -> int | None:
    if v is None:
        return None
    s = str(v).strip()
    if not s:
        return None
    try:
        return int(float(s))
    except (ValueError, TypeError):
        return None


def parse_float_or_none(v) -> float | None:
    if v is None:
        return None
    s = str(v).strip().replace(",", ".")
    if not s:
        return None
    try:
        return float(s)
    except (ValueError, TypeError):
        return None


def _str_or_none(v) -> str | None:
    if v is None:
        return None
    s = str(v).strip()
    return s if s else None


class PedidoControle(BaseModel):
    row: int
    contador: str = ""
    id: int
    cpf: str | None = None
    nome: str
    situacao: str
    cancelado_em: str | None = None
    nome_filho: str | None = None
    obs: str | None = None
    inicio: str | None = None
    termino: str | None = None
    motivo_termino: str | None = None
    valor: float | None = None
    valor_aula: float | None = None
    freq: str | None = None
    plano: str | None = None
    aulas_contratadas: int | None = None
    aulas_realizadas_estatico: int | None = None
    extra: str | None = None
    aulas_realizadas_agenda: int | None = None
    aulas_restantes: int | None = None

    @classmethod
    def from_row(cls, row: list, row_number: int) -> "PedidoControle":
        padded = list(row) + [""] * max(0, 20 - len(row))
        id_int = parse_int_or_none(padded[1])
        if id_int is None:
            raise ValueError(f"Row {row_number}: id (col B) missing or invalid: {padded[1]!r}")
        return cls(
            row=row_number,
            contador=str(padded[0] or ""),
            id=id_int,
            cpf=_str_or_none(padded[2]),
            nome=str(padded[3] or ""),
            situacao=str(padded[4] or ""),
            cancelado_em=_str_or_none(padded[5]),
            nome_filho=_str_or_none(padded[6]),
            obs=_str_or_none(padded[7]),
            inicio=_str_or_none(padded[8]),
            termino=_str_or_none(padded[9]),
            motivo_termino=_str_or_none(padded[10]),
            valor=parse_float_or_none(padded[11]),
            valor_aula=parse_float_or_none(padded[12]),
            freq=_str_or_none(padded[13]),
            plano=_str_or_none(padded[14]),
            aulas_contratadas=parse_int_or_none(padded[15]),
            aulas_realizadas_estatico=parse_int_or_none(padded[16]),
            extra=_str_or_none(padded[17]),
            aulas_realizadas_agenda=parse_int_or_none(padded[18]),
            aulas_restantes=parse_int_or_none(padded[19]),
        )


class EventoCalendario(BaseModel):
    titulo: str
    cor: int | None = None
    inicio: datetime | None = None
    fim: datetime | None = None
    info_descricao: str | None = None
    presenca: str | None = None
    id: int | None = None
    teste: str | None = None
    nome_controle: str | None = None
    preco_por_aula: float | None = None
    professor: str | None = None

    @classmethod
    def from_row(cls, row: list) -> "EventoCalendario":
        padded = list(row) + [""] * max(0, 11 - len(row))
        return cls(
            titulo=str(padded[0] or ""),
            cor=parse_int_or_none(padded[1]),
            inicio=_parse_iso_or_dd_mm_yyyy(padded[2]),
            fim=_parse_iso_or_dd_mm_yyyy(padded[3]),
            info_descricao=_str_or_none(padded[4]),
            presenca=_str_or_none(padded[5]),
            id=parse_int_or_none(padded[6]),
            teste=_str_or_none(padded[7]),
            nome_controle=_str_or_none(padded[8]),
            preco_por_aula=parse_float_or_none(padded[9]),
            professor=_str_or_none(padded[10]),
        )


class LogRow(BaseModel):
    data: str
    id_antigo: int
    id_novo: int
    pedido_finalizado: str
    pedido_novo_criado: str
    agenda_recorrente_antiga_finalizada: str
    agenda_recorrente_nova_criada: str
    cor_atribuida: str
    nome: str
    check_automatico: str = ""

    @classmethod
    def from_row(cls, row: list) -> "LogRow":
        padded = list(row) + [""] * max(0, 10 - len(row))
        return cls(
            data=str(padded[0] or ""),
            id_antigo=parse_int_or_none(padded[1]) or 0,
            id_novo=parse_int_or_none(padded[2]) or 0,
            pedido_finalizado=str(padded[3] or ""),
            pedido_novo_criado=str(padded[4] or ""),
            agenda_recorrente_antiga_finalizada=str(padded[5] or ""),
            agenda_recorrente_nova_criada=str(padded[6] or ""),
            cor_atribuida=str(padded[7] or ""),
            nome=str(padded[8] or ""),
            check_automatico=str(padded[9] or ""),
        )


def _parse_iso_or_dd_mm_yyyy(v) -> datetime | None:
    if not v:
        return None
    s = str(v).strip()
    if not s:
        return None
    if "/" in s:
        try:
            parts = s.split(" ")
            date_part = parts[0]
            time_part = parts[1] if len(parts) > 1 else "00:00"
            d, m, y = date_part.split("/")
            hh, mm = time_part.split(":")[:2]
            return datetime(int(y), int(m), int(d), int(hh), int(mm))
        except (ValueError, IndexError):
            return None
    try:
        return datetime.fromisoformat(s)
    except ValueError:
        return None
