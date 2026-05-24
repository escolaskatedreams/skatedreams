"""Orchestrate one reconciliation cycle."""

import asyncio
from dataclasses import asdict, dataclass, field
from datetime import date, datetime
from typing import Any, Awaitable, Callable

import structlog

from finalizer.domain.classifier import classificar
from finalizer.domain.grupo_a import GrupoAExecutor
from finalizer.domain.grupo_b import propor_grupo_b
from finalizer.domain.grupo_c import diagnosticar_grupo_c
from finalizer.domain.models import LogRow, PedidoControle
from finalizer.validacao.w3 import validar as validar_w3

log = structlog.get_logger("finalizer.pipeline")


@dataclass
class CicloReport:
    inicio: datetime
    fim: datetime | None = None
    duracao_s: float | None = None
    dry_run: bool = False
    abortado_por_sentinela: bool = False
    grupo_a_aplicados: list[dict] = field(default_factory=list)
    grupo_a_falhas: list[dict] = field(default_factory=list)
    grupo_a_candidatos_dry_run: list[dict] = field(default_factory=list)
    grupo_b_pendente: list[dict] = field(default_factory=list)
    grupo_c_pendente: list[dict] = field(default_factory=list)
    w3_issues: list[dict] = field(default_factory=list)
    normalizacoes_aplicadas: int = 0

    def has_pendencias(self) -> bool:
        return bool(self.grupo_b_pendente or self.grupo_c_pendente or self.w3_issues or self.grupo_a_falhas)

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        for k in ("inicio", "fim"):
            v = d.get(k)
            if isinstance(v, datetime):
                d[k] = v.isoformat()
        return d


class Pipeline:
    def __init__(
        self,
        *,
        calendar,
        sheets,
        substituir_recorrencia: Callable,
        dispara_sync: Callable[[], Awaitable[None]],
        max_grupo_a: int,
        dry_run: bool,
        today: date,
    ):
        self.calendar = calendar
        self.sheets = sheets
        self.substituir = substituir_recorrencia
        self.dispara_sync = dispara_sync
        self.max_grupo_a = max_grupo_a
        self.dry_run = dry_run
        self.today = today
        self.last_report: CicloReport | None = None
        self.last_run_at: datetime | None = None
        self._lock = asyncio.Lock()

    async def run_ciclo(self) -> CicloReport:
        async with self._lock:
            report = CicloReport(inicio=datetime.now(), dry_run=self.dry_run)
            log.info("ciclo_inicio", dry_run=self.dry_run)
            try:
                pedidos, calendario, logs = self._snapshot()
                cls = classificar(pedidos)
                log.info(
                    "classificacao",
                    grupo_a=len(cls.grupo_a_auto),
                    grupo_b=len(cls.grupo_b_report),
                    grupo_c=len(cls.grupo_c_report),
                    normalizacoes_e=len(cls.normalizacoes_e),
                )

                if len(cls.grupo_a_auto) > self.max_grupo_a:
                    log.error("sentinela_disparada", count=len(cls.grupo_a_auto), maximo=self.max_grupo_a)
                    report.abortado_por_sentinela = True
                    return self._finalize(report)

                if not self.dry_run:
                    for row in cls.normalizacoes_e:
                        self.sheets.update(f"Controle!E{row}", [["ativo"]], value_input_option="RAW")
                        report.normalizacoes_aplicadas += 1

                if self.dry_run:
                    for p in cls.grupo_a_auto:
                        report.grupo_a_candidatos_dry_run.append({
                            "id_antigo": p.id, "nome": p.nome, "row": p.row,
                        })
                else:
                    executor = GrupoAExecutor(
                        calendar=self.calendar,
                        sheets=self.sheets,
                        substituir_recorrencia=self.substituir,
                        today=self.today,
                    )
                    for p in cls.grupo_a_auto:
                        try:
                            result = executor.executar(p, calendario_rows=calendario)
                            report.grupo_a_aplicados.append(result)
                            log.info(
                                "grupo_a_aplicado",
                                id_antigo=result.get("id_antigo"),
                                id_novo=result.get("id_novo"),
                                data_termino=result.get("data_termino"),
                            )
                        except Exception as e:
                            report.grupo_a_falhas.append({"id_antigo": p.id, "nome": p.nome, "erro": str(e)})
                            log.error("grupo_a_falha", id_antigo=p.id, erro=str(e))

                for p in cls.grupo_b_report:
                    report.grupo_b_pendente.append(propor_grupo_b(p, calendario))
                for p in cls.grupo_c_report:
                    report.grupo_c_pendente.append(diagnosticar_grupo_c(p))

                if not self.dry_run and (report.grupo_a_aplicados or report.normalizacoes_aplicadas):
                    try:
                        await self.dispara_sync()
                        pedidos_pos, _, logs_pos = self._snapshot()
                        report.w3_issues = validar_w3(self.calendar, pedidos=pedidos_pos, logs=logs_pos, today=self.today)
                    except Exception as e:
                        log.error("sync_ou_w3_falhou", erro=str(e))
                        report.w3_issues.append({"motivo": f"Sync/W3 falhou: {e}"})

                return self._finalize(report)
            except Exception as e:
                log.exception("ciclo_erro_fatal", erro=str(e))
                report.w3_issues.append({"motivo": f"Erro fatal no ciclo: {e}"})
                return self._finalize(report)

    def _snapshot(self) -> tuple[list[PedidoControle], list[list], list[LogRow]]:
        controle_raw = self.sheets.read("Controle!A:S")
        calendario_raw = self.sheets.read("Calendario!A:K")
        logs_raw = self.sheets.read("Logs!A:J")

        pedidos = []
        for idx, row in enumerate(controle_raw[1:], start=2):
            try:
                pedidos.append(PedidoControle.from_row(row, idx))
            except (ValueError, Exception) as e:
                log.warning("pedido_invalido", row=idx, erro=str(e))

        logs = []
        for row in logs_raw[1:]:
            try:
                logs.append(LogRow.from_row(row))
            except Exception:
                continue

        return pedidos, calendario_raw, logs

    def _finalize(self, report: CicloReport) -> CicloReport:
        report.fim = datetime.now()
        report.duracao_s = (report.fim - report.inicio).total_seconds()
        log.info(
            "ciclo_fim",
            duracao_s=report.duracao_s,
            grupo_a_aplicados=len(report.grupo_a_aplicados),
            grupo_a_falhas=len(report.grupo_a_falhas),
            grupo_b=len(report.grupo_b_pendente),
            grupo_c=len(report.grupo_c_pendente),
            w3_issues=len(report.w3_issues),
        )
        self.last_report = report
        self.last_run_at = report.fim
        return report
