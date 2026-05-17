"use client";

import { useEffect, useState } from "react";
import { listEventsForWeek } from "../actions";
import { SlotCard } from "./SlotCard";

type EventRow = Awaited<ReturnType<typeof listEventsForWeek>>[number];

const DAYS_PT = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function startOfWeekMonday(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const day = out.getDay(); // 0=dom
  const diff = day === 0 ? -6 : 1 - day;
  out.setDate(out.getDate() + diff);
  return out;
}

function fmtRange(start: Date): string {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const sd = start.getDate();
  const ed = end.getDate();
  const sm = MONTHS_PT[start.getMonth()];
  const em = MONTHS_PT[end.getMonth()];
  return sm === em ? `${sd}–${ed} ${sm}` : `${sd} ${sm} – ${ed} ${em}`;
}

function groupEventsByDayAndSlot(events: EventRow[]) {
  // Agrupa por dia (YYYY-MM-DD local) e dentro do dia por starts_at
  const byDay = new Map<string, EventRow[]>();
  for (const e of events) {
    const d = new Date(e.start);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(e);
  }
  // Ordenar dias
  const sortedKeys = [...byDay.keys()].sort();
  return sortedKeys.map((key) => {
    const dayEvents = byDay.get(key)!;
    dayEvents.sort((a, b) => a.start.localeCompare(b.start));
    // Agrupa por slot (mesmo start)
    const slots = new Map<string, EventRow[]>();
    for (const e of dayEvents) {
      if (!slots.has(e.start)) slots.set(e.start, []);
      slots.get(e.start)!.push(e);
    }
    const date = new Date(key + "T00:00:00");
    return {
      key,
      date,
      slots: [...slots.values()],
    };
  });
}

export function MobileAgenda() {
  const [anchor, setAnchor] = useState<Date>(() => startOfWeekMonday(new Date()));
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listEventsForWeek(anchor.toISOString())
      .then((r) => setEvents(r))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [anchor]);

  const days = events ? groupEventsByDayAndSlot(events) : [];

  return (
    <div className="space-y-4">
      <div className="sticky top-16 z-30 bg-brand-sky-soft/80 backdrop-blur-lg -mx-4 px-4 py-3 border-b border-brand-sky flex items-center justify-between gap-2">
        <button
          onClick={() => {
            const prev = new Date(anchor);
            prev.setDate(prev.getDate() - 7);
            setAnchor(prev);
          }}
          aria-label="Semana anterior"
          className="h-10 w-10 rounded-full bg-brand-cloud ring-1 ring-brand-ink/10 flex items-center justify-center hover:ring-brand-primary/30 transition-colors"
        >
          ◀
        </button>
        <div className="flex flex-col items-center">
          <span className="font-display text-base text-brand-ink leading-tight">{fmtRange(anchor)}</span>
          <button
            onClick={() => setAnchor(startOfWeekMonday(new Date()))}
            className="text-xs text-brand-muted hover:text-brand-primary"
          >
            ir para hoje
          </button>
        </div>
        <button
          onClick={() => {
            const next = new Date(anchor);
            next.setDate(next.getDate() + 7);
            setAnchor(next);
          }}
          aria-label="Próxima semana"
          className="h-10 w-10 rounded-full bg-brand-cloud ring-1 ring-brand-ink/10 flex items-center justify-center hover:ring-brand-primary/30 transition-colors"
        >
          ▶
        </button>
      </div>

      {loading && (
        <div className="text-center py-12 text-brand-muted text-sm">Carregando…</div>
      )}

      {!loading && days.length === 0 && (
        <div className="bg-brand-cloud rounded-2xl shadow-soft-md p-8 text-center text-brand-muted">
          Nenhuma aula nesta semana.
        </div>
      )}

      {days.map((day) => (
        <section key={day.key} className="space-y-3">
          <h2 className="font-display text-xl text-brand-ink flex items-baseline gap-2 px-1">
            <span className="text-brand-primary uppercase tracking-wider text-xs">
              {DAYS_PT[day.date.getDay()]}
            </span>
            <span>{day.date.getDate()} {MONTHS_PT[day.date.getMonth()]}</span>
          </h2>
          {day.slots.map((slot, i) => (
            <SlotCard key={`${day.key}-${i}`} events={slot} />
          ))}
        </section>
      ))}
    </div>
  );
}
