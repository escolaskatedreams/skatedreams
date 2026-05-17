import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { aggregateByStudent } from "@/lib/reports/aggregate";
import { requireSession } from "@/lib/auth/guards";
import { FLAG_TYPES } from "@/lib/db/schema";

function csvEscape(value: unknown): string {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  await requireSession();
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  if (!from || !to) return new Response("from/to required", { status: 400 });

  const rows = await aggregateByStudent({
    db,
    from: new Date(from),
    to: new Date(to),
  });

  const headers = ["aluno", "aulas", ...FLAG_TYPES];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        csvEscape(r.student),
        r.totalLessons,
        ...FLAG_TYPES.map((f) => r.flags[f]),
      ].join(","),
    );
  }
  const csv = "﻿" + lines.join("\n"); // BOM for Excel pt-BR

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="skatedreams-report-${from.slice(0, 10)}_${to.slice(0, 10)}.csv"`,
    },
  });
}
