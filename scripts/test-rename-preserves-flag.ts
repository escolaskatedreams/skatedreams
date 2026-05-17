/**
 * Teste E2E real: marca um flag num evento, renomeia o evento no Google,
 * roda sync, confirma que o flag continua atrelado ao mesmo evento.
 *
 * Uso: tsx --tsconfig tsconfig.json --env-file=.env.local scripts/test-rename-preserves-flag.ts
 */
import { eq } from "drizzle-orm";
import { db, calendarEvents, eventFlags, users } from "@/lib/db";
import { getGoogleClient, getCalendarId } from "@/lib/google/auth";
import { patchEvent } from "@/lib/google/calendar";
import { runSync } from "@/lib/sync/run";

async function main() {
  // 1. Pega o primeiro evento futuro confirmado
  const future = new Date();
  const [target] = await db
    .select()
    .from(calendarEvents)
    .where(eq(calendarEvents.status, "confirmed"))
    .limit(1);

  if (!target) {
    console.error("Sem eventos no DB");
    process.exit(1);
  }

  // Pega o usuário admin pra criar o flag
  const [admin] = await db.select().from(users).limit(1);
  if (!admin) {
    console.error("Sem usuário admin");
    process.exit(1);
  }

  const originalTitle = target.title;
  const newTitle = `[TESTE] ${originalTitle} — renomeado ${Date.now()}`;

  console.log("=== Estado inicial ===");
  console.log(`  Event UUID local: ${target.id}`);
  console.log(`  google_id:        ${target.googleId}`);
  console.log(`  title:            ${originalTitle}`);

  // 2. Marca um flag de teste (student_absent)
  await db
    .delete(eventFlags)
    .where(eq(eventFlags.eventId, target.id));
  await db.insert(eventFlags).values({
    eventId: target.id,
    flagType: "student_absent",
    createdBy: admin.id,
  });
  console.log("\n=== Flag 'student_absent' marcado localmente ===");

  // 3. Renomeia o evento via Google API
  const client = await getGoogleClient();
  await patchEvent(client, target.googleId, { title: newTitle }, getCalendarId());
  console.log(`\n=== Evento renomeado no Google para: ${newTitle} ===`);

  // 4. Roda sync
  const syncResult = await runSync();
  console.log(`\n=== Sync executado: ${JSON.stringify(syncResult)} ===`);

  // 5. Verifica
  const [after] = await db
    .select()
    .from(calendarEvents)
    .where(eq(calendarEvents.googleId, target.googleId))
    .limit(1);

  const flagsAfter = await db
    .select()
    .from(eventFlags)
    .where(eq(eventFlags.eventId, after.id));

  console.log("\n=== Estado após sync ===");
  console.log(`  Event UUID local: ${after.id}            ${after.id === target.id ? "✓ MESMO" : "✗ MUDOU"}`);
  console.log(`  google_id:        ${after.googleId}     ${after.googleId === target.googleId ? "✓ MESMO" : "✗ MUDOU"}`);
  console.log(`  title:            ${after.title}`);
  console.log(`  flags:            ${flagsAfter.map((f) => f.flagType).join(", ") || "(nenhum)"}`);
  console.log(`  flag survived?    ${flagsAfter.some((f) => f.flagType === "student_absent") ? "✓ SIM" : "✗ NÃO"}`);

  // 6. Restaura o título original (pra não bagunçar a agenda do Caio)
  await patchEvent(client, target.googleId, { title: originalTitle }, getCalendarId());
  await db
    .delete(eventFlags)
    .where(eq(eventFlags.eventId, after.id));
  console.log("\n=== Cleanup: título restaurado e flag de teste removido ===");

  process.exit(0);
}

main().catch((err) => {
  console.error("ERRO:", err);
  process.exit(1);
});
