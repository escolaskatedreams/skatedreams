import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql } from "drizzle-orm";
import * as schema from "@/lib/db/schema";

const pool = new Pool({
  connectionString:
    process.env.TEST_DATABASE_URL ??
    "postgres://skatedreams:skatedreams_dev@localhost:5433/skatedreams_test",
});

export const testDb = drizzle(pool, { schema });

export async function reset() {
  await testDb.execute(
    sql`TRUNCATE event_flags, calendar_events, google_connection, users RESTART IDENTITY CASCADE`,
  );
}
