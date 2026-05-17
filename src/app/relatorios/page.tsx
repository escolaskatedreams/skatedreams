import { requireSession } from "@/lib/auth/guards";
import { getReport } from "./actions";
import { ReportTable } from "./_components/ReportTable";
import { SummaryCards } from "./_components/SummaryCards";

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireSession();
  const sp = await searchParams;
  const to = sp.to ? new Date(sp.to) : new Date();
  const from = sp.from ? new Date(sp.from) : new Date(to.getTime() - 30 * 86400000);
  const rows = await getReport(from.toISOString(), to.toISOString());

  return (
    <main className="max-w-7xl mx-auto p-4 space-y-6">
      <h1 className="font-display text-4xl text-brand-ink">Relatórios</h1>

      <form className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-brand-ink mb-1.5 uppercase tracking-wider">De</label>
          <input
            type="date"
            name="from"
            defaultValue={from.toISOString().slice(0, 10)}
            className="bg-brand-sky-soft border-0 rounded-xl px-4 py-2.5 font-body focus:ring-2 focus:ring-brand-primary focus:bg-brand-cloud transition-all outline-none text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-brand-ink mb-1.5 uppercase tracking-wider">Até</label>
          <input
            type="date"
            name="to"
            defaultValue={to.toISOString().slice(0, 10)}
            className="bg-brand-sky-soft border-0 rounded-xl px-4 py-2.5 font-body focus:ring-2 focus:ring-brand-primary focus:bg-brand-cloud transition-all outline-none text-sm"
          />
        </div>
        <button className="bg-brand-primary text-brand-cloud px-5 py-2.5 rounded-full text-sm font-medium hover:bg-brand-primary-strong hover:shadow-glow active:animate-scale-press transition-all">
          Aplicar
        </button>
        <a
          href={`/api/reports/export?from=${from.toISOString()}&to=${to.toISOString()}`}
          className="px-5 py-2.5 rounded-full text-sm font-medium bg-brand-cloud ring-1 ring-brand-ink/10 text-brand-muted hover:text-brand-ink hover:ring-brand-primary/30 transition-all shadow-soft"
        >
          Exportar CSV
        </a>
      </form>

      <SummaryCards rows={rows} />
      <ReportTable rows={rows} />
    </main>
  );
}
