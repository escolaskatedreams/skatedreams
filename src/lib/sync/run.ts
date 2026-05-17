import { db, calendarEvents } from "@/lib/db";
import { sql } from "drizzle-orm";
import { getGoogleClient, getCalendarId } from "@/lib/google/auth";
import { ensureConnection, updateSyncState } from "@/lib/google/connection";
import { listEvents, type GEvent } from "@/lib/google/calendar";
import { parseStudentName } from "./parse-student-name";
import { env } from "@/env";

type UpsertRow = {
  googleId: string;
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date;
  studentName: string | null;
  status: "confirmed" | "cancelled";
  googleEtag: string | null;
};

export function eventsToUpserts(events: GEvent[]): UpsertRow[] {
  const out: UpsertRow[] = [];
  for (const e of events) {
    if (!e.id) continue;
    const cancelled = e.status === "cancelled";
    const startDt = e.start?.dateTime;
    const endDt = e.end?.dateTime;
    if (!cancelled && (!startDt || !endDt)) continue; // ignora all-day
    out.push({
      googleId: e.id,
      title: e.summary ?? "(sem título)",
      description: e.description ?? null,
      startsAt: new Date(startDt ?? Date.now()),
      endsAt: new Date(endDt ?? Date.now()),
      studentName: e.summary ? parseStudentName(e.summary) : null,
      status: cancelled ? "cancelled" : "confirmed",
      googleEtag: e.etag ?? null,
    });
  }
  return out;
}

async function upsertBatch(rows: UpsertRow[]) {
  if (rows.length === 0) return;
  await db
    .insert(calendarEvents)
    .values(rows.map((r) => ({ ...r, syncedAt: new Date() })))
    .onConflictDoUpdate({
      target: calendarEvents.googleId,
      set: {
        title: sql`excluded.title`,
        description: sql`excluded.description`,
        startsAt: sql`excluded.starts_at`,
        endsAt: sql`excluded.ends_at`,
        studentName: sql`excluded.student_name`,
        status: sql`excluded.status`,
        googleEtag: sql`excluded.google_etag`,
        syncedAt: sql`excluded.synced_at`,
      },
    });
}

export async function runSync(): Promise<{ scope: "incremental" | "full"; applied: number }> {
  // Service account JWT — sempre disponível enquanto a chave existir.
  const client = await getGoogleClient();
  const calendarId = getCalendarId();

  // Garante linha de sync state (cria na 1ª vez).
  const conn = await ensureConnection("geral-google@automacoes-n8n-491322.iam.gserviceaccount.com");

  // Tenta incremental se temos syncToken
  if (conn.syncToken) {
    try {
      const { items, nextSyncToken } = await listEvents(client, {
        calendarId,
        syncToken: conn.syncToken,
      });
      await upsertBatch(eventsToUpserts(items));
      await updateSyncState({
        id: conn.id,
        syncToken: nextSyncToken ?? conn.syncToken,
        lastSyncAt: new Date(),
      });
      return { scope: "incremental", applied: items.length };
    } catch (err: unknown) {
      const code = (err as { code?: number })?.code;
      if (code !== 410) throw err;
      // cai pro full sync
    }
  }

  // Full sync
  const now = Date.now();
  const past = new Date(now - env.SYNC_WINDOW_PAST_DAYS * 86400000);
  const future = new Date(now + env.SYNC_WINDOW_FUTURE_DAYS * 86400000);
  const { items, nextSyncToken } = await listEvents(client, {
    calendarId,
    timeMin: past.toISOString(),
    timeMax: future.toISOString(),
  });
  await upsertBatch(eventsToUpserts(items));
  await updateSyncState({
    id: conn.id,
    syncToken: nextSyncToken,
    lastSyncAt: new Date(),
  });
  return { scope: "full", applied: items.length };
}
