import { describe, it, expect, vi, beforeEach } from "vitest";

const eventsList = vi.fn();
const eventsPatch = vi.fn();

vi.mock("googleapis", () => ({
  google: {
    calendar: () => ({
      events: { list: eventsList, patch: eventsPatch },
    }),
  },
}));

import { listEvents, patchEvent } from "@/lib/google/calendar";

const fakeClient = {} as any; // eslint-disable-line @typescript-eslint/no-explicit-any

beforeEach(() => {
  eventsList.mockReset();
  eventsPatch.mockReset();
});

describe("listEvents", () => {
  it("aceita syncToken e devolve items + nextSyncToken", async () => {
    eventsList.mockResolvedValue({
      data: {
        items: [
          { id: "g1", summary: "Aula — Lucas — 16h", start: { dateTime: "2026-05-12T16:00:00-03:00" }, end: { dateTime: "2026-05-12T17:00:00-03:00" }, status: "confirmed", etag: "abc" },
        ],
        nextSyncToken: "next-token",
      },
    });
    const r = await listEvents(fakeClient, { calendarId: "primary", syncToken: "prev" });
    expect(eventsList).toHaveBeenCalledWith(expect.objectContaining({ calendarId: "primary", syncToken: "prev" }));
    expect(r.items).toHaveLength(1);
    expect(r.nextSyncToken).toBe("next-token");
  });

  it("relança 410 (sync token expirado)", async () => {
    eventsList.mockRejectedValue({ code: 410, message: "Sync token expired" });
    await expect(
      listEvents(fakeClient, { calendarId: "primary", syncToken: "old" }),
    ).rejects.toMatchObject({ code: 410 });
  });
});

describe("patchEvent", () => {
  it("encaminha campos para events.patch", async () => {
    eventsPatch.mockResolvedValue({ data: { id: "g1", etag: "xyz" } });
    const r = await patchEvent(fakeClient, "g1", {
      title: "Aula — Lucas — 17h",
      startsAt: new Date("2026-05-12T17:00:00-03:00"),
      endsAt: new Date("2026-05-12T18:00:00-03:00"),
    });
    expect(eventsPatch).toHaveBeenCalledWith(
      expect.objectContaining({
        calendarId: "primary",
        eventId: "g1",
        requestBody: expect.objectContaining({
          summary: "Aula — Lucas — 17h",
        }),
      }),
    );
    expect(r.etag).toBe("xyz");
  });
});
