import { describe, it, expect, beforeEach } from "vitest";
import { testDb, reset } from "../_helpers/db";
import { users, calendarEvents, eventFlags, type FlagType } from "@/lib/db/schema";
import { aggregateByStudent } from "@/lib/reports/aggregate";

let userId: string;

beforeEach(async () => {
  await reset();
  const [u] = await testDb
    .insert(users)
    .values({
      email: "t@t.t",
      passwordHash: "x",
      role: "admin",
    })
    .returning();
  userId = u.id;
});

async function makeEvent(opts: {
  gid: string;
  title: string;
  student: string | null;
  date: string;
  flags?: FlagType[];
}) {
  const [e] = await testDb
    .insert(calendarEvents)
    .values({
      googleId: opts.gid,
      title: opts.title,
      studentName: opts.student,
      startsAt: new Date(opts.date),
      endsAt: new Date(new Date(opts.date).getTime() + 3600000),
    })
    .returning();
  for (const f of opts.flags ?? []) {
    await testDb.insert(eventFlags).values({ eventId: e.id, flagType: f, createdBy: userId });
  }
  return e;
}

describe("aggregateByStudent", () => {
  it("agrupa aulas e flags por aluno", async () => {
    await makeEvent({
      gid: "1",
      title: "Aula — Lucas — 16h",
      student: "Lucas",
      date: "2026-05-12T16:00:00Z",
      flags: ["student_absent"],
    });
    await makeEvent({
      gid: "2",
      title: "Aula — Lucas — 17h",
      student: "Lucas",
      date: "2026-05-13T17:00:00Z",
      flags: ["teacher_late"],
    });
    await makeEvent({
      gid: "3",
      title: "Aula — Maria — 10h",
      student: "Maria",
      date: "2026-05-12T10:00:00Z",
    });

    const r = await aggregateByStudent({
      db: testDb,
      from: new Date("2026-05-01"),
      to: new Date("2026-06-01"),
    });
    const lucas = r.find((row) => row.student === "Lucas");
    const maria = r.find((row) => row.student === "Maria");
    expect(lucas?.totalLessons).toBe(2);
    expect(lucas?.flags.student_absent).toBe(1);
    expect(lucas?.flags.teacher_late).toBe(1);
    expect(maria?.totalLessons).toBe(1);
    expect(maria?.flags.student_absent).toBe(0);
  });

  it("ignora eventos sem student_name", async () => {
    await makeEvent({
      gid: "4",
      title: "Reunião",
      student: null,
      date: "2026-05-12T09:00:00Z",
    });
    const r = await aggregateByStudent({
      db: testDb,
      from: new Date("2026-05-01"),
      to: new Date("2026-06-01"),
    });
    expect(r.find((row) => row.student === null)).toBeUndefined();
  });
});
