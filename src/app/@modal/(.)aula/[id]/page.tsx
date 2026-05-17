import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/guards";
import { db, calendarEvents, eventFlags } from "@/lib/db";
import { eq } from "drizzle-orm";
import { LessonForm } from "@/app/aula/[id]/_components/LessonForm";

export default async function LessonModal({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const [event] = await db.select().from(calendarEvents).where(eq(calendarEvents.id, id));
  if (!event) notFound();
  const flags = await db.select().from(eventFlags).where(eq(eventFlags.eventId, id));

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <h2 className="text-xl font-bold mb-4">Aula</h2>
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
      </div>
    </div>
  );
}
