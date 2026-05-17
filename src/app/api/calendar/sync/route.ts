import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/guards";
import { runSync } from "@/lib/sync/run";

export async function POST() {
  await requireSession();
  const r = await runSync();
  return NextResponse.json(r);
}
