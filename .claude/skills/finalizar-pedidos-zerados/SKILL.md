---
name: finalizar-pedidos-zerados
description: Use quando a aba Controle 2026 da escolaskatedreams tem alunos com aulas_restantes=0 (ou negativo) e situacao=ativo|Ativo (responsáveis que zeraram pacote mas não foram finalizados), tipicamente acumulando porque o W2 Fase 2 do n8n (Finalizacao de Perdidos Latest) parou de rodar. Inclui normalização de Ativo→ativo pra que esses casos não fiquem invisíveis ao filtro do W2 no futuro.
metadata:
  type: project
---

# Finalizar pedidos zerados (Skate Dreams)

## Overview

Replica manualmente o W2 Fase 2 (`Finalizacao de Perdidos Latest`, id `Urgspel6dgvdAZ6n`) pra alunos zerados na Controle 2026: encurta recorrência antiga no Google Calendar, cria nova com id+cor preservados, e atualiza Controle + Logs.

Contexto: [[project-modelo-dados-skatedreams]] · [[project-arquitetura-operacao-skatedreams]].

## Quando usar

- Aba Controle mostra alunos com `aulas_restantes ≤ 0` AND `situacao IN ('ativo','Ativo')`
- Última transição em aba Logs é antiga (cron W2 rodando vazio em segundos)
- Acúmulo de pedidos zerados sem pendente novo correspondente

## ⚠️ Regras invioláveis (descobertas após bug em 2026-05-24)

1. **NUNCA estender UNTIL** — só encurtar. Ler UNTIL atual e comparar; se atual ≤ data_termino, **MANTER**.
2. **NUNCA deletar/cancelar aulas passadas** — instâncias antigas têm semântica (presença/falta/cancelamento legítimo).
3. **NUNCA alterar cor de instâncias** — perde rastreabilidade do professor e Tomate (falta).
4. **`data_termino` vem da aba Calendario** (filtrada pelo Apps Script), não derivado do Google Calendar direto.
5. **Tratar TODOS os masters do aluno** — não só o último. Cada um pode ter UNTIL diferente.
6. **Idempotência** — rodar 2x dá mesmo resultado.

## Pré-requisitos

- `secrets/google-service-account.json` (SA `geral-google@automacoes-n8n-491322`)
  - Scope `https://www.googleapis.com/auth/calendar.events` + write em `escolaskatedreams@gmail.com`
- `secrets/apps-script-webhook.json` (URL + token do Web App — ver "Configurar Apps Script Web App")
- MCP `google-drive-skatedreams` ativo
- `app-skatedreams/node_modules/googleapis`
- **Desativar W2** (`Urgspel6dgvdAZ6n`) antes de rodar pra evitar concorrência

## Fluxo

### 1. Snapshot reversão

```
mcp__google-drive-skatedreams__getRevisions
  fileId: 1gGUc9eWNhcKXHaftG7xdsTV_exmz-DSWNXynYyJymwU
```
Anotar revisionId atual.

### 2. Desativar W2

```
mcp__n8n-skatedreams__n8n_update_partial_workflow
  workflowId: Urgspel6dgvdAZ6n
  operations: [{ "type": "setActive", "active": false }]
```

### 3. Discovery + computar data_termino

Ler Controle + Calendario via MCP:

```
mcp__google-drive-skatedreams__getGoogleSheetContent
  range: Controle!A:S
```

Filtrar alunos a fechar:
```js
const aFechar = rows.filter(r =>
  (r.situacao === 'ativo' || r.situacao === 'Ativo') &&
  (r.aulas_restantes <= 0)
);
```

**Pra cada aluno**, computar `data_termino` lendo a Calendario:
```
mcp__google-drive-skatedreams__getGoogleSheetContent
  range: Calendario!A:K
```

```js
// Filtrar Calendario por id E presenca='Presença' (ignora faltas Tomate)
const presencas = calendario.filter(e => e.id == id_antigo && e.presenca === 'Presença');
const data_termino = max(presencas.map(p => p.inicio));  // formato dd/MM/yyyy
```

**Crítico**: `data_termino` sempre vem da Calendario (já normalizada), NÃO do Google Calendar.

### 4. Normalizar Grupo E (Ativo → ativo)

Pra cada linha com `situacao=Ativo` maiúsculo:
```
mcp__google-drive-skatedreams__updateGoogleSheet
  range: Controle!E<row>
  data: [["ativo"]]
  valueInputOption: RAW
```

### 5. Calendar (PATCH + POST) via script Node

```bash
node .claude/skills/finalizar-pedidos-zerados/calendar-substituir-recorrencia.mjs \
  --alunos '[
    {"id_antigo":105,"id_novo":427,"nome":"Leandro M Pinto","data_termino":"17/05/2026"},
    ...
  ]' \
  --out /tmp/resultados.json
```

Pra cada aluno, o script:
1. Lista TODOS `recurringEventId` únicos das instâncias confirmed
2. Pra cada master: lê UNTIL atual
   - Se `UNTIL atual ≤ data_termino` → MANTER (nunca estender)
   - Senão (atual > data_termino OU sem UNTIL) → ENCURTAR
3. Pega `colorId` do master ou instância não-Tomate/Lavanda
4. Calcula próxima ocorrência após `data_termino` (mesmo dia da semana + horário)
5. POST nova recorrência com `summary: "<nome> | id: <id_novo>"`, colorId herdado, RRULE base sem UNTIL
6. **NÃO deleta** instâncias individuais (cancelled, exceptions ficam intactas)

### 6. Controle (UPDATE row antiga + APPEND row nova)

UPDATEs row antiga (3 ops/aluno):
```
updateGoogleSheet Controle!E<row> = "finalizado"      (RAW)
updateGoogleSheet Controle!J<row> = "<data_termino>"  (RAW)
updateGoogleSheet Controle!K<row> = "Automático"      (RAW)
```

APPEND row nova (19 valores, primeiro vazio, USER_ENTERED):
```
appendSpreadsheetRows
  range: Controle!A:S
  valueInputOption: USER_ENTERED
  values: [["", "<id_novo>", "<cpf>", "<nome>", "pendente", "", "<nome_filho>", "",
            "<data_termino>", "", "", "<valor>", "", "<freq>", "<plano>",
            "<aulas_contratadas>", "", "", ""]]
```

### 7. Logs (APPEND auditoria)

```
appendSpreadsheetRows
  range: Logs!A:J
  valueInputOption: RAW
  values: [["<hoje>", "<id_antigo>", "<id_novo>", "*", "*", "*", "*",
            "<colorId>", "<nome>", ""]]
```

### 8. Sync Calendario (Apps Script Web App)

Disparar sync da aba Calendario após operações Calendar:
```bash
node .claude/skills/finalizar-pedidos-zerados/sync-calendario.mjs
```

Espera retorno "OK". Se "forbidden" ou "error", checar `secrets/apps-script-webhook.json`.

### 9. Validar Q normalizado

Re-ler Controle:
```
mcp__google-drive-skatedreams__getGoogleSheetContent
  range: Controle!<rows dos finalizados>
```

Pra cada finalizado: `Q (aulas_realizadas_agenda)` deve igualar `P (aulas_contratadas)`, `S=0`.

Se Q ≠ P, **investigar**: pode ter master paralelo não detectado, ou instância órfã.

### 10. Reativar W2

```
mcp__n8n-skatedreams__n8n_update_partial_workflow
  workflowId: Urgspel6dgvdAZ6n
  operations: [{ "type": "setActive", "active": true }]
```

## Gotchas críticos (vividos)

### `appendSpreadsheetRows` ignora coluna inicial do `range`
✅ Sempre `range: Controle!A:S` com **19 valores**, primeiro = `""`. `valueInputOption: USER_ENTERED`.

### Colunas ARRAYFORMULA — NUNCA escrever
| Col | Nome | Por quê |
|---|---|---|
| **A** | contador | ARRAYFORMULA(B=>1) |
| **M** | valor_aula | `=L/P` |
| **Q** | aulas_realizadas_agenda | COUNTIF na Calendario |
| **S** | aulas_restantes | `=P-Q` |

Sobrescrever quebra a coluna inteira em cascata (`#REF!`).

### `id_novo` just-in-time
Ler `max(Controle!B:B) + 1` **antes de cada criação**. W1 do n8n pode criar pendentes entre operações.

### Row da Controle pode mover
Antes de UPDATE, achar row por busca em `B:B` pelo `id_antigo`. Planilha pode ser reordenada manualmente.

### Cor (colorId)
| colorId | Cor | Professor |
|---|---|---|
| 1 | Lavanda | (sem prof / cancelado) |
| 2 | Sálvia | (substituto) |
| 3 | Uva | Lenison |
| 4 | Flamingo | Bruno |
| 5 | Banana | Thalissa |
| 7 | Pavão (default) | Carlos |
| 8 | Grafite | Samuel |
| 9 | Mirtilo | Gabriel |
| 10 | Manjericão | Jéssica |
| 11 | Tomate | **Falta** (nunca usar pra novo evento) |

### Limpeza de título
```js
const limpo = oldSummary
  .replace(/\s*(?:\||-)?\s*\bid\s*:?\s*\d+\b/gi, '')
  .replace(/\s{2,}/g, ' ')
  .replace(/[|:-]+$/g, '')
  .trim();
const novoSummary = `${limpo} | id: ${idNovo}`;
```

### SA não tem acesso à planilha
Calendar via Node+SA, planilha via MCP `google-drive-skatedreams`.

## Red flags — STOP

- "Vou usar range B:S no append" → quebra fórmula coluna A
- "Mando valor literal em M" → quebra ARRAYFORMULA, cascata #REF!
- "Cacheio id_novo" → colisão se W1 criar evento
- "Crio evento sem colorId" → perde professor
- "Estendo UNTIL pra cobrir data_termino" → **NUNCA**. Só encurtar.
- "Deleto evento passado" → perde rastreabilidade
- "Mudo cor de instância existente" → perde info de professor/falta
- "data_termino do Calendar API direto" → não confiável (depende de UNTIL atual)

## Configurar Apps Script Web App (1x)

Pra a skill conseguir disparar o sync da aba Calendario automaticamente.

### Passo 1: Adicionar `doGet` no Apps Script

Na planilha → **Extensões → Apps Script**. Adicionar:

```javascript
const SYNC_TOKEN = 'TOKEN_RANDOM_AQUI'; // openssl rand -hex 16

function doGet(e) {
  if (e.parameter.token !== SYNC_TOKEN) {
    return ContentService.createTextOutput('forbidden')
      .setMimeType(ContentService.MimeType.TEXT);
  }
  try {
    puxar_calendario(); // nome da função existente no Apps Script
    return ContentService.createTextOutput('OK')
      .setMimeType(ContentService.MimeType.TEXT);
  } catch (err) {
    return ContentService.createTextOutput('error: ' + err.message)
      .setMimeType(ContentService.MimeType.TEXT);
  }
}
```

### Passo 2: Implantar como Web App

1. **Implantar → Nova implantação → Aplicativo da web**
2. Executar como: `escolaskatedreams@gmail.com` (dono)
3. Quem tem acesso: Qualquer pessoa
4. **Implantar** + autorizar
5. Copiar URL (formato `https://script.google.com/macros/s/.../exec`)

### Passo 3: Salvar config

```bash
cat > secrets/apps-script-webhook.json <<EOF
{
  "url": "https://script.google.com/macros/s/.../exec",
  "token": "TOKEN_RANDOM_AQUI"
}
EOF
chmod 600 secrets/apps-script-webhook.json
```

### Teste

```bash
node .claude/skills/finalizar-pedidos-zerados/sync-calendario.mjs
```

Esperado: `OK`.

## Reversão

Antes de começar: anotar `revisionId` da planilha (Step 1). Em caso de erro:
- Planilha: **UI do Sheets** → Arquivo → Histórico de versões → Restaurar (NÃO usar `restoreRevision` da API — pode perder formatação)
- Calendar: revisar cada operação no Calendar antes de prosseguir

## Real-world impact

Aplicada em **2026-05-24 pra 16 alunos do Grupo A** + 2 estourados (151, 350). Causou bug grave que gerou 23 confirmed extras por estender UNTIL — corrigido com a regra "só encurtar". Após cleanup, todos 18 finalizados corretamente (Q=P, S=0).

## Bugs históricos a evitar

| Bug | Sintoma | Causa | Prevenção |
|---|---|---|---|
| Append range B:S | A, M, Q, S apagados em todas as linhas | API ignora coluna inicial → desloca | range A:S com 19 valores, primeiro `""` |
| Extender UNTIL | Q inflado, aulas duplicadas no passado | PATCH UNTIL > UNTIL atual cria instâncias confirmed nas datas onde tinha cancelled | comparar antes de PATCH, só encurtar |
| Cor faltante no novo evento | Perde identidade do professor | esqueci setar colorId no POST | sempre setar colorId herdado |
| Logs col H vazia | W3 marca inconsistente | esqueci preencher cor_atribuida | sempre preencher |
| data_termino do Calendar | Q errado pra alunos com estaticas (pré-31/03) | Calendar não diferencia estatica/dinâmica | usar Calendario (já normalizada) |
