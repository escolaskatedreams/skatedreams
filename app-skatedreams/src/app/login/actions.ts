"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, users } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { getSession } from "@/lib/auth/session";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function loginAction(_prev: unknown, formData: FormData) {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Dados inválidos" };

  const found = await db.select().from(users).where(eq(users.email, parsed.data.email));
  if (found.length === 0) return { error: "Credenciais inválidas" };

  const user = found[0];
  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) return { error: "Credenciais inválidas" };

  const session = await getSession();
  session.userId = user.id;
  session.email = user.email;
  session.role = user.role;
  await session.save();

  redirect("/agenda");
}
