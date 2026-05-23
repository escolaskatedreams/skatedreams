import "dotenv/config";
import { db, users } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { env } from "@/env";
import { eq } from "drizzle-orm";

async function main() {
  const existing = await db.select().from(users).where(eq(users.email, env.SEED_EMAIL));
  if (existing.length > 0) {
    console.log("Seed user already exists:", env.SEED_EMAIL);
    process.exit(0);
  }
  const hash = await hashPassword(env.SEED_PASSWORD);
  await db.insert(users).values({
    email: env.SEED_EMAIL,
    passwordHash: hash,
    role: "admin",
  });
  console.log("Seed user created:", env.SEED_EMAIL);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
