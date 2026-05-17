"use server";

import { and, gte, lte } from "drizzle-orm";
import { db, calendarEvents, eventFlags } from "@/lib/db";
import { requireSession } from "@/lib/auth/guards";

export async function listEventsBetween(startISO: string, endISO: string) {
  await requireSession();
  const start = new Date(startISO);
  const end = new Date(endISO);

  const events = await db
    .select()
    .from(calendarEvents)
    .where(and(gte(calendarEvents.startsAt, start), lte(calendarEvents.startsAt, end)));

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
    flags: byEvent[e.id] ?? [],
  }));
}
