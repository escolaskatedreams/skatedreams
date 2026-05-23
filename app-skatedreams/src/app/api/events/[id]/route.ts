import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, calendarEvents } from "@/lib/db";
import { requireSession } from "@/lib/auth/guards";
import { getAuthorizedClient } from "@/lib/google/connection";
import { getCalendarId } from "@/lib/google/auth";
import { patchEvent } from "@/lib/google/calendar";
import { parseStudentName } from "@/lib/sync/parse-student-name";

const bodySchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await ctx.params;
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.format() }, { status: 400 });

  const [existing] = await db.select().from(calendarEvents).where(eq(calendarEvents.id, id));
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const startsAt = new Date(parsed.data.startsAt);
  const endsAt = new Date(parsed.data.endsAt);
  const client = await getAuthorizedClient();
  const r = await patchEvent(client, existing.googleId, {
    title: parsed.data.title,
    description: parsed.data.description ?? undefined,
    startsAt,
    endsAt,
  }, getCalendarId());

  await db
    .update(calendarEvents)
    .set({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      startsAt,
      endsAt,
      studentName: parseStudentName(parsed.data.title),
      googleEtag: r.etag ?? existing.googleEtag,
      syncedAt: new Date(),
    })
    .where(eq(calendarEvents.id, id));

  return NextResponse.json({ ok: true });
}
