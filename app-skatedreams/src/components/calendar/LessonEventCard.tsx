"use client";

import type { EventContentArg } from "@fullcalendar/core";

export function LessonEventCard(arg: EventContentArg) {
  const fg: string = arg.event.extendedProps.fg ?? "#FFFFFF";
  return (
    <div className="px-1 py-0.5 text-xs leading-tight" style={{ color: fg }}>
      <div className="font-semibold truncate">{arg.event.title}</div>
      <div className="text-[10px] opacity-80">{arg.timeText}</div>
    </div>
  );
}
