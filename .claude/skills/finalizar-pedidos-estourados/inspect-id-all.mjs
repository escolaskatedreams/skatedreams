#!/usr/bin/env node
// Inspeciona TODAS instâncias (confirmed + cancelled) de um id no Calendar.
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
if (!id) { console.error('Uso: <id>'); process.exit(2); }

const creds = JSON.parse(readFileSync(SA_PATH, 'utf8'));
const auth = new google.auth.GoogleAuth({
  credentials: creds,
  scopes: ['https://www.googleapis.com/auth/calendar.events'],
});
const calendar = google.calendar({ version: 'v3', auth });

const list = await calendar.events.list({
  calendarId: CAL_ID,
  q: `id: ${id}`,
  timeMin: '2025-11-01T00:00:00Z',
  timeMax: '2026-12-31T00:00:00Z',
  singleEvents: true,
  showDeleted: true,
  orderBy: 'startTime',
  maxResults: 500,
});
const events = (list.data.items || []);

console.log(`Total (incl. cancelados): ${events.length}`);
for (const e of events) {
  const dt = (e.start?.dateTime || e.start?.date || '?').substring(0, 16).replace('T', ' ');
  console.log(`  ${dt} | status=${e.status.padEnd(10)} | cor=${e.colorId || '(d)'} | ${e.summary || '?'} | recId=${e.recurringEventId?.substring(0,30) || '(unico)'} | id=${e.id.substring(0,40)}`);
}
