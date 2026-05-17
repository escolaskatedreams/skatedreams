import { db, googleConnection } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto/aes-gcm";
import { env } from "@/env";
import { makeOAuthClient } from "./oauth-client";

export async function saveConnection(input: {
  googleEmail: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}) {
  await db.delete(googleConnection);
  await db.insert(googleConnection).values({
    googleEmail: input.googleEmail,
    accessTokenEnc: encrypt(input.accessToken, env.ENCRYPTION_KEY),
    refreshTokenEnc: encrypt(input.refreshToken, env.ENCRYPTION_KEY),
    expiresAt: input.expiresAt,
    calendarId: "primary",
  });
}

export async function getConnection() {
  const rows = await db.select().from(googleConnection).limit(1);
  if (rows.length === 0) return null;
  const c = rows[0];
  return {
    ...c,
    accessToken: decrypt(c.accessTokenEnc, env.ENCRYPTION_KEY),
    refreshToken: decrypt(c.refreshTokenEnc, env.ENCRYPTION_KEY),
  };
}

export async function getAuthorizedClient() {
  const conn = await getConnection();
  if (!conn) throw new Error("No google connection");
  const client = makeOAuthClient();
  client.setCredentials({
    access_token: conn.accessToken,
    refresh_token: conn.refreshToken,
    expiry_date: conn.expiresAt.getTime(),
  });
  return client;
}
