"use client";

import type { StudentRow } from "@/lib/reports/aggregate";

export function ReportTable({ rows }: { rows: StudentRow[] }) {
  return (
    <div className="overflow-x-auto border rounded-lg bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-neutral-100">
          <tr>
            <th className="px-3 py-2 text-left">Aluno</th>
            <th className="px-3 py-2 text-right">Aulas</th>
            <th className="px-3 py-2 text-right">❌</th>
            <th className="px-3 py-2 text-right">⏱️</th>
            <th className="px-3 py-2 text-right">⏱️⏱️</th>
            <th className="px-3 py-2 text-right">😐</th>
            <th className="px-3 py-2 text-right">😭</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.student} className="border-t">
              <td className="px-3 py-2">{r.student}</td>
              <td className="px-3 py-2 text-right">{r.totalLessons}</td>
              <td className="px-3 py-2 text-right">{r.flags.student_absent}</td>
              <td className="px-3 py-2 text-right">{r.flags.teacher_late}</td>
              <td className="px-3 py-2 text-right">{r.flags.teacher_very_late}</td>
              <td className="px-3 py-2 text-right">{r.flags.teacher_unmotivated}</td>
              <td className="px-3 py-2 text-right">{r.flags.students_disengaged}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-6 text-center text-neutral-500">
                Sem dados no período.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
