import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, calendarEvents } from "@/lib/db";
import { requireSession } from "@/lib/auth/guards";

const bodySchema = z.object({
  notes: z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await ctx.params;
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.format() }, { status: 400 });

  const [existing] = await db.select().from(calendarEvents).where(eq(calendarEvents.id, id));
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await db
    .update(calendarEvents)
    .set({ notes: parsed.data.notes ?? null })
    .where(eq(calendarEvents.id, id));

  return NextResponse.json({ ok: true });
}
