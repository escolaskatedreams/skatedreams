import Link from "next/link";
import { getConnection } from "@/lib/google/connection";

function fmt(d: Date | null): string {
  if (!d) return "—";
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h}h`;
}

export async function Topbar() {
  const conn = await getConnection();

  return (
    <header className="border-b border-brand-sky bg-brand-cloud">
      <nav className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/agenda" className="flex items-center gap-2 font-bold font-display text-xl text-brand-ink">
            <img src="/skatedreams-logo.jpg" alt="" className="w-8 h-8 rounded-full" />
            SkateDreams
          </Link>
          <Link href="/agenda" className="text-sm hover:underline">
            Agenda
          </Link>
          <Link href="/relatorios" className="text-sm hover:underline">
            Relatórios
          </Link>
          <Link href="/config" className="text-sm hover:underline">
            Config
          </Link>
        </div>
        <div className="text-xs text-brand-muted">
          {conn ? `Última sync: ${fmt(conn.lastSyncAt)}` : "Google não conectado"}
        </div>
      </nav>
    </header>
  );
}
