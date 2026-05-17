import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import path from "node:path";
import { env } from "@/env";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
];

let cachedAuth: ReturnType<typeof google.auth.GoogleAuth.prototype.getClient> extends Promise<infer T>
  ? T | null
  : never = null;

/**
 * Retorna um cliente Google autenticado via service account.
 * O JSON do SA fica em /secrets/ (fora do git), apontado por GOOGLE_SERVICE_ACCOUNT_KEY_PATH.
 */
export async function getGoogleClient() {
  if (cachedAuth) return cachedAuth;
  const keyFile = path.isAbsolute(env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH)
    ? env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH
    : path.resolve(process.cwd(), env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH);

  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: SCOPES,
  });
  const client = await auth.getClient();
  cachedAuth = client as never;
  return client as unknown as OAuth2Client;
}

export function getCalendarId(): string {
  return env.GOOGLE_CALENDAR_ID;
}
