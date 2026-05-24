#!/usr/bin/env node
// Substituir recorrência no Google Calendar pra Grupo A (zerados/finalizados).
//
// REGRA CRÍTICA (aprendido 2026-05-23 com Roberta Rosin):
//   events.patch({recurrence}) no master REGENERA o master (novo eventId) e
//   CANCELA todas as instâncias filhas (perdendo overrides Tomate/Flamingo).
//   Por isso usamos DELETE master + INSERT master novo + RE-APLICAR cores override.
//
// Regras invioláveis:
//   1. NUNCA estender UNTIL — só encurtar
//   2. PRESERVAR cores override (Tomate=falta, Flamingo=substituição) ao recriar master
//   3. data_termino vem da aba Calendario (FORNECIDO via --alunos), não derivado do Calendar
//   4. Tratar TODOS os masters do aluno, não só o mais recente
//   5. Idempotente — rodar 2x dá mesmo resultado
//
// Uso:
//   node calendar-substituir-recorrencia.mjs --alunos '<JSON>' [--out <path>]
//   node calendar-substituir-recorrencia.mjs --alunos-file <path> [--out <path>]
//
// Formato de --alunos:
//   [{
//     "id_antigo": 105,
//     "id_novo":   427,
//     "nome":      "Leandro M Pinto",
//     "data_termino": "17/05/2026"   ← UNTIL do master antigo (última aula que FICA)
//   }, ...]

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const GOOGLEAPIS_PATH = `${REPO_ROOT}/app-skatedreams/node_modules/googleapis/build/src/index.js`;
const SA_PATH = `${REPO_ROOT}/secrets/google-service-account.json`;
const CAL_ID = 'escolaskatedreams@gmail.com';

const { google } = await import(GOOGLEAPIS_PATH);

const args = process.argv.slice(2);
let alunosJson = null;
let outPath = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--alunos') alunosJson = args[++i];
  else if (args[i] === '--alunos-file') alunosJson = readFileSync(args[++i], 'utf8');
  else if (args[i] === '--out') outPath = args[++i];
}
if (!alunosJson) {
  console.error('Uso: --alunos <JSON> | --alunos-file <path>  [--out <path>]');
  process.exit(2);
}
const alunos = JSON.parse(alunosJson);

const creds = JSON.parse(readFileSync(SA_PATH, 'utf8'));
const auth = new google.auth.GoogleAuth({
  credentials: creds,
  scopes: ['https://www.googleapis.com/auth/calendar.events'],
});
const calendar = google.calendar({ version: 'v3', auth });

function parseDdMmYyyy(s) {
  const [d, m, y] = s.split('/');
  return new Date(`${y}-${m}-${d}T23:59:59-03:00`);
}
function fmtYyyymmdd(d) {
  return d.toISOString().substring(0, 10).replace(/-/g, '');
}
function parseUntilFromRrule(rrule) {
  const m = rrule?.match(/UNTIL=(\d{8})/);
  if (!m) return null;
  const u = m[1];
  return new Date(`${u.substring(0,4)}-${u.substring(4,6)}-${u.substring(6,8)}T23:59:59Z`);
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

const results = [];

for (const a of alunos) {
  console.error(`\n[${a.id_antigo} -> ${a.id_novo}] ${a.nome} (term=${a.data_termino})`);
  try {
    if (!a.data_termino || !/^\d{2}\/\d{2}\/\d{4}$/.test(a.data_termino)) {
      throw new Error(`data_termino inválido (esperado dd/MM/yyyy): ${a.data_termino}`);
    }
    const termDate = parseDdMmYyyy(a.data_termino);
    const termYyyymmdd = fmtYyyymmdd(termDate);

    // 1. Listar TODOS eventos do id_antigo
    const list = await calendar.events.list({
      calendarId: CAL_ID, q: `id: ${a.id_antigo}`,
      timeMin: '2025-11-01T00:00:00Z', timeMax: '2027-12-31T00:00:00Z',
      singleEvents: true, orderBy: 'startTime', maxResults: 500,
    });
    const events = (list.data.items || []).filter(e => e.status === 'confirmed');

    // 2. Extrair TODOS recurringEventIds únicos
    const recIds = [...new Set(events.map(e => e.recurringEventId).filter(Boolean))];
    const mastersResult = [];

    let mainMaster = null;       // último master pra fonte do POST id_novo
    let mainMasterColor = null;
    let mainMasterRrule = null;
    let mainMasterStart = null;
    let mainMasterEnd = null;
    let mainMasterSummary = null;
    let lastPast = null;

    // 3. Pra cada master: DELETE + INSERT encurtado (se UNTIL atual > termDate ou sem UNTIL)
    for (const recId of recIds) {
      const m = await calendar.events.get({ calendarId: CAL_ID, eventId: recId });
      const rrule = m.data.recurrence?.[0];
      if (!rrule) { mastersResult.push({ recId, acao: 'SEM_RRULE' }); continue; }
      const untilAtual = parseUntilFromRrule(rrule);
      const untilAtualStr = untilAtual ? fmtYyyymmdd(untilAtual) : null;

      // Captura props pro último master (usado depois pro POST id_novo)
      mainMaster = m.data;
      mainMasterColor = m.data.colorId || '7';
      mainMasterRrule = rrule;
      mainMasterStart = m.data.start;
      mainMasterEnd = m.data.end;
      mainMasterSummary = m.data.summary;

      // REGRA: só encurtar se atual > novo OU sem UNTIL
      if (untilAtual && untilAtual.getTime() <= termDate.getTime()) {
        mastersResult.push({ recId, until_anterior: untilAtualStr, acao: 'MANTER' });
        console.error(`  ${recId.substring(0,30)} | UNTIL=${untilAtualStr} <= ${termYyyymmdd} → MANTER`);
        continue;
      }

      // Mapear cores override DENTRO do range que vai ficar
      const instMaster = events.filter(e => e.recurringEventId === recId);
      const coresOverride = {};
      for (const e of instMaster) {
        const dataIso = (e.start.dateTime || e.start.date).substring(0, 10);
        const dataDate = new Date(`${dataIso}T00:00:00-03:00`);
        if (dataDate > termDate) continue;
        if (e.colorId && e.colorId !== mainMasterColor) {
          coresOverride[dataIso] = e.colorId;
        }
      }

      // DELETE master + INSERT novo com UNTIL encurtado
      await calendar.events.delete({ calendarId: CAL_ID, eventId: recId });
      const rruleSemUntil = rrule.replace(/;UNTIL=[^;]*/g, '');
      const novaRrule = `${rruleSemUntil};UNTIL=${termYyyymmdd}T235959Z`;
      const ins = await calendar.events.insert({
        calendarId: CAL_ID,
        requestBody: {
          summary: m.data.summary,
          start: m.data.start, end: m.data.end,
          recurrence: [novaRrule],
          colorId: mainMasterColor,
        },
      });

      // Aguardar e re-aplicar cores override
      await new Promise(r => setTimeout(r, 1500));
      const newList = await calendar.events.list({
        calendarId: CAL_ID, q: `id: ${a.id_antigo}`,
        timeMin: m.data.start.dateTime || m.data.start.date,
        timeMax: `${termYyyymmdd.substring(0,4)}-${termYyyymmdd.substring(4,6)}-${termYyyymmdd.substring(6,8)}T23:59:59Z`,
        singleEvents: true, orderBy: 'startTime', maxResults: 500,
      });
      const newInst = (newList.data.items || []).filter(e => e.status === 'confirmed' && e.recurringEventId === ins.data.id);
      let patchCount = 0;
      for (const e of newInst) {
        const dataIso = (e.start.dateTime || e.start.date).substring(0, 10);
        const cor = coresOverride[dataIso];
        if (cor) {
          await calendar.events.patch({ calendarId: CAL_ID, eventId: e.id, requestBody: { colorId: cor } });
          patchCount++;
        }
      }
      mastersResult.push({
        recId_antigo: recId, recId_novo: ins.data.id,
        until_anterior: untilAtualStr || 'NONE',
        until_novo: termYyyymmdd,
        cores_override_reaplicadas: patchCount,
        acao: 'DELETE_INSERT',
      });
      console.error(`  ${recId.substring(0,30)} | DELETE+INSERT até ${termYyyymmdd} | ${patchCount} cores re-aplicadas`);
    }

    // 4. ColorId pro POST id_novo: cor do master (professor recorrente)
    const colorId = mainMasterColor || '7';

    // 5. Próxima ocorrência depois de termDate
    const past = events.filter(e => new Date(e.start.dateTime || e.start.date) <= termDate);
    if (!past.length) throw new Error('Sem aulas passadas pra inferir horário');
    lastPast = past[past.length - 1];
    const lastStart = new Date(lastPast.start.dateTime);
    const lastEnd = new Date(lastPast.end.dateTime);
    const dur = lastEnd - lastStart;
    const dayOfWeek = lastStart.getDay();
    const hh = lastStart.getHours();
    const mm = lastStart.getMinutes();
    const novaStart = new Date(termDate);
    novaStart.setDate(novaStart.getDate() + 1);
    while (novaStart.getDay() !== dayOfWeek) novaStart.setDate(novaStart.getDate() + 1);
    novaStart.setHours(hh, mm, 0, 0);
    const novaEnd = new Date(novaStart.getTime() + dur);

    let novaRrule = 'RRULE:FREQ=WEEKLY';
    if (mainMasterRrule) {
      novaRrule = mainMasterRrule.replace(/;UNTIL=[^;]*/g, '');
    }

    // 6. POST nova recorrência id_novo (idempotente)
    const checkNovo = await calendar.events.list({
      calendarId: CAL_ID, q: `id: ${a.id_novo}`,
      timeMin: termDate.toISOString(), timeMax: '2027-12-31T00:00:00Z',
      singleEvents: true, maxResults: 5,
    });
    const jaExiste = (checkNovo.data.items || []).some(e => e.status === 'confirmed' && e.recurringEventId);
    let newEventId = null;
    if (jaExiste) {
      console.error(`  POST pulado: já existe evento com id ${a.id_novo}`);
      newEventId = (checkNovo.data.items || []).find(e => e.status === 'confirmed')?.recurringEventId || null;
    } else {
      const titulo = limpaTitulo(lastPast.summary, a.nome);
      const novoSummary = `${titulo} | id: ${a.id_novo}`;
      const tzStart = lastPast.start.timeZone || 'America/Sao_Paulo';
      const post = await calendar.events.insert({
        calendarId: CAL_ID,
        requestBody: {
          summary: novoSummary,
          start: { dateTime: toIsoLocal(novaStart), timeZone: tzStart },
          end:   { dateTime: toIsoLocal(novaEnd),   timeZone: tzStart },
          recurrence: [novaRrule],
          colorId,
        },
      });
      newEventId = post.data.id;
      console.error(`  POST OK | "${novoSummary}" | start=${toIsoLocal(novaStart)} | cor=${colorId}`);
    }

    results.push({
      id_antigo: a.id_antigo, id_novo: a.id_novo, nome: a.nome,
      data_termino: a.data_termino, colorId, newEventId,
      masters: mastersResult, status: 'OK',
    });
  } catch (e) {
    results.push({ id_antigo: a.id_antigo, id_novo: a.id_novo, nome: a.nome, status: 'ERRO', erro: e.message });
    console.error(`  ERRO: ${e.message}`);
  }
}

const out = JSON.stringify(results, null, 2);
if (outPath) writeFileSync(outPath, out);
console.log(out);
