"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  event: {
    id: string;
    title: string;
    description: string | null;
    startsAt: string;
    endsAt: string;
    status: "confirmed" | "cancelled";
    flags: string[];
  };
};

const FLAG_DEFS = [
  { type: "student_absent", icon: "❌", label: "Aluno não veio" },
  { type: "teacher_late", icon: "⏱️", label: "Atraso professor" },
  { type: "teacher_very_late", icon: "⏱️⏱️", label: "Atraso grave" },
  { type: "teacher_unmotivated", icon: "😐", label: "Professor desanimado" },
  { type: "students_disengaged", icon: "😭", label: "Alunos não engajados" },
] as const;

const FLAG_COLORS: Record<string, string> = {
  student_absent: "bg-brand-danger shadow-soft-md ring-brand-danger/30",
  teacher_late: "bg-brand-warn shadow-soft-md ring-brand-warn/30 text-brand-ink",
  teacher_very_late: "bg-brand-danger shadow-soft-md ring-brand-danger/30",
  teacher_unmotivated: "bg-brand-muted shadow-soft-md ring-brand-muted/30",
  students_disengaged: "bg-brand-warn shadow-soft-md ring-brand-warn/30 text-brand-ink",
};

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

const inputClass = "w-full bg-brand-sky-soft border-0 rounded-xl px-4 py-3 font-body focus:ring-2 focus:ring-brand-primary focus:bg-brand-cloud transition-all outline-none";

export function LessonForm({ event }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description ?? "");
  const [startsAt, setStartsAt] = useState(toLocalInput(event.startsAt));
  const [endsAt, setEndsAt] = useState(toLocalInput(event.endsAt));
  const [flags, setFlags] = useState<Set<string>>(new Set(event.flags));
  const [saving, setSaving] = useState(false);

  async function toggleFlag(type: string) {
    const next = new Set(flags);
    const method = next.has(type) ? "DELETE" : "POST";
    if (method === "DELETE") next.delete(type);
    else next.add(type);
    setFlags(next);
    const res = await fetch(`/api/events/${event.id}/flags`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flagType: type }),
    });
    if (!res.ok) {
      setFlags(new Set(event.flags));
      alert("Erro ao salvar flag.");
    }
  }

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/events/${event.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      alert("Erro ao salvar.");
      return;
    }
    router.refresh();
    router.back();
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-brand-ink mb-1.5 uppercase tracking-wider">Título</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-brand-ink mb-1.5 uppercase tracking-wider">Início</label>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-brand-ink mb-1.5 uppercase tracking-wider">Fim</label>
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-brand-ink mb-1.5 uppercase tracking-wider">Descrição</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} rows={3} />
      </div>

      <div>
        <p className="text-xs font-medium text-brand-ink mb-2 uppercase tracking-wider">Flags</p>
        <div className="flex flex-wrap gap-2">
          {FLAG_DEFS.map((f) => {
            const active = flags.has(f.type);
            return (
              <button
                key={f.type}
                type="button"
                onClick={() => toggleFlag(f.type)}
                className={`min-w-16 h-16 px-3 rounded-2xl text-xl flex items-center justify-center ring-1 transition-all ${
                  active
                    ? `${FLAG_COLORS[f.type]} text-white`
                    : "bg-brand-cloud ring-brand-ink/10 hover:ring-brand-ink/20 shadow-soft"
                }`}
                aria-pressed={active}
                title={f.label}
              >
                {f.icon}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="bg-brand-primary text-brand-cloud px-5 py-2.5 rounded-full font-semibold hover:bg-brand-primary-strong shadow-glow active:animate-scale-press transition-all disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-2.5 rounded-full border border-brand-sky text-brand-muted hover:text-brand-ink hover:border-brand-ink/20 transition-colors"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
