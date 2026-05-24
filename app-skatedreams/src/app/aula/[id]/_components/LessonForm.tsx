"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FlagBar } from "@/app/agenda/_components/FlagBar";

type Props = {
  event: {
    id: string;
    title: string;
    notes: string | null;
    startsAt: string;
    endsAt: string;
    status: "confirmed" | "cancelled";
    flags: string[];
  };
};

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

const inputClass = "w-full bg-brand-sky-soft border-0 rounded-xl px-4 py-3 font-body focus:ring-2 focus:ring-brand-primary focus:bg-brand-cloud transition-all outline-none";
const lockedClass = "w-full bg-brand-ink/5 border-0 rounded-xl px-4 py-3 font-body text-brand-muted cursor-not-allowed outline-none";

export function LessonForm({ event }: Props) {
  const router = useRouter();
  const [notes, setNotes] = useState(event.notes ?? "");
  const [saving, setSaving] = useState(false);

  const startsLocal = toLocalInput(event.startsAt);
  const endsLocal = toLocalInput(event.endsAt);

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/events/${event.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
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
        <input value={event.title} readOnly className={lockedClass} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-brand-ink mb-1.5 uppercase tracking-wider">Início</label>
          <input type="datetime-local" value={startsLocal} readOnly className={lockedClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-brand-ink mb-1.5 uppercase tracking-wider">Fim</label>
          <input type="datetime-local" value={endsLocal} readOnly className={lockedClass} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-brand-ink mb-1.5 uppercase tracking-wider">Anotação</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} rows={3} />
      </div>

      <div>
        <p className="text-xs font-medium text-brand-ink mb-2 uppercase tracking-wider">Flags</p>
        <FlagBar eventId={event.id} initialFlags={event.flags} size="md" />
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
