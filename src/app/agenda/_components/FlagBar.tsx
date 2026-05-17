"use client";

import { useState } from "react";

const FLAG_DEFS = [
  { type: "student_absent", icon: "❌", label: "Aluno faltou", color: "bg-brand-danger border-brand-danger text-brand-cloud" },
  { type: "teacher_late", icon: "⏱️", label: "Atraso prof.", color: "bg-brand-warn border-brand-warn text-brand-ink" },
  { type: "teacher_very_late", icon: "⏱️⏱️", label: "Atraso grave", color: "bg-brand-danger border-brand-danger text-brand-cloud" },
  { type: "teacher_unmotivated", icon: "😐", label: "Desanimado", color: "bg-brand-muted border-brand-muted text-brand-cloud" },
  { type: "students_disengaged", icon: "😭", label: "Sem engajamento", color: "bg-brand-warn border-brand-warn text-brand-ink" },
] as const;

export function FlagBar({ eventId, initialFlags }: { eventId: string; initialFlags: string[] }) {
  const [flags, setFlags] = useState<Set<string>>(new Set(initialFlags));
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(type: string) {
    setBusy(type);
    const has = flags.has(type);
    const next = new Set(flags);
    if (has) next.delete(type); else next.add(type);
    setFlags(next);
    try {
      const res = await fetch(`/api/events/${eventId}/flags`, {
        method: has ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flagType: type }),
      });
      if (!res.ok) throw new Error("flag toggle failed");
    } catch {
      // rollback
      setFlags(new Set(initialFlags));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {FLAG_DEFS.map((f) => {
        const active = flags.has(f.type);
        const isBusy = busy === f.type;
        return (
          <button
            key={f.type}
            type="button"
            onClick={() => toggle(f.type)}
            aria-pressed={active}
            aria-label={f.label}
            className={`h-14 min-w-14 px-3 rounded-2xl text-2xl flex items-center justify-center transition-all active:animate-scale-press ${
              active
                ? `${f.color} shadow-soft-md`
                : "bg-brand-sky-soft ring-1 ring-brand-ink/10 hover:ring-brand-primary/30"
            } ${isBusy ? "opacity-50" : ""}`}
          >
            {f.icon}
          </button>
        );
      })}
    </div>
  );
}
