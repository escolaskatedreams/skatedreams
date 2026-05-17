"use client";

import { useCallback, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { useRouter } from "next/navigation";
import { LessonEventCard } from "@/components/calendar/LessonEventCard";
import { colorForEvent } from "@/lib/google/colors";
import { listEventsBetween } from "../actions";

export function CalendarView({ showCancelled = false }: { showCancelled?: boolean }) {
  const ref = useRef<FullCalendar | null>(null);
  const router = useRouter();

  const fetchEvents = useCallback(async (info: { startStr: string; endStr: string }) => {
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
  }, [showCancelled]);

  return (
    <FullCalendar
      ref={ref}
      plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
      initialView="timeGridWeek"
      locale="pt-br"
      firstDay={1}
      headerToolbar={{
        left: "prev,next today",
        center: "title",
        right: "dayGridMonth,timeGridWeek,timeGridDay",
      }}
      buttonText={{ today: "Hoje", month: "Mês", week: "Semana", day: "Dia" }}
      allDaySlot={false}
      slotMinTime="07:00:00"
      slotMaxTime="22:00:00"
      events={fetchEvents}
      eventContent={LessonEventCard}
      eventClick={(arg) => router.push(`/aula/${arg.event.id}`)}
      height="auto"
    />
  );
}
