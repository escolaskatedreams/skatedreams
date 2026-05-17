import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { makeOAuthClient } from "@/lib/google/oauth-client";
import { saveConnection } from "@/lib/google/connection";
import { getSession } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.userId) return NextResponse.redirect(new URL("/login", req.url));

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const expected = (session as any).oauthState as string | undefined;

  if (!code || !state || state !== expected) {
    return NextResponse.redirect(new URL("/config?error=invalid_state", req.url));
  }

  const client = makeOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const me = await oauth2.userinfo.get();

  if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
    return NextResponse.redirect(new URL("/config?error=missing_tokens", req.url));
  }

  await saveConnection({
    googleEmail: me.data.email ?? "unknown@unknown",
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: new Date(tokens.expiry_date),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (session as any).oauthState = undefined;
  await session.save();

  return NextResponse.redirect(new URL("/config?connected=1", req.url));
}
