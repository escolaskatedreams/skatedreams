import { and, gte, lte, isNotNull, sql } from "drizzle-orm";
import { calendarEvents, eventFlags, FLAG_TYPES, type FlagType } from "@/lib/db/schema";
import type { DB } from "@/lib/db/client";

export type StudentRow = {
  student: string;
  totalLessons: number;
  flags: Record<FlagType, number>;
};

type Args = { db: DB; from: Date; to: Date; student?: string };

export async function aggregateByStudent(args: Args): Promise<StudentRow[]> {
  const { db, from, to } = args;

  const rows = await db
    .select({
      student: calendarEvents.studentName,
      totalLessons: sql<number>`count(distinct ${calendarEvents.id})`,
      ...Object.fromEntries(
        FLAG_TYPES.map((f) => [
          `f_${f}`,
          sql<number>`count(distinct case when ${eventFlags.flagType} = ${f} then ${eventFlags.id} end)`,
        ]),
      ),
    })
    .from(calendarEvents)
    .leftJoin(eventFlags, sql`${eventFlags.eventId} = ${calendarEvents.id}`)
    .where(
      and(
        gte(calendarEvents.startsAt, from),
        lte(calendarEvents.startsAt, to),
        isNotNull(calendarEvents.studentName),
      ),
    )
    .groupBy(calendarEvents.studentName);

  return rows.map((r) => ({
    student: r.student!,
    totalLessons: Number(r.totalLessons),
    flags: Object.fromEntries(
      FLAG_TYPES.map((f) => [f, Number((r as Record<string, unknown>)[`f_${f}`] ?? 0)]),
    ) as Record<FlagType, number>,
  }));
}
