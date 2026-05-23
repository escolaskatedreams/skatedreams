"use server";

import { db } from "@/lib/db";
import { aggregateByStudent } from "@/lib/reports/aggregate";
import { requireSession } from "@/lib/auth/guards";

export async function getReport(fromISO: string, toISO: string) {
  await requireSession();
  return aggregateByStudent({
    db,
    from: new Date(fromISO),
    to: new Date(toISO),
  });
}
