"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { requireSession } from "@/lib/auth/guards";
import { runSync } from "@/lib/sync/run";

export async function forceSyncAction() {
  await requireSession();
  await runSync();
  redirect("/config");
}

export async function logoutAction() {
  const session = await getSession();
  session.destroy();
  redirect("/login");
}
