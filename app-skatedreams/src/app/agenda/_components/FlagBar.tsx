"use client";

import { useState } from "react";

const FLAG_DEFS = [
  { type: "student_absent", icon: "❌", label: "Aluno faltou", activeClass: "bg-brand-danger text-brand-cloud border-brand-danger" },
  { type: "teacher_late", icon: "⏱️", label: "Atraso prof.", activeClass: "bg-brand-warn text-brand-ink border-brand-warn" },
  { type: "teacher_very_late", icon: "⏱️⏱️", label: "Atraso grave", activeClass: "bg-brand-danger text-brand-cloud border-brand-danger" },
  { type: "teacher_unmotivated", icon: "😐", label: "Desanimado", activeClass: "bg-brand-muted text-brand-cloud border-brand-muted" },
  { type: "students_disengaged", icon: "😭", label: "Sem engajamento", activeClass: "bg-brand-warn text-brand-ink border-brand-warn" },
] as const;

type Props = {
  eventId: string;
  initialFlags: string[];
  onChange?: (next: string[]) => void;
  onTitleChange?: (title: string) => void;
  size?: "sm" | "md";
};

export function FlagBar({ eventId, initialFlags, onChange, onTitleChange, size = "md" }: Props) {
  const [flags, setFlags] = useState<Set<string>>(new Set(initialFlags));
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(type: string) {
    setBusy(type);
    const has = flags.has(type);
    const next = new Set(flags);
    if (has) next.delete(type); else next.add(type);
    setFlags(next);
    onChange?.([...next]);
    try {
      const res = await fetch(`/api/events/${eventId}/flags`, {
        method: has ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flagType: type }),
      });
      if (!res.ok) throw new Error("flag toggle failed");
      const data = (await res.json()) as { title?: string | null };
      if (data.title) {
        onTitleChange?.(data.title);
        window.dispatchEvent(
          new CustomEvent("event-title-changed", { detail: { eventId, title: data.title } }),
        );
      }
    } catch {
      setFlags(new Set(initialFlags));
      onChange?.(initialFlags);
    } finally {
      setBusy(null);
    }
  }

  const chipBase = size === "sm"
    ? "h-9 px-2.5 gap-1.5 text-xs"
    : "h-11 px-3.5 gap-2 text-sm";
  const iconSize = size === "sm" ? "text-base" : "text-lg";

  return (
    <div className="flex flex-wrap gap-1.5">
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
            className={`inline-flex items-center font-medium rounded-full border transition-all active:animate-scale-press ${chipBase} ${
              active
                ? `${f.activeClass} shadow-soft`
                : "bg-brand-sky-soft border-transparent text-brand-muted hover:text-brand-ink hover:bg-brand-cloud hover:border-brand-ink/10"
            } ${isBusy ? "opacity-60" : ""}`}
          >
            <span className={`leading-none ${iconSize}`}>{f.icon}</span>
            <span className="leading-none whitespace-nowrap">{f.label}</span>
          </button>
        );
      })}
    </div>
  );
}
