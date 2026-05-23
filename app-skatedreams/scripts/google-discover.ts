/**
 * Script de descoberta: usa o service account para listar as agendas
 * visíveis e os próximos eventos da agenda primária da SkateDreams.
 *
 * Uso: tsx scripts/google-discover.ts
 */
import { google } from "googleapis";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEY = path.resolve(__dirname, "..", "secrets", "google-service-account.json");

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY,
    scopes: [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
    ],
  });

  const cal = google.calendar({ version: "v3", auth: await auth.getClient() as any });

  console.log("== Agendas visíveis ao service account ==");
  const list = await cal.calendarList.list();
  const items = list.data.items ?? [];
  if (items.length === 0) {
    console.log("(calendarList vazio — esperado para service accounts até inserir)");
  }
  for (const c of items) {
    console.log(`- id: ${c.id}\n  summary: ${c.summary}\n  primary: ${c.primary ?? false}\n  accessRole: ${c.accessRole}`);
  }

  // Mesmo que calendarList esteja vazio (service accounts não auto-inserem),
  // a agenda compartilhada é acessível via events.list com o ID direto.
  const KNOWN_ID = "escolaskatedreams@gmail.com";
  console.log(`\n== Próximos 5 eventos em '${KNOWN_ID}' ==`);
  try {
    const events = await cal.events.list({
      calendarId: KNOWN_ID,
      timeMin: new Date().toISOString(),
      maxResults: 5,
      singleEvents: true,
      orderBy: "startTime",
    });
    const evItems = events.data.items ?? [];
    if (evItems.length === 0) console.log("(agenda acessível, mas sem eventos futuros)");
    for (const e of evItems) {
      console.log(`- ${e.start?.dateTime ?? e.start?.date}  ${e.summary}`);
    }
  } catch (err: any) {
    console.error("Não consegui ler a agenda:", err.message ?? err);
  }
}

main().catch((err) => {
  console.error("ERRO:", err.message ?? err);
  process.exit(1);
});
