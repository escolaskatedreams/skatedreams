import Link from "next/link";
import Image from "next/image";
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
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-brand-cloud/70 border-b border-brand-sky">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/agenda" className="flex items-center gap-3 group">
          <Image
            src="/skatedreams-logo.jpg"
            alt=""
            width={40}
            height={40}
            className="rounded-2xl object-cover shadow-soft-md ring-1 ring-brand-ink/5 group-hover:shadow-soft-lg transition-shadow"
          />
          <span className="font-display text-xl text-brand-ink tracking-tight">
            skate<span className="text-brand-primary">dreams</span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          <NavLink href="/agenda">Agenda</NavLink>
          <NavLink href="/relatorios">Relatórios</NavLink>
          <NavLink href="/config">Config</NavLink>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-brand-sky-soft rounded-full text-xs">
            <span className={`w-2 h-2 rounded-full ${conn ? "bg-brand-success" : "bg-brand-muted"}`} />
            <span className="text-brand-muted font-medium">
              {conn ? `sync ${fmt(conn.lastSyncAt)}` : "desconectado"}
            </span>
          </div>
        </div>
      </nav>

      <div className="md:hidden flex items-center gap-1 px-4 pb-2 overflow-x-auto">
        <NavLink href="/agenda">Agenda</NavLink>
        <NavLink href="/relatorios">Relatórios</NavLink>
        <NavLink href="/config">Config</NavLink>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 rounded-full text-sm font-medium text-brand-ink/80 hover:text-brand-ink hover:bg-brand-sky-soft transition-colors"
    >
      {children}
    </Link>
  );
}
