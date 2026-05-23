import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, eventFlags } from "@/lib/db";
import { FLAG_TYPES, type FlagType } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/guards";
import { getSession } from "@/lib/auth/session";

const bodySchema = z.object({ flagType: z.enum(FLAG_TYPES as [FlagType, ...FlagType[]]) });

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

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await ctx.params;
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  await db
    .delete(eventFlags)
    .where(and(eq(eventFlags.eventId, id), eq(eventFlags.flagType, parsed.data.flagType)));

  return NextResponse.json({ ok: true });
}
