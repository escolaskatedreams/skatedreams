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
    <main className="max-w-7xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">Relatórios</h1>

      <form className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="block text-xs mb-1">De</label>
          <input
            type="date"
            name="from"
            defaultValue={from.toISOString().slice(0, 10)}
            className="border rounded px-2 py-1"
          />
        </div>
        <div>
          <label className="block text-xs mb-1">Até</label>
          <input
            type="date"
            name="to"
            defaultValue={to.toISOString().slice(0, 10)}
            className="border rounded px-2 py-1"
          />
        </div>
        <button className="bg-brand-primary text-brand-cloud px-3 py-1.5 rounded text-sm hover:bg-brand-primary-strong">Aplicar</button>
        <a
          href={`/api/reports/export?from=${from.toISOString()}&to=${to.toISOString()}`}
          className="border px-3 py-1.5 rounded text-sm"
        >
          Exportar CSV
        </a>
      </form>

      <SummaryCards rows={rows} />
      <ReportTable rows={rows} />
    </main>
  );
}
