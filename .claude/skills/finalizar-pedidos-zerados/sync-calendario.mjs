#!/usr/bin/env node
// Dispara o Apps Script Web App que sincroniza a aba Calendario do Google Sheet.
//
// Pré-requisito: configurar Web App (ver SKILL.md "Configurar Apps Script Web App")
// e salvar URL+token em secrets/apps-script-webhook.json:
//   { "url": "https://script.google.com/macros/s/.../exec", "token": "..." }

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const CFG_PATH = `${REPO_ROOT}/secrets/apps-script-webhook.json`;

const cfg = JSON.parse(readFileSync(CFG_PATH, 'utf8'));
if (!cfg.url || !cfg.token) {
  console.error('secrets/apps-script-webhook.json precisa de url + token');
  process.exit(2);
}

const u = new URL(cfg.url);
u.searchParams.set('token', cfg.token);

console.error(`Disparando sync Calendario via ${u.origin}${u.pathname}...`);
const res = await fetch(u.toString(), { method: 'GET', redirect: 'follow' });
const body = await res.text();
console.log(body);
if (!res.ok || body.startsWith('forbidden') || body.startsWith('error:')) {
  console.error(`Falhou (status ${res.status})`);
  process.exit(1);
}
