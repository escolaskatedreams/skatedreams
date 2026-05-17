import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export type HygieneIssue = {
  title: string;
  startsAt: Date;
  count: number;
};

export type HygieneReport = {
  totalEvents: number;
  confirmed: number;
  cancelled: number;
  cancelledByRename: number;  // titulo="CANCELLED"
  duplicateSlotsCount: number; // slots com >1 evento mesmo titulo+horario
  topDuplicates: HygieneIssue[]; // 5 piores
};

export async function getHygieneReport(): Promise<HygieneReport> {
  const totalsResult = await db.execute<{ status: string; n: number; renamed: number }>(sql`
    SELECT
      status,
      COUNT(*)::int AS n,
      COUNT(*) FILTER (WHERE title = 'CANCELLED')::int AS renamed
    FROM calendar_events
    GROUP BY status
  `);
  const totals = totalsResult.rows;

  const confirmed = Number(totals.find((r) => r.status === "confirmed")?.n ?? 0);
  const cancelled = Number(totals.find((r) => r.status === "cancelled")?.n ?? 0);
  const cancelledByRename = Number(
    (totals.find((r) => r.status === "confirmed")?.renamed ?? 0) +
      (totals.find((r) => r.status === "cancelled")?.renamed ?? 0),
  );

  const dupsResult = await db.execute<{ title: string; starts_at: Date; n: number }>(sql`
    SELECT title, starts_at, COUNT(*)::int AS n
    FROM calendar_events
    WHERE status = 'confirmed' AND title <> 'CANCELLED'
    GROUP BY title, starts_at
    HAVING COUNT(*) > 1
    ORDER BY n DESC, starts_at DESC
    LIMIT 5
  `);

  const countDupsResult = await db.execute<{ n: number }>(sql`
    SELECT COUNT(*)::int AS n FROM (
      SELECT 1 FROM calendar_events
      WHERE status = 'confirmed' AND title <> 'CANCELLED'
      GROUP BY title, starts_at
      HAVING COUNT(*) > 1
    ) d
  `);

  return {
    totalEvents: confirmed + cancelled,
    confirmed,
    cancelled,
    cancelledByRename,
    duplicateSlotsCount: Number(countDupsResult.rows[0]?.n ?? 0),
    topDuplicates: dupsResult.rows.map((r) => ({
      title: r.title,
      startsAt: r.starts_at instanceof Date ? r.starts_at : new Date(r.starts_at),
      count: Number(r.n),
    })),
  };
}
