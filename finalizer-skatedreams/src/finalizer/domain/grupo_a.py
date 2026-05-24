"""Execute Grupo A (zerados) end-to-end: substituir recorrência + escrever Controle + Logs."""

from datetime import date

from finalizer.domain.data_termino import compute_data_termino
from finalizer.domain.models import PedidoControle, parse_int_or_none


class GrupoAExecutor:
    def __init__(self, *, calendar, sheets, substituir_recorrencia, today: date):
        self.calendar = calendar
        self.sheets = sheets
        self.substituir = substituir_recorrencia
        self.today = today

    def _proximo_id(self) -> int:
        col_b = self.sheets.read("Controle!B:B")
        ids = []
        for row in col_b:
            if not row:
                continue
            v = parse_int_or_none(row[0])
            if v is not None:
                ids.append(v)
        return (max(ids) + 1) if ids else 1

    def executar(self, p: PedidoControle, *, calendario_rows: list[list]) -> dict:
        data_termino = compute_data_termino(calendario_rows, p.id)
        if not data_termino:
            raise ValueError(f"data_termino vazio pra id={p.id} (sem Presença na Calendario)")

        id_novo = self._proximo_id()
        sub = self.substituir(
            self.calendar,
            id_antigo=p.id,
            id_novo=id_novo,
            nome=p.nome,
            data_termino_dd_mm_yyyy=data_termino,
        )
        cor = str(sub.get("colorId") or "7")

        self.sheets.update(f"Controle!E{p.row}", [["finalizado"]], value_input_option="RAW")
        self.sheets.update(f"Controle!J{p.row}", [[data_termino]], value_input_option="RAW")
        self.sheets.update(f"Controle!K{p.row}", [["Automático"]], value_input_option="RAW")

        nova_row = [
            "",
            id_novo,
            p.cpf or "",
            p.nome,
            "pendente",
            "",
            p.nome_filho or "",
            "",
            data_termino,
            "",
            "",
            p.valor if p.valor is not None else "",
            "",
            p.freq or "",
            p.plano or "",
            p.aulas_contratadas if p.aulas_contratadas is not None else "",
            "",
            "",
            "",
        ]
        self.sheets.append("Controle!A:S", [nova_row], value_input_option="USER_ENTERED")

        hoje = self.today.strftime("%d/%m/%Y")
        log_row = [hoje, p.id, id_novo, "*", "*", "*", "*", cor, p.nome, ""]
        self.sheets.append("Logs!A:J", [log_row], value_input_option="RAW")

        return {
            "status": "OK",
            "id_antigo": p.id,
            "id_novo": id_novo,
            "data_termino": data_termino,
            "colorId": cor,
            "newEventId": sub.get("newEventId"),
            "masters": sub.get("masters", []),
        }
