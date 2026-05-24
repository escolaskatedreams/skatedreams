import Link from "next/link";
import { requireSession } from "@/lib/auth/guards";
import { CalendarView } from "./_components/CalendarView";
import { MobileAgenda } from "./_components/MobileAgenda";

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ cancelados?: string }>;
}) {
  await requireSession();
  const sp = await searchParams;
  const showCancelled = sp.cancelados === "1";

  return (
    <main className="max-w-7xl mx-auto p-4 space-y-3">
      <div className="hidden md:flex pointer-coarse:landscape:max-lg:hidden items-center justify-end">
        <Link
          href={showCancelled ? "/agenda" : "/agenda?cancelados=1"}
          className="text-xs font-medium px-3 py-1.5 rounded-full bg-brand-cloud ring-1 ring-brand-ink/10 text-brand-muted hover:text-brand-ink hover:ring-brand-primary/30 transition-all shadow-soft"
        >
          {showCancelled ? "Esconder cancelados" : "Mostrar cancelados"}
        </Link>
      </div>

      <div className="hidden md:block pointer-coarse:landscape:max-lg:hidden">
        <CalendarView showCancelled={showCancelled} />
      </div>
      <div className="md:hidden pointer-coarse:landscape:max-lg:block">
        <MobileAgenda />
      </div>
    </main>
  );
}
