"use client";

import { useEffect, useState } from "react";
import { useSwipe } from "@/lib/hooks/useSwipe";
import { listEventsBetween } from "../actions";
import { SlotCard } from "./SlotCard";

type EventRow = Awaited<ReturnType<typeof listEventsBetween>>[number];

const DAYS_LONG = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function endOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(23, 59, 59, 999);
  return out;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function fmtDayLabel(d: Date): { weekday: string; date: string } {
  const today = startOfDay(new Date());
  const target = startOfDay(d);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  let weekday: string;
  if (diff === 0) weekday = "hoje";
  else if (diff === 1) weekday = "amanhã";
  else if (diff === -1) weekday = "ontem";
  else weekday = DAYS_LONG[d.getDay()];
  return { weekday, date: `${d.getDate()} ${MONTHS_PT[d.getMonth()]}` };
}

function groupBySlot(events: EventRow[]): EventRow[][] {
  const sorted = [...events].sort((a, b) => a.start.localeCompare(b.start));
  const slots = new Map<string, EventRow[]>();
  for (const e of sorted) {
    if (!slots.has(e.start)) slots.set(e.start, []);
    slots.get(e.start)!.push(e);
  }
  return [...slots.values()];
}

export function MobileAgenda() {
  const [anchor, setAnchor] = useState<Date>(() => startOfDay(new Date()));
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  const goPrev = () => {
    const prev = new Date(anchor);
    prev.setDate(prev.getDate() - 1);
    setAnchor(prev);
  };
  const goNext = () => {
    const next = new Date(anchor);
    next.setDate(next.getDate() + 1);
    setAnchor(next);
  };

  // Swipe entre dias quando o gesto começa numa área "não-interativa" do dia.
  const { ref, handlers } = useSwipe({ onLeft: goNext, onRight: goPrev });

  useEffect(() => {
    setLoading(true);
    listEventsBetween(startOfDay(anchor).toISOString(), endOfDay(anchor).toISOString())
      .then((r) => setEvents(r))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [anchor]);

  const slots = events ? groupBySlot(events) : [];
  const label = fmtDayLabel(anchor);
  const isToday = isSameDay(anchor, new Date());

  return (
    <div ref={ref} {...handlers} className="space-y-4 touch-pan-y">
      <div className="sticky top-16 z-30 bg-brand-sky-soft/80 backdrop-blur-lg -mx-4 px-4 py-3 border-b border-brand-sky flex items-center justify-between gap-2">
        <button
          onClick={goPrev}
          aria-label="Dia anterior"
          className="h-10 w-10 rounded-full bg-brand-cloud ring-1 ring-brand-ink/10 flex items-center justify-center hover:ring-brand-primary/30 transition-colors"
        >
          ◀
        </button>
        <div className="flex flex-col items-center">
          <span className="font-display text-base text-brand-ink leading-tight capitalize">
            {label.weekday}
          </span>
          <span className="text-xs text-brand-muted">
            {label.date}
            {!isToday && (
              <>
                {" · "}
                <button
                  onClick={() => setAnchor(startOfDay(new Date()))}
                  className="text-brand-primary hover:underline"
                >
                  ir para hoje
                </button>
              </>
            )}
          </span>
        </div>
        <button
          onClick={goNext}
          aria-label="Próximo dia"
          className="h-10 w-10 rounded-full bg-brand-cloud ring-1 ring-brand-ink/10 flex items-center justify-center hover:ring-brand-primary/30 transition-colors"
        >
          ▶
        </button>
      </div>

      {loading && (
        <div className="text-center py-12 text-brand-muted text-sm">Carregando…</div>
      )}

      {!loading && slots.length === 0 && (
        <div className="bg-brand-cloud rounded-2xl shadow-soft-md p-8 text-center text-brand-muted">
          Nenhuma aula neste dia.
        </div>
      )}

      <div className="space-y-3">
        {slots.map((slot, i) => (
          <SlotCard key={`${anchor.toISOString()}-${i}`} events={slot} />
        ))}
      </div>

      {!loading && slots.length > 0 && (
        <p className="text-center text-xs text-brand-muted/70 pt-2">
          ← arraste para trocar de dia →
        </p>
      )}
    </div>
  );
}
