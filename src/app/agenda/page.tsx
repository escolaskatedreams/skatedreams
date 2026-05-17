import Link from "next/link";
import { requireSession } from "@/lib/auth/guards";
import { CalendarView } from "./_components/CalendarView";

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ cancelados?: string }>;
}) {
  await requireSession();
  const sp = await searchParams;
  const showCancelled = sp.cancelados === "1";

  return (
    <main className="max-w-7xl mx-auto p-4 space-y-2">
      <div className="flex items-center justify-end text-xs text-brand-muted">
        {showCancelled ? (
          <Link href="/agenda" className="underline">
            Esconder cancelados
          </Link>
        ) : (
          <Link href="/agenda?cancelados=1" className="underline">
            Mostrar cancelados
          </Link>
        )}
      </div>
      <CalendarView showCancelled={showCancelled} />
    </main>
  );
}
