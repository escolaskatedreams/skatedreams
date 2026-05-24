#!/usr/bin/env node
// Honest mode reverso: pra finalizados S=1 (sobra 1 aula) com id mais novo do mesmo aluno,
// pega a próxima aula futura NÃO-Tomate do id novo e renomeia pro id antigo.
// Resultado: finalizado fecha em P/P/0; id novo perde 1 presença prevista.
//
// Uso:
//   node transferir-aula.mjs --config '<JSON>'
//
// Config: { pares: [{ id_antigo: 161, id_novo: 288, nome: "Erli JR" }, ...] }

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

function limpaTitulo(s, fallback) {
  return String(s || '')
    .replace(/\s*(?:\||-)?\s*\bid\s*:?\s*\d+\b/gi, '')
    .replace(/\s{2,}/g, ' ').replace(/[|:-]+$/g, '').trim() || fallback;
}

const log = [];

for (const par of cfg.pares) {
  try {
    // 1. Achar última aula do id antigo (qualquer cor)
    const listAntigo = await calendar.events.list({
      calendarId: CAL_ID, q: `id: ${par.id_antigo}`,
      timeMin: '2025-11-01T00:00:00Z', timeMax: '2027-12-31T00:00:00Z',
      singleEvents: true, orderBy: 'startTime', maxResults: 500,
    });
    const aulasAntigas = (listAntigo.data.items || []).filter(e => e.status === 'confirmed');
    if (!aulasAntigas.length) { log.push({ par, status: 'NO_ANTIGO' }); continue; }
    const ultimaAntiga = aulasAntigas[aulasAntigas.length - 1];
    const dataUltimaAntiga = new Date(ultimaAntiga.start.dateTime || ultimaAntiga.start.date);

    // 2. Achar primeira aula do id novo APÓS última do antigo, cor != Tomate
    const list = await calendar.events.list({
      calendarId: CAL_ID, q: `id: ${par.id_novo}`,
      timeMin: dataUltimaAntiga.toISOString(), timeMax: '2027-12-31T00:00:00Z',
      singleEvents: true, orderBy: 'startTime', maxResults: 100,
    });
    const candidatos = (list.data.items || []).filter(e => {
      if (e.status !== 'confirmed') return false;
      if (e.colorId === '11') return false; // Tomate Falta — pula
      const start = new Date(e.start.dateTime || e.start.date);
      return start > dataUltimaAntiga;
    });
    if (!candidatos.length) {
      log.push({ par, status: 'NO_CANDIDATE' });
      continue;
    }
    const escolhida = candidatos[0];
    const titulo = limpaTitulo(escolhida.summary, par.nome);
    const novoSummary = `${titulo} | id: ${par.id_antigo}`;
    await calendar.events.patch({
      calendarId: CAL_ID, eventId: escolhida.id,
      requestBody: { summary: novoSummary },
    });
    log.push({
      par, status: 'OK',
      ultima_antiga: (ultimaAntiga.start.dateTime || ultimaAntiga.start.date).substring(0, 16).replace('T', ' '),
      data_movida: (escolhida.start.dateTime || escolhida.start.date).substring(0, 16).replace('T', ' '),
      cor: escolhida.colorId, eventId: escolhida.id, summary_novo: novoSummary,
    });
  } catch (e) {
    log.push({ par, status: 'ERRO', msg: e.message });
  }
}
console.log(JSON.stringify(log, null, 2));
