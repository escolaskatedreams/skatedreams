#!/usr/bin/env node
// Move N aulas dinâmicas do id_antigo pro id_novo (honest mode estourado).
//
// REGRA CRÍTICA: events.patch({recurrence}) no master REGENERA o master inteiro
// e CANCELA todas as instâncias filhas (incluindo overrides Tomate/Flamingo).
// Por isso usamos DELETE master + INSERT master novo, depois RE-APLICAMOS as
// cores das instâncias que tinham override.
//
// Regras invioláveis:
//   1. NUNCA estender UNTIL — só encurtar
//   2. PRESERVAR cores override (Tomate=falta, Flamingo=substituição) ao recriar master
//   3. Cor do master novo = cor do master antigo (professor recorrente daqui pra frente)
//   4. NUNCA mexer em aulas passadas que NÃO estão sendo movidas
//
// Uso:
//   node mover-aulas.mjs --config '<JSON>'
//   node mover-aulas.mjs --config-file <path>
//
// Formato config:
//   {
//     "id_antigo": 67,
//     "id_novo":   446,
//     "nome":      "Roberta Rosin",
//     "datas_mover": ["23/05/2026"],         ← instâncias a renomear pro id_novo (preserva cor)
//     "data_corte": "16/05/2026",            ← UNTIL do master antigo (última aula que FICA)
//     "data_inicio_novo": "30/05/2026"       ← início da nova recorrência (próximo dia da semana APÓS última movida)
//   }

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
  else if (args[i] === '--config-file') configJson = readFileSync(args[++i], 'utf8');
}
if (!configJson) { console.error('Uso: --config <JSON> | --config-file <path>'); process.exit(2); }
const cfg = JSON.parse(configJson);

const creds = JSON.parse(readFileSync(SA_PATH, 'utf8'));
const auth = new google.auth.GoogleAuth({
  credentials: creds,
  scopes: ['https://www.googleapis.com/auth/calendar.events'],
});
const calendar = google.calendar({ version: 'v3', auth });

function parseDdMmYyyy(s) {
  const [d, m, y] = s.split('/');
  return new Date(`${y}-${m}-${d}T00:00:00-03:00`);
}
function fmtYyyymmdd(d) {
  return d.toISOString().substring(0, 10).replace(/-/g, '');
}
function limpaTitulo(s, fallback) {
  return String(s || '')
    .replace(/\s*(?:\||-)?\s*\bid\s*:?\s*\d+\b/gi, '')
    .replace(/\s{2,}/g, ' ').replace(/[|:-]+$/g, '').trim() || fallback;
}
function toIsoLocal(d) {
  const pad = (n) => String(n).padStart(2,'0');
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const oh = pad(Math.floor(Math.abs(offsetMin)/60));
  const om = pad(Math.abs(offsetMin)%60);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00${sign}${oh}:${om}`;
}

const log = [];
const cutDate = parseDdMmYyyy(cfg.data_corte);
const cutYmd = fmtYyyymmdd(cutDate);

// 1. Listar eventos do id_antigo
const list = await calendar.events.list({
  calendarId: CAL_ID, q: `id: ${cfg.id_antigo}`,
  timeMin: '2025-11-01T00:00:00Z', timeMax: '2027-12-31T00:00:00Z',
  singleEvents: true, orderBy: 'startTime', maxResults: 500,
});
const events = (list.data.items || []).filter(e => e.status === 'confirmed');
log.push({ step: 'list', total: events.length });

// 2. Encontrar master único
const recIds = [...new Set(events.map(e => e.recurringEventId).filter(Boolean))];
if (recIds.length !== 1) throw new Error(`Esperado 1 master, encontrado ${recIds.length}`);
const masterId = recIds[0];
const master = await calendar.events.get({ calendarId: CAL_ID, eventId: masterId });
const masterColor = master.data.colorId || '7';
const masterRrule = master.data.recurrence?.[0] || 'RRULE:FREQ=WEEKLY';
const masterStart = master.data.start;
const masterEnd = master.data.end;
const masterSummary = master.data.summary;
log.push({ step: 'master', id: masterId, cor: masterColor, rrule: masterRrule });

// 3. Mapear cores override das instâncias DENTRO do range que vai permanecer (<=data_corte)
// Pras datas_mover, vamos preservar via PATCH summary (mesma instância continua existindo)
// Pra TODAS as outras instâncias <= data_corte com cor != masterColor, guardar pra re-aplicar
const datasMoverSet = new Set(cfg.datas_mover.map(d => d.split('/').reverse().join('-')));
const coresOverride = {}; // { 'yyyy-mm-dd': colorId }
for (const e of events) {
  const dataIso = (e.start.dateTime || e.start.date).substring(0, 10);
  const dataDate = new Date(`${dataIso}T00:00:00-03:00`);
  if (dataDate > cutDate) continue;            // só aulas que ficam no master antigo
  if (datasMoverSet.has(dataIso)) continue;    // aulas movidas vão pro id_novo, ignora
  if (e.colorId && e.colorId !== masterColor) {
    coresOverride[dataIso] = e.colorId;
  }
}
log.push({ step: 'cores_override', mapa: coresOverride });

// 4. PATCH summary das instâncias em datas_mover → renomeia pro id_novo (preserva cor)
const renamed = [];
for (const data of cfg.datas_mover) {
  const targetYmd = data.split('/').reverse().join('-');
  const inst = events.find(e => (e.start.dateTime || e.start.date).startsWith(targetYmd));
  if (!inst) { log.push({ step: 'rename', data, status: 'NOT_FOUND' }); continue; }
  const titulo = limpaTitulo(inst.summary, cfg.nome);
  const novoSummary = `${titulo} | id: ${cfg.id_novo}`;
  await calendar.events.patch({
    calendarId: CAL_ID, eventId: inst.id,
    requestBody: { summary: novoSummary },
  });
  renamed.push({ data, eventId: inst.id, summary_novo: novoSummary, cor_preservada: inst.colorId });
}
log.push({ step: 'rename', count: renamed.length });

// 5. DELETE master antigo (cancela todas instâncias filhas — incluindo as renomeadas que viram avulsas no Calendar)
// IMPORTANTE: instâncias renomeadas (summary id_novo) já tem eventId próprio mas como recurringEventId apontava
// pro master antigo, elas serão canceladas no cascade. Vamos recriar como avulsas APÓS o delete.
const cancelledInstances = []; // pra recriar depois (aulas mantidas + movidas)
for (const e of events) {
  const dataIso = (e.start.dateTime || e.start.date).substring(0, 10);
  cancelledInstances.push({
    data: dataIso,
    summary: e.summary, // já tem id_novo se foi renomeada
    cor: e.colorId || masterColor,
    start: e.start, end: e.end,
    movida: datasMoverSet.has(dataIso),
  });
}
await calendar.events.delete({ calendarId: CAL_ID, eventId: masterId });
log.push({ step: 'delete_master', id: masterId });

// 6. INSERT master novo com RRULE encurtada
const rruleSemUntil = masterRrule.replace(/;UNTIL=[^;]*/g, '');
const novoMasterRrule = `${rruleSemUntil};UNTIL=${cutYmd}T235959Z`;
const novoMaster = await calendar.events.insert({
  calendarId: CAL_ID,
  requestBody: {
    summary: masterSummary,
    start: masterStart,
    end: masterEnd,
    recurrence: [novoMasterRrule],
    colorId: masterColor,
  },
});
log.push({ step: 'insert_master_antigo', id: novoMaster.data.id });

// 7. Aguardar e listar novas instâncias geradas
await new Promise(r => setTimeout(r, 1500));
const newList = await calendar.events.list({
  calendarId: CAL_ID, q: `id: ${cfg.id_antigo}`,
  timeMin: masterStart.dateTime || masterStart.date, timeMax: `${cutYmd.substring(0,4)}-${cutYmd.substring(4,6)}-${cutYmd.substring(6,8)}T23:59:59Z`,
  singleEvents: true, orderBy: 'startTime', maxResults: 500,
});
const newInst = (newList.data.items || []).filter(e => e.status === 'confirmed' && e.recurringEventId === novoMaster.data.id);

// 8. Re-aplicar cores override
for (const e of newInst) {
  const dataIso = (e.start.dateTime || e.start.date).substring(0, 10);
  const cor = coresOverride[dataIso];
  if (cor) {
    await calendar.events.patch({ calendarId: CAL_ID, eventId: e.id, requestBody: { colorId: cor } });
    log.push({ step: 'patch_cor', data: dataIso, cor });
  }
}

// 9. Recriar aulas movidas como avulsas (com id_novo no summary)
const aulasMovidas = [];
for (const c of cancelledInstances.filter(c => c.movida)) {
  const ins = await calendar.events.insert({
    calendarId: CAL_ID,
    requestBody: {
      summary: c.summary, // já tem id_novo
      start: c.start, end: c.end,
      colorId: c.cor,
    },
  });
  aulasMovidas.push({ data: c.data, id: ins.data.id, summary: c.summary, cor: c.cor });
}
log.push({ step: 'recria_movidas', count: aulasMovidas.length });

// 10. POST nova recorrência id_novo (futuro)
const lastPast = events[events.length - 1];
const lastStart = new Date(lastPast.start.dateTime);
const lastEnd = new Date(lastPast.end.dateTime);
const dur = lastEnd - lastStart;
const hh = lastStart.getHours();
const mm = lastStart.getMinutes();
const tz = lastPast.start.timeZone || 'America/Sao_Paulo';
const novaStart = parseDdMmYyyy(cfg.data_inicio_novo);
novaStart.setHours(hh, mm, 0, 0);
const novaEnd = new Date(novaStart.getTime() + dur);
const titulo = limpaTitulo(masterSummary, cfg.nome);
const novoSummary = `${titulo} | id: ${cfg.id_novo}`;

const checkNovo = await calendar.events.list({
  calendarId: CAL_ID, q: `id: ${cfg.id_novo}`,
  timeMin: novaStart.toISOString(), timeMax: '2027-12-31T00:00:00Z',
  singleEvents: true, maxResults: 5,
});
const jaExiste = (checkNovo.data.items || []).some(e => e.status === 'confirmed' && e.recurringEventId);
if (jaExiste) {
  log.push({ step: 'post_master_novo', status: 'JA_EXISTE' });
} else {
  const post = await calendar.events.insert({
    calendarId: CAL_ID,
    requestBody: {
      summary: novoSummary,
      start: { dateTime: toIsoLocal(novaStart), timeZone: tz },
      end:   { dateTime: toIsoLocal(novaEnd),   timeZone: tz },
      recurrence: [rruleSemUntil],
      colorId: masterColor,
    },
  });
  log.push({ step: 'post_master_novo', id: post.data.id, cor: masterColor });
}

console.log(JSON.stringify({ config: cfg, log, renamed, aulas_movidas: aulasMovidas }, null, 2));
