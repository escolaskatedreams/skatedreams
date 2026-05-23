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
 * Em produção usa GOOGLE_SERVICE_ACCOUNT_JSON (base64 do JSON inteiro).
 * Em dev local cai pra GOOGLE_SERVICE_ACCOUNT_KEY_PATH (arquivo em /secrets/).
 */
export async function getGoogleClient() {
  if (cachedAuth) return cachedAuth;

  const authConfig: { scopes: string[]; credentials?: object; keyFile?: string } = {
    scopes: SCOPES,
  };

  if (env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    const raw = Buffer.from(env.GOOGLE_SERVICE_ACCOUNT_JSON, "base64").toString("utf8");
    authConfig.credentials = JSON.parse(raw);
  } else if (env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH) {
    authConfig.keyFile = path.isAbsolute(env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH)
      ? env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH
      : path.resolve(process.cwd(), env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH);
  }

  const auth = new google.auth.GoogleAuth(authConfig);
  const client = await auth.getClient();
  cachedAuth = client as never;
  return client as unknown as OAuth2Client;
}

export function getCalendarId(): string {
  return env.GOOGLE_CALENDAR_ID;
}
