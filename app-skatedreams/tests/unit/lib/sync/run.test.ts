import { describe, it, expect, vi } from "vitest";

// Mock módulos com side-effects de ambiente/DB antes de importar run.ts
vi.mock("@/env", () => ({
  env: {
    DATABASE_URL: "postgresql://x:x@localhost/x",
    ENCRYPTION_KEY: "x".repeat(32),
    SESSION_SECRET: "x".repeat(32),
    SEED_EMAIL: "test@test.com",
    SEED_PASSWORD: "password",
    GOOGLE_SERVICE_ACCOUNT_KEY_PATH: "/fake/path.json",
    GOOGLE_CALENDAR_ID: "fake@group.calendar.google.com",
    SYNC_INTERVAL_MS: 300000,
    SYNC_WINDOW_PAST_DAYS: 90,
    SYNC_WINDOW_FUTURE_DAYS: 30,
  },
}));
vi.mock("@/lib/db", () => ({
  db: {},
  calendarEvents: { googleId: "google_id" },
}));

import { eventsToUpserts } from "@/lib/sync/run";

describe("eventsToUpserts", () => {
  it("mapeia evento confirmed com dateTime", () => {
    const rows = eventsToUpserts([
      {
        id: "g1",
        summary: "Vivian Buelau | id: 50",
        description: "",
        start: { dateTime: "2026-05-12T16:00:00-03:00" },
        end: { dateTime: "2026-05-12T17:00:00-03:00" },
        status: "confirmed",
        etag: "abc",
      } as any,
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      googleId: "g1",
      title: "Vivian Buelau | id: 50",
      studentName: "Vivian Buelau",
      status: "confirmed",
      googleEtag: "abc",
    });
    expect(rows[0].startsAt).toBeInstanceOf(Date);
    expect(rows[0].endsAt).toBeInstanceOf(Date);
  });

  it("marca evento cancelled", () => {
    const rows = eventsToUpserts([
      { id: "g2", summary: null, status: "cancelled", etag: "z" } as any,
    ]);
    expect(rows[0].status).toBe("cancelled");
  });

  it("ignora eventos all-day (sem dateTime e não cancelled)", () => {
    const rows = eventsToUpserts([
      { id: "g3", summary: "Feriado", start: { date: "2026-05-12" }, end: { date: "2026-05-13" }, status: "confirmed" } as any,
    ]);
    expect(rows).toHaveLength(0);
  });
});
