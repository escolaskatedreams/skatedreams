import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/guards";
import { db, calendarEvents, eventFlags } from "@/lib/db";
import { eq } from "drizzle-orm";
import { LessonForm } from "./_components/LessonForm";

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const [event] = await db.select().from(calendarEvents).where(eq(calendarEvents.id, id));
  if (!event) notFound();
  const flags = await db.select().from(eventFlags).where(eq(eventFlags.eventId, id));

  return (
    <main className="max-w-2xl mx-auto p-6">
      <h1 className="font-display text-3xl text-brand-ink mb-6">Aula</h1>
      <LessonForm
        event={{
          id: event.id,
          title: event.title,
          description: event.description,
          startsAt: event.startsAt.toISOString(),
          endsAt: event.endsAt.toISOString(),
          status: event.status,
          flags: flags.map((f) => f.flagType),
        }}
      />
    </main>
  );
}
