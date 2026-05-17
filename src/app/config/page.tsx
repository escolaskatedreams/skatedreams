import { requireSession } from "@/lib/auth/guards";
import { getConnection } from "@/lib/google/connection";
import { getCalendarId } from "@/lib/google/auth";
import { getHygieneReport } from "@/lib/reports/hygiene";
import { forceSyncAction, logoutAction } from "./actions";

const fmtBR = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export default async function ConfigPage() {
  await requireSession();
  const conn = await getConnection();
  const calendarId = getCalendarId();
  const hygiene = await getHygieneReport();

  return (
    <main className="max-w-2xl mx-auto p-8 space-y-8">
      <h1 className="text-3xl font-bold">Configurações</h1>

      <section className="border rounded-lg p-4 space-y-3 bg-brand-cloud">
        <h2 className="text-xl font-semibold">Google Calendar</h2>
        <p className="text-sm text-brand-muted">
          Conectado via <strong>service account</strong> ao calendário{" "}
          <code className="bg-brand-sky-soft px-1 rounded">{calendarId}</code>.
        </p>
        {conn ? (
          <p className="text-sm text-brand-muted">
            Última sincronização:{" "}
            {conn.lastSyncAt ? fmtBR.format(conn.lastSyncAt) : "ainda não rodou"}.
          </p>
        ) : (
          <p className="text-sm text-brand-muted">
            Aguardando primeira sincronização. Clique no botão abaixo para forçar agora.
          </p>
        )}
        <form action={forceSyncAction}>
          <button className="bg-brand-primary text-brand-cloud px-4 py-2 rounded hover:bg-brand-primary-strong">
            Sincronizar agora
          </button>
        </form>
      </section>

      <section className="border rounded-lg p-4 space-y-3 bg-brand-cloud">
        <h2 className="text-xl font-semibold">Saúde dos dados</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Stat label="Eventos sincronizados" value={String(hygiene.totalEvents)} />
          <Stat label="Confirmados" value={String(hygiene.confirmed)} />
          <Stat label="Cancelados" value={String(hygiene.cancelled)} />
          <Stat label='Renomeados "CANCELLED"' value={String(hygiene.cancelledByRename)} />
        </div>

        {hygiene.duplicateSlotsCount > 0 && (
          <div className="border-l-4 border-brand-warn bg-brand-sky-soft p-3 text-sm space-y-2">
            <p className="font-medium text-brand-ink">
              ⚠️ {hygiene.duplicateSlotsCount} horários com eventos sobrepostos do mesmo aluno
            </p>
            <p className="text-brand-muted">
              A agenda do Google tem múltiplas séries recorrentes apontando para o mesmo aluno no
              mesmo horário (provavelmente importações antigas acumuladas). O app reflete fielmente,
              mas vale uma limpeza direto no Google Calendar.
            </p>
            <p className="text-brand-muted">Top 5 piores:</p>
            <ul className="text-xs space-y-1 font-mono">
              {hygiene.topDuplicates.map((d, i) => (
                <li key={i}>
                  <span className="text-brand-danger font-semibold">{d.count}×</span>{" "}
                  {d.title} — {fmtBR.format(d.startsAt)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="border rounded-lg p-4 bg-brand-cloud">
        <form action={logoutAction}>
          <button className="text-brand-danger underline">Sair</button>
        </form>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-brand-sky-soft rounded p-2">
      <div className="text-xs text-brand-muted">{label}</div>
      <div className="text-lg font-semibold text-brand-ink">{value}</div>
    </div>
  );
}
