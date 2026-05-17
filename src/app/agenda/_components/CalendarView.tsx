"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LessonEventCard } from "@/components/calendar/LessonEventCard";
import { colorForEvent } from "@/lib/google/colors";
import { FlagBar } from "./FlagBar";
import { listEventsBetween } from "../actions";

type PopoverState = {
  eventId: string;
  studentName: string | null;
  title: string;
  timeText: string;
  initialFlags: string[];
  top: number;
  left: number;
  align: "left" | "right";
};

function fmtTimeRange(start: Date, end: Date) {
  const fmt = (d: Date) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function CalendarView({ showCancelled = false }: { showCancelled?: boolean }) {
  const fcRef = useRef<FullCalendar | null>(null);
  const router = useRouter();
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const hideTimer = useRef<number | null>(null);

  const clearHide = () => {
    if (hideTimer.current !== null) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };
  const scheduleHide = () => {
    clearHide();
    hideTimer.current = window.setTimeout(() => setPopover(null), 180);
  };

  useEffect(() => () => clearHide(), []);

  const fetchEvents = useCallback(
    async (info: { startStr: string; endStr: string }) => {
      const rows = await listEventsBetween(info.startStr, info.endStr, { showCancelled });
      return rows.map((r) => {
        const { bg, fg } = colorForEvent(r.googleColorId, r.status);
        return {
          id: r.id,
          title: r.title,
          start: r.start,
          end: r.end,
          backgroundColor: bg,
          borderColor: bg,
          textColor: fg,
          extendedProps: {
            studentName: r.studentName,
            flags: r.flags,
            status: r.status,
            fg,
          },
        };
      });
    },
    [showCancelled],
  );

  return (
    <>
      <FullCalendar
        ref={fcRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridDay"
        locale="pt-br"
        firstDay={1}
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "",
        }}
        buttonText={{ today: "Hoje" }}
        allDaySlot={false}
        slotMinTime="07:00:00"
        slotMaxTime="22:00:00"
        events={fetchEvents}
        eventContent={LessonEventCard}
        eventClick={(arg) => router.push(`/aula/${arg.event.id}`)}
        eventDidMount={(info) => {
          const el = info.el;
          const ev = info.event;

          const open = () => {
            clearHide();
            const rect = el.getBoundingClientRect();
            const vw = window.innerWidth;
            const popoverWidth = 320;
            // Posiciona diretamente colado na borda direita do card (sem gap).
            // Se não couber à direita, encosta na borda esquerda.
            const fitsRight = rect.right + popoverWidth <= vw - 8;
            const left = fitsRight ? rect.right : rect.left - popoverWidth;
            setPopover({
              eventId: ev.id,
              studentName: (ev.extendedProps.studentName as string | null) ?? null,
              title: ev.title,
              timeText: fmtTimeRange(ev.start ?? new Date(), ev.end ?? new Date()),
              initialFlags: (ev.extendedProps.flags as string[]) ?? [],
              top: rect.top,
              left,
              align: fitsRight ? "left" : "right",
            });
          };

          el.addEventListener("mouseenter", open);
          el.addEventListener("mouseleave", scheduleHide);
        }}
        height="auto"
      />

      {popover && (
        <div
          style={{
            position: "fixed",
            top: popover.top,
            left: popover.left,
            zIndex: 60,
          }}
          onMouseEnter={clearHide}
          onMouseLeave={scheduleHide}
          className="w-80 bg-brand-cloud rounded-2xl shadow-soft-xl ring-1 ring-brand-ink/10 p-4 space-y-3 animate-fade-in-up"
          role="dialog"
          aria-label="Marcar flags"
        >
          <div>
            <div className="font-display text-base text-brand-ink leading-tight">
              {popover.studentName ?? popover.title}
            </div>
            <div className="text-xs text-brand-muted font-mono mt-0.5">{popover.timeText}</div>
          </div>
          <FlagBar
            eventId={popover.eventId}
            initialFlags={popover.initialFlags}
            size="sm"
            onChange={() => {
              // após toggle, atualiza a agenda no background para o evento refletir
              fcRef.current?.getApi().refetchEvents();
            }}
          />
          <Link
            href={`/aula/${popover.eventId}`}
            className="block text-xs text-brand-muted hover:text-brand-primary text-right pt-1"
          >
            editar detalhes →
          </Link>
        </div>
      )}
    </>
  );
}
