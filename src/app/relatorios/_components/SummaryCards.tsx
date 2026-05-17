import type { StudentRow } from "@/lib/reports/aggregate";

export function SummaryCards({ rows }: { rows: StudentRow[] }) {
  const totalLessons = rows.reduce((a, r) => a + r.totalLessons, 0);
  const withAnyFlag = rows.reduce(
    (a, r) => a + Object.values(r.flags).reduce((x, y) => x + y, 0),
    0,
  );
  const pct = totalLessons > 0 ? Math.round((withAnyFlag / totalLessons) * 100) : 0;

  const topAbsent = [...rows].sort((a, b) => b.flags.student_absent - a.flags.student_absent).slice(0, 3);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card title="Total de aulas" value={String(totalLessons)} />
      <Card title="% com flag" value={`${pct}%`} />
      <Card
        title="Top 3 faltas"
        value={topAbsent.map((r) => `${r.student} (${r.flags.student_absent})`).join(", ") || "—"}
      />
      <Card title="Alunos únicos" value={String(rows.length)} />
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-white border rounded-lg p-3">
      <div className="text-xs text-neutral-500">{title}</div>
      <div className="text-lg font-semibold mt-1">{value}</div>
    </div>
  );
}
