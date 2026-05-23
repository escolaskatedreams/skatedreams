import { db, googleConnection } from "@/lib/db";
import { getGoogleClient, getCalendarId } from "./auth";

export type ConnectionState = {
  id: string;
  calendarId: string;
  serviceAccountEmail: string | null;
  lastSyncAt: Date | null;
  syncToken: string | null;
};

/**
 * Estado de sincronização singleton.
 * Diferente do modelo OAuth antigo: não há mais tokens em repouso —
 * autenticação vem do JSON do service account em /secrets/.
 */
export async function getConnection(): Promise<ConnectionState | null> {
  const rows = await db.select().from(googleConnection).limit(1);
  return rows[0] ?? null;
}

export async function ensureConnection(serviceAccountEmail: string): Promise<ConnectionState> {
  const existing = await getConnection();
  if (existing) return existing;
  const [row] = await db
    .insert(googleConnection)
    .values({ calendarId: getCalendarId(), serviceAccountEmail })
    .returning();
  return row;
}

export async function updateSyncState(input: {
  id: string;
  syncToken?: string | null;
  lastSyncAt?: Date;
}) {
  const set: Record<string, unknown> = {};
  if (input.syncToken !== undefined) set.syncToken = input.syncToken;
  if (input.lastSyncAt !== undefined) set.lastSyncAt = input.lastSyncAt;
  if (Object.keys(set).length === 0) return;
  const { eq } = await import("drizzle-orm");
  await db.update(googleConnection).set(set).where(eq(googleConnection.id, input.id));
}

/**
 * Retorna o cliente Google autenticado (service account).
 * Compatibilidade com sync/run.ts e demais consumidores.
 */
export async function getAuthorizedClient() {
  return getGoogleClient();
}
