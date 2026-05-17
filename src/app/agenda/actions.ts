"use server";

import { and, eq, gte, lte, ne } from "drizzle-orm";
import { db, calendarEvents, eventFlags } from "@/lib/db";
import { requireSession } from "@/lib/auth/guards";
import { startOfWeek, addDays } from "date-fns";

export async function listEventsBetween(
  startISO: string,
  endISO: string,
  opts: { showCancelled?: boolean } = {},
) {
  await requireSession();
  const start = new Date(startISO);
  const end = new Date(endISO);

  const conditions = [
    gte(calendarEvents.startsAt, start),
    lte(calendarEvents.startsAt, end),
  ];
  if (!opts.showCancelled) {
    conditions.push(eq(calendarEvents.status, "confirmed"));
    // O Caio às vezes renomeia eventos para "CANCELLED" antes de deletar — esconder esses também.
    conditions.push(ne(calendarEvents.title, "CANCELLED"));
  }

  const events = await db
    .select()
    .from(calendarEvents)
    .where(and(...conditions));

  const flags = await db.select().from(eventFlags);

  const byEvent: Record<string, string[]> = {};
  for (const f of flags) {
    (byEvent[f.eventId] ??= []).push(f.flagType);
  }

  return events.map((e) => ({
    id: e.id,
    googleId: e.googleId,
    title: e.title,
    studentName: e.studentName,
    start: e.startsAt.toISOString(),
    end: e.endsAt.toISOString(),
    status: e.status,
    googleColorId: e.googleColorId,
    flags: byEvent[e.id] ?? [],
  }));
}

export async function listEventsForWeek(anchorISO: string, showCancelled = false) {
  await requireSession();
  const anchor = new Date(anchorISO);
  // Semana começa segunda (weekStartsOn: 1)
  const start = startOfWeek(anchor, { weekStartsOn: 1 });
  const end = addDays(start, 7);
  return listEventsBetween(start.toISOString(), end.toISOString(), { showCancelled });
}
