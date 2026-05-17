"use client";

import type { EventContentArg } from "@fullcalendar/core";

const ICON: Record<string, string> = {
  student_absent: "❌",
  teacher_late: "⏱️",
  teacher_very_late: "⏱️⏱️",
  teacher_unmotivated: "😐",
  students_disengaged: "😭",
};

export function LessonEventCard(arg: EventContentArg) {
  const flags: string[] = arg.event.extendedProps.flags ?? [];
  const student = arg.event.extendedProps.studentName ?? null;
  const fg: string = arg.event.extendedProps.fg ?? "#FFFFFF";
  return (
    <div className="px-1 py-0.5 text-xs leading-tight" style={{ color: fg }}>
      <div className="font-semibold truncate">{student ?? arg.event.title}</div>
      <div className="text-[10px] opacity-80">{arg.timeText}</div>
      {flags.length > 0 && (
        <div className="mt-0.5 text-sm">{flags.map((f) => ICON[f] ?? "").join(" ")}</div>
      )}
    </div>
  );
}
