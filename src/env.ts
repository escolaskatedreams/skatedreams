import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  ENCRYPTION_KEY: z.string().min(32),
  SESSION_SECRET: z.string().min(32),
  SEED_EMAIL: z.string().email(),
  SEED_PASSWORD: z.string().min(8),
  GOOGLE_SERVICE_ACCOUNT_KEY_PATH: z.string().min(1),
  GOOGLE_CALENDAR_ID: z.string().min(1),
  SYNC_INTERVAL_MS: z.coerce.number().int().positive().default(300000),
  SYNC_WINDOW_PAST_DAYS: z.coerce.number().int().positive().default(90),
  SYNC_WINDOW_FUTURE_DAYS: z.coerce.number().int().positive().default(30),
});

export const env = schema.parse(process.env);
