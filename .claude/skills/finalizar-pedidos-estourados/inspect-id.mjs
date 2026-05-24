#!/usr/bin/env node
// Inspeciona o estado atual de um id no Google Calendar (read-only).
// Mostra eventos, masters, cor e UNTIL — sem mexer em nada.
//
// Uso:
//   node inspect-id.mjs <id>

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const GOOGLEAPIS_PATH = `${REPO_ROOT}/app-skatedreams/node_modules/googleapis/build/src/index.js`;
const SA_PATH = `${REPO_ROOT}/secrets/google-service-account.json`;
const CAL_ID = 'escolaskatedreams@gmail.com';

const { google } = await import(GOOGLEAPIS_PATH);

const id = process.argv[2];
if (!id) { console.error('Uso: node inspect-id.mjs <id>'); process.exit(2); }

const creds = JSON.parse(readFileSync(SA_PATH, 'utf8'));
const auth = new google.auth.GoogleAuth({
  credentials: creds,
  scopes: ['https://www.googleapis.com/auth/calendar.events'],
});
const calendar = google.calendar({ version: 'v3', auth });

const COLOR_NAMES = {
  '1': 'Lavanda', '2': 'Sálvia', '3': 'Uva (Lenison)', '4': 'Flamingo (Bruno)',
  '5': 'Banana (Thalissa)', '6': 'Tangerina', '7': 'Pavão (Carlos)',
  '8': 'Grafite (Samuel)', '9': 'Mirtilo (Gabriel)', '10': 'Manjericão (Jéssica)',
  '11': 'Tomate (FALTA)',
};

const list = await calendar.events.list({
  calendarId: CAL_ID,
  q: `id: ${id}`,
  timeMin: '2025-11-01T00:00:00Z',
  timeMax: '2026-12-31T00:00:00Z',
  singleEvents: true,
  orderBy: 'startTime',
  maxResults: 500,
});
const events = (list.data.items || []).filter(e => e.status === 'confirmed');

console.log(`\n=== Instâncias do id: ${id} (${events.length}) ===`);
for (const e of events) {
  const dt = (e.start.dateTime || e.start.date).substring(0, 16).replace('T', ' ');
  const cor = e.colorId ? `${e.colorId}=${COLOR_NAMES[e.colorId] || '?'}` : '(herda master)';
  console.log(`  ${dt} | ${e.summary} | cor=${cor} | recId=${e.recurringEventId?.substring(0,30) || '(unico)'}`);
}

const recIds = [...new Set(events.map(e => e.recurringEventId).filter(Boolean))];
console.log(`\n=== Masters (${recIds.length}) ===`);
for (const recId of recIds) {
  try {
    const m = await calendar.events.get({ calendarId: CAL_ID, eventId: recId });
    const rrule = m.data.recurrence?.[0] || '(sem RRULE)';
    const cor = m.data.colorId ? `${m.data.colorId}=${COLOR_NAMES[m.data.colorId] || '?'}` : '(default)';
    const start = m.data.start.dateTime || m.data.start.date;
    console.log(`  ${recId}`);
    console.log(`    summary: ${m.data.summary}`);
    console.log(`    start:   ${start}`);
    console.log(`    rrule:   ${rrule}`);
    console.log(`    cor:     ${cor}`);
    console.log(`    status:  ${m.data.status}`);
  } catch (e) {
    console.log(`  ${recId} | ERRO: ${e.message}`);
  }
}
