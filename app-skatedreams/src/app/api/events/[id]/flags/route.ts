import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, eventFlags, calendarEvents } from "@/lib/db";
import { FLAG_TYPES, type FlagType } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/guards";
import { getSession } from "@/lib/auth/session";
import { getAuthorizedClient } from "@/lib/google/connection";
import { getCalendarId } from "@/lib/google/auth";
import { patchEvent } from "@/lib/google/calendar";
import { buildTitleWithFlags } from "@/lib/flags/title-prefix";

const bodySchema = z.object({ flagType: z.enum(FLAG_TYPES as [FlagType, ...FlagType[]]) });

async function syncTitleToGoogle(eventId: string): Promise<string | null> {
  const [ev] = await db.select().from(calendarEvents).where(eq(calendarEvents.id, eventId));
  if (!ev) return null;
  const rows = await db.select().from(eventFlags).where(eq(eventFlags.eventId, eventId));
  const flags = rows.map((r) => r.flagType);
  const newTitle = buildTitleWithFlags(ev.title, flags);
  if (newTitle === ev.title) return ev.title;
  const client = await getAuthorizedClient();
  const r = await patchEvent(client, ev.googleId, { title: newTitle }, getCalendarId());
  await db
    .update(calendarEvents)
    .set({ title: newTitle, googleEtag: r.etag ?? ev.googleEtag, syncedAt: new Date() })
    .where(eq(calendarEvents.id, eventId));
  return newTitle;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await ctx.params;
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const session = await getSession();

  await db
    .insert(eventFlags)
    .values({ eventId: id, flagType: parsed.data.flagType, createdBy: session.userId! })
    .onConflictDoNothing();

  const title = await syncTitleToGoogle(id);
  return NextResponse.json({ ok: true, title });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await ctx.params;
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  await db
    .delete(eventFlags)
    .where(and(eq(eventFlags.eventId, id), eq(eventFlags.flagType, parsed.data.flagType)));

  const title = await syncTitleToGoogle(id);
  return NextResponse.json({ ok: true, title });
}
