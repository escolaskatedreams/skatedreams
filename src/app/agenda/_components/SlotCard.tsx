"use client";

import { useState } from "react";
import Link from "next/link";
import { colorForEvent } from "@/lib/google/colors";
import { useSwipe } from "@/lib/hooks/useSwipe";
import { FlagBar } from "./FlagBar";

type SlotEvent = {
  id: string;
  title: string;
  studentName: string | null;
  start: string;
  end: string;
  status: "confirmed" | "cancelled";
  googleColorId: string | null;
  flags: string[];
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function SlotCard({ events }: { events: SlotEvent[] }) {
  const [idx, setIdx] = useState(0);
  const total = events.length;
  const ev = events[idx];
  const { bg, fg } = colorForEvent(ev.googleColorId, ev.status);

  const goNext = () => setIdx((i) => (i + 1) % total);
  const goPrev = () => setIdx((i) => (i - 1 + total) % total);
  const { ref, handlers } = useSwipe({ onLeft: goNext, onRight: goPrev });

  return (
    <article className="bg-brand-cloud rounded-2xl shadow-soft-md ring-1 ring-brand-ink/5 overflow-hidden animate-fade-in-up">
      <header className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="font-mono text-sm text-brand-muted">
          {fmtTime(ev.start)} – {fmtTime(ev.end)}
        </div>
        {total > 1 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-brand-sky-soft text-brand-muted font-medium">
            {total} aulas
          </span>
        )}
      </header>

      <div
        ref={ref}
        {...handlers}
        className="mx-4 mb-4 rounded-xl px-4 py-3 transition-colors touch-pan-y select-none"
        style={{ background: bg, color: fg }}
      >
        <div className="font-display text-lg leading-tight">
          {ev.studentName ?? ev.title}
        </div>
        {ev.studentName && ev.title !== ev.studentName && (
          <div className="text-xs opacity-80 mt-0.5 truncate">{ev.title}</div>
        )}
        {total > 1 && (
          <div className="text-[10px] opacity-70 mt-1 font-medium">
            ← arraste para trocar de aula →
          </div>
        )}
      </div>

      <div className="px-4 pb-4">
        <FlagBar eventId={ev.id} initialFlags={ev.flags} size="md" />
      </div>

      {total > 1 && (
        <div className="px-4 pb-4 flex items-center justify-between">
          <button
            onClick={goPrev}
            aria-label="Anterior"
            className="h-10 w-10 rounded-full bg-brand-sky-soft hover:bg-brand-sky text-brand-ink flex items-center justify-center active:animate-scale-press transition-colors"
          >
            ◀
          </button>
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-xs font-medium text-brand-muted">
              {idx + 1} de {total}
            </span>
            <div className="flex gap-1">
              {events.map((_, i) => (
                <span
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${
                    i === idx ? "bg-brand-primary" : "bg-brand-ink/15"
                  }`}
                />
              ))}
            </div>
          </div>
          <button
            onClick={goNext}
            aria-label="Próximo"
            className="h-10 w-10 rounded-full bg-brand-sky-soft hover:bg-brand-sky text-brand-ink flex items-center justify-center active:animate-scale-press transition-colors"
          >
            ▶
          </button>
        </div>
      )}

      <Link
        href={`/aula/${ev.id}`}
        className="block px-4 py-2 text-xs text-center text-brand-muted hover:text-brand-primary border-t border-brand-sky transition-colors"
      >
        editar detalhes →
      </Link>
    </article>
  );
}
