import { requireSession } from "@/lib/auth/guards";
import { CalendarView } from "./_components/CalendarView";

export default async function AgendaPage() {
  await requireSession();
  return (
    <main className="max-w-7xl mx-auto p-4">
      <CalendarView />
    </main>
  );
}
