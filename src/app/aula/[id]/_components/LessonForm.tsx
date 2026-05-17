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
  student_absent: "bg-brand-danger border-brand-danger",
  teacher_late: "bg-brand-warn border-brand-warn text-brand-ink",
  teacher_very_late: "bg-brand-danger border-brand-danger",
  teacher_unmotivated: "bg-brand-muted border-brand-muted",
  students_disengaged: "bg-brand-warn border-brand-warn text-brand-ink",
};

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

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
        <label className="block text-sm mb-1">Título</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border rounded px-3 py-2" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm mb-1">Início</label>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Fim</label>
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm mb-1">Descrição</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border rounded px-3 py-2" rows={3} />
      </div>

      <div>
        <p className="text-sm font-medium mb-2">Flags</p>
        <div className="flex flex-wrap gap-2">
          {FLAG_DEFS.map((f) => {
            const active = flags.has(f.type);
            return (
              <button
                key={f.type}
                type="button"
                onClick={() => toggleFlag(f.type)}
                className={`min-w-14 h-14 px-3 rounded-lg border text-xl flex items-center justify-center ${
                  active ? `${FLAG_COLORS[f.type]} text-white` : "bg-white"
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
        <button onClick={save} disabled={saving} className="bg-brand-primary text-brand-cloud px-4 py-2 rounded hover:bg-brand-primary-strong">
          {saving ? "Salvando..." : "Salvar"}
        </button>
        <button type="button" onClick={() => router.back()} className="px-4 py-2 rounded border">
          Fechar
        </button>
      </div>
    </div>
  );
}
