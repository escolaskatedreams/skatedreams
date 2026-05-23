"use client";

import type { StudentRow } from "@/lib/reports/aggregate";

export function ReportTable({ rows }: { rows: StudentRow[] }) {
  return (
    <div className="bg-brand-cloud rounded-2xl shadow-soft-md overflow-hidden ring-1 ring-brand-ink/5">
      <table className="min-w-full text-sm">
        <thead className="bg-brand-sky-soft">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-brand-muted">Aluno</th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-brand-muted">Aulas</th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-brand-muted">❌</th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-brand-muted">⏱️</th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-brand-muted">⏱️⏱️</th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-brand-muted">😐</th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-brand-muted">😭</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.student} className="border-t border-brand-sky hover:bg-brand-sky-soft/50 transition-colors">
              <td className="px-4 py-3 font-medium text-brand-ink">{r.student}</td>
              <td className="px-4 py-3 text-right text-brand-muted">{r.totalLessons}</td>
              <td className="px-4 py-3 text-right text-brand-muted">{r.flags.student_absent}</td>
              <td className="px-4 py-3 text-right text-brand-muted">{r.flags.teacher_late}</td>
              <td className="px-4 py-3 text-right text-brand-muted">{r.flags.teacher_very_late}</td>
              <td className="px-4 py-3 text-right text-brand-muted">{r.flags.teacher_unmotivated}</td>
              <td className="px-4 py-3 text-right text-brand-muted">{r.flags.students_disengaged}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-brand-muted">
                Sem dados no período.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
