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
      <h1 className="font-display text-4xl text-brand-ink">Configurações</h1>

      <section className="bg-brand-cloud rounded-2xl shadow-soft-md p-6 ring-1 ring-brand-ink/5 space-y-3">
        <h2 className="font-display text-2xl text-brand-ink">Google Calendar</h2>
        <p className="text-sm text-brand-muted">
          Conectado via <strong>service account</strong> ao calendário{" "}
          <code className="bg-brand-sky-soft px-1.5 py-0.5 rounded-md font-mono text-xs">{calendarId}</code>.
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
          <button className="bg-brand-primary text-brand-cloud px-5 py-2 rounded-full font-medium hover:bg-brand-primary-strong hover:shadow-glow active:animate-scale-press transition-all">
            Sincronizar agora
          </button>
        </form>
      </section>

      <section className="bg-brand-cloud rounded-2xl shadow-soft-md p-6 ring-1 ring-brand-ink/5 space-y-4">
        <h2 className="font-display text-2xl text-brand-ink">Saúde dos dados</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Stat label="Eventos sincronizados" value={String(hygiene.totalEvents)} />
          <Stat label="Confirmados" value={String(hygiene.confirmed)} />
          <Stat label="Cancelados" value={String(hygiene.cancelled)} />
          <Stat label='Renomeados "CANCELLED"' value={String(hygiene.cancelledByRename)} />
        </div>

        {hygiene.duplicateSlotsCount > 0 && (
          <div className="bg-brand-warn/10 border border-brand-warn/30 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-brand-warn animate-pulse" />
              <p className="font-medium text-brand-ink">
                {hygiene.duplicateSlotsCount} horários com eventos sobrepostos do mesmo aluno
              </p>
            </div>
            <p className="text-sm text-brand-muted">
              A agenda do Google tem múltiplas séries recorrentes apontando para o mesmo aluno no
              mesmo horário (provavelmente importações antigas acumuladas). O app reflete fielmente,
              mas vale uma limpeza direto no Google Calendar.
            </p>
            <p className="text-sm text-brand-muted">Top 5 piores:</p>
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

      <section className="bg-brand-cloud rounded-2xl shadow-soft-md p-6 ring-1 ring-brand-ink/5">
        <form action={logoutAction}>
          <button className="text-brand-danger font-medium px-4 py-2 rounded-full border border-brand-danger/20 hover:bg-brand-danger/5 transition-colors">
            Sair
          </button>
        </form>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-brand-sky-soft rounded-xl p-3">
      <div className="text-xs text-brand-muted">{label}</div>
      <div className="font-display text-2xl text-brand-ink mt-1">{value}</div>
    </div>
  );
}
