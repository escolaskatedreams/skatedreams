"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { db, googleConnection } from "@/lib/db";
import { buildAuthUrl } from "@/lib/google/oauth-client";
import { getSession } from "@/lib/auth/session";
import { requireSession } from "@/lib/auth/guards";

export async function startGoogleOAuth() {
  await requireSession();
  const session = await getSession();
  const state = randomBytes(16).toString("hex");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (session as any).oauthState = state;
  await session.save();
  const url = buildAuthUrl(state);
  redirect(url);
}

export async function disconnectGoogle() {
  await requireSession();
  await db.delete(googleConnection);
  redirect("/config");
}

export async function logoutAction() {
  const session = await getSession();
  session.destroy();
  redirect("/login");
}
