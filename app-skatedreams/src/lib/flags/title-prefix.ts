import type { FlagType } from "@/lib/db/schema";

export const FLAG_ORDER: FlagType[] = [
  "student_absent",
  "teacher_late",
  "teacher_very_late",
  "teacher_unmotivated",
  "students_disengaged",
];

export const FLAG_ICONS: Record<FlagType, string> = {
  student_absent: "❌",
  teacher_late: "⏱️",
  teacher_very_late: "⏱️⏱️",
  teacher_unmotivated: "😐",
  students_disengaged: "😭",
};

// ⏱️⏱️ precisa vir antes de ⏱️ pra não consumir só metade do token.
const PREFIX_RE = /^(?:(?:❌|⏱️⏱️|⏱️|😐|😭) )+/;

export function stripFlagPrefix(title: string): string {
  return title.replace(PREFIX_RE, "");
}

export function buildTitleWithFlags(baseTitle: string, flags: FlagType[]): string {
  const clean = stripFlagPrefix(baseTitle);
  if (flags.length === 0) return clean;
  const set = new Set(flags);
  const icons = FLAG_ORDER.filter((f) => set.has(f)).map((f) => FLAG_ICONS[f]);
  return `${icons.join(" ")} ${clean}`;
}
