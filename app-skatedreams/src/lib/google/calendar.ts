import { google, calendar_v3 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

type ListOpts =
  | { calendarId: string; syncToken: string }
  | { calendarId: string; timeMin: string; timeMax: string };

export type GEvent = calendar_v3.Schema$Event;

export async function listEvents(client: OAuth2Client, opts: ListOpts) {
  const cal = google.calendar({ version: "v3", auth: client });
  const baseParams: calendar_v3.Params$Resource$Events$List = {
    calendarId: opts.calendarId,
    singleEvents: true,
    showDeleted: true,
    maxResults: 2500,
    ...("syncToken" in opts
      ? { syncToken: opts.syncToken }
      : { timeMin: opts.timeMin, timeMax: opts.timeMax, orderBy: "startTime" }),
  };

  const items: GEvent[] = [];
  let nextSyncToken: string | null = null;
  let pageToken: string | undefined;
  do {
    const res = await cal.events.list({ ...baseParams, pageToken });
    for (const e of res.data.items ?? []) items.push(e as GEvent);
    pageToken = res.data.nextPageToken ?? undefined;
    if (res.data.nextSyncToken) nextSyncToken = res.data.nextSyncToken;
  } while (pageToken);

  return { items, nextSyncToken };
}

export async function patchEvent(
  client: OAuth2Client,
  googleEventId: string,
  patch: {
    title?: string;
    description?: string;
    startsAt?: Date;
    endsAt?: Date;
    status?: "confirmed" | "cancelled";
  },
  calendarId = "primary",
) {
  const cal = google.calendar({ version: "v3", auth: client });
  const requestBody: calendar_v3.Schema$Event = {
    ...(patch.title !== undefined ? { summary: patch.title } : {}),
    ...(patch.description !== undefined ? { description: patch.description } : {}),
    ...(patch.startsAt ? { start: { dateTime: patch.startsAt.toISOString() } } : {}),
    ...(patch.endsAt ? { end: { dateTime: patch.endsAt.toISOString() } } : {}),
    ...(patch.status ? { status: patch.status } : {}),
  };
  const res = await cal.events.patch({ calendarId, eventId: googleEventId, requestBody });
  return { id: res.data.id ?? googleEventId, etag: res.data.etag ?? null };
}
