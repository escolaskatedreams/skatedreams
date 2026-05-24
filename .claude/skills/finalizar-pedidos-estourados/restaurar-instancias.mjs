#!/usr/bin/env node
// Restaura instâncias canceladas (que foram regeneradas por patch no master) e
// cancela as novas duplicatas Manjericão que o Google criou.
//
// Uso:
//   node restaurar-instancias.mjs --config '<JSON>'
//
// Config: { pares: [{ cancel: <eventId nova>, restore: <eventId antiga> }, ...] }

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const GOOGLEAPIS_PATH = `${REPO_ROOT}/app-skatedreams/node_modules/googleapis/build/src/index.js`;
const SA_PATH = `${REPO_ROOT}/secrets/google-service-account.json`;
const CAL_ID = 'escolaskatedreams@gmail.com';

const { google } = await import(GOOGLEAPIS_PATH);

const args = process.argv.slice(2);
let configJson = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--config') configJson = args[++i];
}
if (!configJson) { console.error('Uso: --config <JSON>'); process.exit(2); }
const cfg = JSON.parse(configJson);

const creds = JSON.parse(readFileSync(SA_PATH, 'utf8'));
const auth = new google.auth.GoogleAuth({
  credentials: creds,
  scopes: ['https://www.googleapis.com/auth/calendar.events'],
});
const calendar = google.calendar({ version: 'v3', auth });

const log = [];
for (const par of cfg.pares) {
  try {
    // 1. Restaurar antiga (status=confirmed)
    const restored = await calendar.events.patch({
      calendarId: CAL_ID,
      eventId: par.restore,
      requestBody: { status: 'confirmed' },
    });
    log.push({ acao: 'restore', eventId: par.restore, status: restored.data.status, cor: restored.data.colorId });
    // 2. Cancelar nova (delete)
    await calendar.events.delete({ calendarId: CAL_ID, eventId: par.cancel });
    log.push({ acao: 'delete', eventId: par.cancel, status: 'OK' });
  } catch (e) {
    log.push({ acao: 'erro', par, msg: e.message });
  }
}
console.log(JSON.stringify(log, null, 2));
