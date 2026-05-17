import { pgTable, uuid, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";

export type FlagType =
  | "student_absent"
  | "teacher_late"
  | "teacher_very_late"
  | "teacher_unmotivated"
  | "students_disengaged";

export const FLAG_TYPES: FlagType[] = [
  "student_absent",
  "teacher_late",
  "teacher_very_late",
  "teacher_unmotivated",
  "students_disengaged",
];

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").$type<"admin" | "professor">().notNull().default("professor"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const googleConnection = pgTable("google_connection", {
  id: uuid("id").primaryKey().defaultRandom(),
  googleEmail: text("google_email").notNull(),
  accessTokenEnc: text("access_token_enc").notNull(),
  refreshTokenEnc: text("refresh_token_enc").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  calendarId: text("calendar_id").notNull().default("primary"),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  syncToken: text("sync_token"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    googleId: text("google_id").notNull().unique(),
    title: text("title").notNull(),
    description: text("description"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    studentName: text("student_name"),
    status: text("status").$type<"confirmed" | "cancelled">().notNull().default("confirmed"),
    googleEtag: text("google_etag"),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    startsAtIdx: index("calendar_events_starts_at_idx").on(t.startsAt),
  }),
);

export const eventFlags = pgTable(
  "event_flags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => calendarEvents.id, { onDelete: "cascade" }),
    flagType: text("flag_type").$type<FlagType>().notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    eventIdx: index("event_flags_event_id_idx").on(t.eventId),
    createdAtIdx: index("event_flags_created_at_idx").on(t.createdAt),
    uniquePerEvent: uniqueIndex("event_flags_event_flag_unique").on(t.eventId, t.flagType),
  }),
);
