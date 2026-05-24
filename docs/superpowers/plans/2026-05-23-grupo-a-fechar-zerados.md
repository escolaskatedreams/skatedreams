# Grupo A — Plano de Fechamento de Pedidos Zerados

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replicar manualmente o W2 Fase 2 para os 17 pedidos com `situacao=ativo|Ativo` + `aulas_restantes=0`, fechando-os na Controle, encerrando recorrências no Google Calendar a partir da próxima ocorrência, e criando pedido `pendente` novo com id sequencial.

**Architecture:** Para cada aluno, 5 ações sequenciais:
1. **Calendar GET** — buscar evento(s) recorrente(s) do `id: <antigo>`, capturar `recurringEventId(s)`, `RRULE`, `colorId`, data da última instância passada
2. **Calendar PATCH** — em cada recorrência antiga: `RRULE;UNTIL=<data_última_aula>`
3. **Calendar POST** — criar nova recorrência (1 por recurringEventId antiga) com `summary="<nome> | id: <id_novo>"`, mesma cor, mesmo dia/horário, próxima ocorrência após `data_termino`
4. **Controle UPDATE** — linha antiga vira `finalizado`, preenche `termino` e `motivo_termino=Automático`
5. **Controle APPEND + Logs APPEND** — nova linha `pendente` com `id_novo`; linha em Logs com 4 marcas `*` + colorId

**Tech Stack:**
- `mcp__google-drive-skatedreams__*` — Controle e Logs
- HTTP Calendar API via n8n (credencial OAuth2 `XUTql9ehj69XFV4B`) — único caminho pro calendário `escolaskatedreams@gmail.com`
- **Atribuição de id novo é JUST-IN-TIME**: antes de cada criação, ler `max(Controle!B:B) + 1`. **NÃO** reservar ids no início — W1 fica ativo durante a execução e pode criar pendentes (avançando a sequência) a qualquer momento. Reservar antes corre risco de colisão.
- Data de hoje: **23/05/2026**

**Mudanças desde o levantamento anterior (importante):**
- ✅ Renata Rocha 293, 294, 295 já viraram `finalizado` (termino=15/05) — saíram do Grupo A
- ✅ Paty Serpe 316 virou `finalizado` (termino=22/05, contagem ajustada de 5 pra 4) — saiu do Grupo B
- ✅ Marcelo Pontedeiro 332 virou `encerrado` (termino=23/05) — saiu do Grupo B
- ⚠️ **Nenhuma dessas finalizações criou pedido `pendente` correspondente** — divergência do "sempre criar pendente novo" combinado. Confirmar se mudou de critério (só cria pendente se aluno realmente vai continuar) **antes de executar este plano**. Esse plano ainda assume "sempre criar pendente".

---

## Setup (executar 1x antes de tudo)

- [ ] **S.1: Snapshot da planilha (ponto de reversão)**

```
mcp__google-drive-skatedreams__getRevisions
  fileId: 1gGUc9eWNhcKXHaftG7xdsTV_exmz-DSWNXynYyJymwU
```
Anotar o `id` da revisão mais recente. Reverter (se necessário) via `restoreRevision` com esse `revisionId`.

- [ ] **S.2: Anotar último id atual (só pra referência inicial)**

```
mcp__google-drive-skatedreams__getGoogleSheetContent
  spreadsheetId: 1gGUc9eWNhcKXHaftG7xdsTV_exmz-DSWNXynYyJymwU
  range: Controle!B:B
```
Pegar `max()`. Anotar pra log do começo da execução. **Não usar pra reservar ids** — cada criação re-lê (Step F.0 abaixo).

- [ ] **S.3: Desativar W2 (evitar concorrência)**

```
mcp__n8n-skatedreams__n8n_update_partial_workflow
  workflowId: Urgspel6dgvdAZ6n
  operations: [{ "type": "setActive", "active": false }]
```
Verificar via `n8n_get_workflow` que `active: false`. **Não esquecer de reativar no fim** (Task 19).

- [ ] **S.4: Validar credencial OAuth Calendar**

Criar workflow temporário no n8n (ou usar `n8n_test_workflow`) com 1 HTTP node:
```
GET https://www.googleapis.com/calendar/v3/calendars/escolaskatedreams@gmail.com/events
  ?q=id: 105
  &timeMin=2026-02-01T00:00:00Z
  &timeMax=2026-05-23T23:59:59Z
  &singleEvents=true
  &maxResults=5
Authentication: googleCalendarOAuth2Api
Credential id: XUTql9ehj69XFV4B
```
Esperado: lista de eventos do Leandro. Se 401/403 → parar, reautenticar OAuth no n8n.

---

## Tabela mestre — Grupo A (16 alunos)

`id_novo` **não** é pré-reservado — vai ser `max(Controle!B:B) + 1` no momento de cada criação (Step F.0). Coluna abaixo é placeholder pra rastreio depois.

| # | Task | id antigo | row Controle | nome | plano | id novo (preenche na execução) |
|---|---|---|---|---|---|---|
| 1 | T1 | 105 | 204 | Leandro M Pinto | Trimestral 1x · 960/80 · 12 | — |
| 2 | T2 | 174 | 228 | Renato Alcantra (filho A) | Trimestral 1x · 840/70 · 12 | — |
| 3 | T3 | 191 | 230 | Alexsandra | Mensal 1x · 360/90 · 4 | — |
| 4 | T4 | 218 | 250 | Renato Alcantra (filho B) | Trimestral 1x · 840/70 · 12 | — |
| 5 | T5 | 280 | 260 | Everton César (filho A) | Mensal · 300/75 · 4 | — |
| 6 | T6 | 281 | 261 | Everton César (filho B) | Mensal · 300/75 · 4 | — |
| 7 | T7 | 290 | 251 | Marta Concistre | Mensal 1x · 360/90 · 4 | — |
| 8 | T8 | 319 | 258 | Domingos | Mensal 1x · 360/90 · 4 | — |
| 9 | T9 | 324 | 262 | Jorge Akinaga | Mensal 1x · 360/90 · 4 | — |
| 10 | T10 | 329 | 270 | Kelly | Mensal 1x · 360/90 · 4 | — |
| 11 | T11 | 331 | 271 | Renato Tilkian | Mensal 1x · 360/90 · 4 | — |
| 12 | T12 | 360 | 280 | Eduardo Thompson (1 dos 2) | Mensal 1x · 320/80 · 4 | — |
| 13 | T13 | 362 | 282 | Fabio | Mensal 1x · 360/90 · 4 | — |
| 14 | T14 | 365 | 291 | Patricia Galvão (1 dos 2 filhos) | Mensal · 320/80 · 4 | — |
| 15 | T15 | 367 | 310 | Cassia Silva (Laura) | Mensal · 360/90 · 4 — **`Ativo` maiúsculo** | — |
| 16 | T16 | 381 | 302 | Camila Vasconcellos | Mensal · 360/90 · 4 | — |

**Como `row Controle` pode mover:** se W1 (ou humano) adicionar/inserir linhas durante execução, a row do `id_antigo` muda. Em vez de confiar no número fixo, **antes de cada UPDATE, achar a row por busca em `B:B` por `id_antigo`** (Step E.0 abaixo).

**Observações cruzadas:**
- **`nome` = responsável (pagante), não aluno.** Múltiplos ids com mesmo nome = 1 responsável com vários filhos. Cada filho tem pedido/recorrência/cor própria no Calendar:
  - 174 + 218 Renato Alcantra: 2 filhos (pacotes separados)
  - 280 + 281 Everton César: 2 filhos
- **365 Patricia Galvão**: existe 366 Patricia Galvão ativo (4/3/1) — pedido do outro filho. Fechar só o 365.
- **360 Eduardo Thompson**: existe 321 Eduardo Thompson ativo (4/3/1) — pedido do filho dele (responsável + filho ambos têm aulas). Fechar só o 360.
- **136 Carla Gil**: já finalizado em rodada anterior; 409 é a continuação. **Removido do plano.**
- **Regra de pendente novo**: sempre criar (16 finalizados → 16 pendentes ids 423–438).

---

## Template canônico (steps de cada Task T1–T17)

Cada Task aplica os **6 steps** abaixo com as variáveis específicas da linha correspondente da tabela. Eu detalho cada step uma vez aqui pra não duplicar 17 vezes.

### Variáveis usadas

- `id_antigo`, `id_novo`, `nome`, `nome_filho`, `cpf` — da tabela mestre
- `row_antiga` — row da planilha onde mora o id antigo (tabela mestre)
- `data_termino` — descoberta no Step A (ou já preenchida na Controle pros casos marcados)
- `recurringEventIds[]` — descobertos no Step A
- `colorId` — descoberto no Step B (cor da recorrência antiga)
- `hoje` = `23/05/2026` (atualizar se executar em outra data)

### Step A — Descobrir contexto no Calendar

```
GET https://www.googleapis.com/calendar/v3/calendars/escolaskatedreams@gmail.com/events
  ?q=id: <id_antigo>
  &timeMin=<hoje - 180d>.toISOString()
  &timeMax=<hoje + 60d>.toISOString()
  &singleEvents=true
  &orderBy=startTime
  &maxResults=200
```

Da resposta, extrair:
- **Eventos passados** — pegar `start.dateTime` do mais recente → vira `data_termino_iso` → converter pra `dd/MM/yyyy` → `data_termino`. (Se a tabela mestre marca "termino preenchido", usar o valor já existente e só validar que bate com Calendar.)
- **Eventos futuros** — só usar pra inferir as recorrências; serão substituídos no Step C.
- **recurringEventIds únicos** — dedup por `recurringEventId`; pra alunos 2x/semana esperam-se 2 ids diferentes. Verificar `new Date(start.dateTime).getDay()` por id; se 2 ids têm mesmo dia da semana, manter o mais recente.

**Critério de pausa:** se a lista retornar vazia (nenhum evento com `id: <antigo>` no Calendar), parar e investigar — o título pode estar quebrado ou o aluno nunca teve recorrência. Pergunte ao humano.

### Step B — Pra cada recurringEventId, pegar RRULE + cor

```
GET https://www.googleapis.com/calendar/v3/calendars/escolaskatedreams@gmail.com/events/<recurringEventId>
```

Anotar:
- `recurrence[0]` — string RRULE inteira (ex: `RRULE:FREQ=WEEKLY;BYDAY=TU`)
- `colorId` — string `"1"` a `"11"` (= professor; preservar)
- `start.dateTime` + `end.dateTime` — pra calcular hora e duração

### Step C — PATCH RRULE encerrando recorrência antiga

Pra cada recurringEventId:
```
PATCH https://www.googleapis.com/calendar/v3/calendars/escolaskatedreams@gmail.com/events/<recurringEventId>
body: {
  "recurrence": ["<RRULE original sem ;UNTIL=...>;UNTIL=<YYYYMMDD>T235959Z"]
}
```
Onde `<YYYYMMDD>` vem de `data_termino` em formato ISO compacto (ex: `15/05/2026` → `20260515`).

Limpar UNTIL antigo da RRULE original via regex: `recurrence[0].replace(/;UNTIL=[^;]*/g, '')` antes de anexar o novo.

**Verificação:** chamar `GET .../events/<recurringEventId>` outra vez, confirmar que `recurrence[0]` agora contém `UNTIL=<YYYYMMDD>...`.

### Step D — POST nova recorrência com id novo

Pra cada recurringEventId antiga (cria 1 nova pra cada):
```
POST https://www.googleapis.com/calendar/v3/calendars/escolaskatedreams@gmail.com/events
body: {
  "summary": "<nome limpo> | id: <id_novo>",
  "start": { "dateTime": "<próxima ocorrência start>", "timeZone": "America/Sao_Paulo" },
  "end":   { "dateTime": "<próxima ocorrência end>",   "timeZone": "America/Sao_Paulo" },
  "recurrence": ["<RRULE original SEM qualquer UNTIL>"],
  "colorId": "<colorId>"
}
```

**Calcular `<próxima ocorrência>`:**
```
GET https://www.googleapis.com/calendar/v3/calendars/escolaskatedreams@gmail.com/events/<recurringEventId_antiga>/instances
  ?timeMin=<data_termino_iso + 1 dia>
  &maxResults=1
```
Se vier item: usar `items[0].start.dateTime` / `items[0].end.dateTime`.
Se vier vazio: calcular fallback baseado em `dayOfWeek` da última ocorrência:
- Primeiro dia da semana correspondente depois de `data_termino`
- Hora/duração herdadas do último evento

**Tratamento do título (`<nome limpo>`)**:
- Pegar `summary` original do último evento
- Limpar id antigo via regex: `/\s*(?:\||-)?\s*\bid\s*:?\s*\d+\b/gi` → string vazia
- Limpar separadores residuais: `/[|:-]+$/g` → string vazia
- `.trim()`
- Se ficou string vazia: usar valor de `nome` da tabela mestre (fallback)
- Pra alunos com `nome_filho`, garantir que aparece (ex: `"Renata Rocha (Malu)"`); inspecionar título antigo pra ver formato usado.

**Verificação:** chamar `GET .../events?q=id: <id_novo>&timeMin=<próxima ocorrência>&timeMax=<+30d>` e confirmar que retorna o evento criado.

### Step E.0 — Resolver `row_antiga` por busca

A row na planilha pode ter mudado se W1/humano inseriu linhas. Antes de qualquer UPDATE:
```
mcp__google-drive-skatedreams__getGoogleSheetContent
  range: Controle!B:B
```
Achar a row onde valor == `id_antigo`. Usar essa row real, não o cache da tabela mestre.

### Step E — Atualizar linha antiga na Controle

```
mcp__google-drive-skatedreams__updateGoogleSheet
  spreadsheetId: 1gGUc9eWNhcKXHaftG7xdsTV_exmz-DSWNXynYyJymwU
  range: Controle!E<row_antiga>:K<row_antiga>
  values: [["finalizado", "<obs preservada>", "<nome_filho preservado>", "<aulas preservado>", "<inicio preservado>", "<data_termino>", "Automático"]]
```

Como o `updateGoogleSheet` sobrescreve só as colunas no range, **preservar valores já lá** (ler antes). Alternativamente, fazer 3 updates atômicos:
- `E<row>` = `finalizado`
- `J<row>` = `<data_termino>`
- `K<row>` = `Automático`

(Recomendado: 3 updates pra evitar perder dados.)

### Step F.0 — Atribuir `id_novo` just-in-time

**Crítico:** ler `max(Controle!B:B) + 1` AGORA (não usar valor de execuções anteriores). Isso evita colisão com pendentes criados pelo W1 ou por humano entre tasks.

```
mcp__google-drive-skatedreams__getGoogleSheetContent
  range: Controle!B:B
```
`id_novo = max(B:B) + 1`. Anotar na tabela mestre (coluna "id novo") pra rastreio.

Se quiser checagem extra: validar que `<id_novo>` não aparece em `B:B`. Improvável colidir (estamos pegando max+1), mas confirma idempotência.

### Step F — Append linha nova `pendente` + linha em Logs

**F.1 — Controle:** (pré-popular financeiro/plano do antigo pra reduzir trabalho da escola; muda só se o responsável decidir mudar)

⚠️ **CRÍTICO — `appendSpreadsheetRows` IGNORA a coluna inicial do `range`.** Se passar `range: B:S` com 18 valores, ele coloca em A:R (desloca tudo 1 pra esquerda). Solução: usar `range: A:S` com 19 valores, primeiro = `""`.

⚠️ **NÃO escrever em A, M, Q, S** — todas são ARRAYFORMULA. Sobrescrever qualquer uma quebra a coluna inteira (`#REF!` em cascata).

```
mcp__google-drive-skatedreams__appendSpreadsheetRows
  spreadsheetId: 1gGUc9eWNhcKXHaftG7xdsTV_exmz-DSWNXynYyJymwU
  range: Controle!A:S
  valueInputOption: USER_ENTERED
  values: [[
    "",                     // A: contador (FÓRMULA — deixar vazio)
    "<id_novo>",            // B: id (calculado em F.0)
    "<cpf>",                // C: cpf (preservado do antigo)
    "<nome>",               // D: nome (preservado)
    "pendente",             // E: situacao
    "",                     // F: obs
    "<nome_filho>",         // G: nome_filho (preservado)
    "",                     // H: aulas (legacy)
    "<data_termino>",       // I: inicio (= termino do antigo)
    "",                     // J: termino
    "",                     // K: motivo_termino
    "<valor>",              // L: valor (preservado)
    "",                     // M: valor_aula (FÓRMULA L/P — deixar vazio)
    "<freq.>",              // N: freq. (preservado)
    "<plano>",              // O: plano (preservado)
    "<aulas_contratadas>",  // P: aulas_contratadas (preservado)
    "",                     // Q: aulas_realizadas_agenda (FÓRMULA — deixar vazio)
    "",                     // R: aulas_realizadas_estatico (vazio no pendente)
    ""                      // S: aulas_restantes (FÓRMULA P-Q — deixar vazio)
  ]]
```

**F.2 — Logs:**
```
mcp__google-drive-skatedreams__appendSpreadsheetRows
  spreadsheetId: 1gGUc9eWNhcKXHaftG7xdsTV_exmz-DSWNXynYyJymwU
  range: Logs!A:J
  values: [[
    "<hoje dd/MM/yyyy>", // A: data
    "<id_antigo>",       // B: id antigo
    "<id_novo>",         // C: id novo
    "*",                 // D: pedido_finalizado
    "*",                 // E: pedido_novo_criado
    "*",                 // F: agenda_recorrente_antiga_finalizada
    "*",                 // G: agenda_recorrente_nova_criada
    "<colorId>",         // H: cor_atribuida
    "<nome>",            // I: nome
    ""                   // J: check_automatico (vazio — W3 desligado)
  ]]
```

Se algum dos 4 steps (C/D ou nenhuma recorrência encontrada) foi pulado: substituir `*` por `-` na coluna correspondente.

### Step G — Checkpoint humano

Mostrar ao usuário:
1. URL do evento antigo (verificar UNTIL preenchido)
2. URL do(s) novo(s) evento(s) criados (verificar `id: <id_novo>` no título e cor preservada)
3. Diff da Controle (linha antiga finalizada + linha nova pendente)
4. Linha de Logs adicionada

**Pausar até o `ok` do usuário antes de ir pro próximo aluno.**

Em caso de erro detectado pelo humano: reverter via `restoreRevision` (Step S.1) + `DELETE` no evento criado no Calendar.

---

## Execução

Em ordem sugerida (mais simples → mais complexo, pra calibrar o template no início). `id_novo` é atribuído na execução (Step F.0):

- [ ] **T3 — id 191 — Alexsandra** *(pedido simples, 4/4, 1 recorrência esperada; bom piloto)*
- [ ] **T7 — id 290 — Marta Concistre**
- [ ] **T8 — id 319 — Domingos**
- [ ] **T9 — id 324 — Jorge Akinaga**
- [ ] **T10 — id 329 — Kelly**
- [ ] **T11 — id 331 — Renato Tilkian**
- [ ] **T13 — id 362 — Fabio**
- [ ] **T12 — id 360 — Eduardo Thompson** *(não tocar 321)*
- [ ] **T14 — id 365 — Patricia Galvão** *(não tocar 366)*
- [ ] **T16 — id 381 — Camila Vasconcellos**
- [ ] **T15 — id 367 — Cassia Silva** *(situacao=`Ativo` maiúsculo; Step E sobrescreve com `finalizado` em minúsculo — fica correto)*
- [ ] **T5 — id 280 — Everton César (filho A)**
- [ ] **T6 — id 281 — Everton César (filho B)**
- [ ] **T1 — id 105 — Leandro M Pinto** *(pedido longo desde 11/02)*
- [ ] **T2 — id 174 — Renato Alcantra (filho A)**
- [ ] **T4 — id 218 — Renato Alcantra (filho B)**

---

## T18 — Pós-execução

- [ ] **T18.1: Reativar W2**

```
mcp__n8n-skatedreams__n8n_update_partial_workflow
  workflowId: Urgspel6dgvdAZ6n
  operations: [{ "type": "setActive", "active": true }]
```
Conferir via `n8n_get_workflow` que `active: true`.

- [ ] **T18.2: Validação cruzada com aba Calendario**

A aba `Calendario` deve continuar refletindo presenças/faltas. Como ela é populada externamente (não pelo nosso processo), só precisamos confirmar que os novos eventos criados aparecerão lá nas próximas instâncias. Ler `Calendario!A:K` e filtrar por cada `id_novo` daqui a 1 semana — esperar pelo menos 1 linha por aluno.

- [ ] **T18.3: Validar que `aulas_realizadas_agenda` dos pedidos novos arrancam em 0**

Pra cada `id_novo` criado, ler `Controle!Q<row>` (aulas_realizadas_agenda). Deve estar em `0` no início e crescer conforme aulas acontecem. Se já vier > 0 logo na criação, há contaminação cruzada (id_novo casando com aulas antigas — improvável, mas vale conferir).

- [ ] **T18.4: Resumo final ao usuário**

Listar:
- 17 ids finalizados (mapping `id_antigo → id_novo`)
- 17 novas recorrências criadas no Calendar
- 17 linhas novas em Controle (`pendente`) e 17 linhas em Logs
- Próxima ação: humano da escola preenche financeiro/plano nos pedidos pendentes; W2 reativado vai pegar próximos zerados automaticamente

---

## Pontos de atenção (consolidado)

| Risco | Mitigação |
|---|---|
| Renatas Rocha foram fechadas SEM criar pendente — pode ser nova política | **Confirmar com o usuário antes de T1** se "sempre criar pendente novo" ainda vale ou se mudou pra "só quando aluno continua" |
| W2 cron roda no meio e cria duplicata | S.3 desativa W2 |
| W1 cria evento novo (avança sequência) durante execução | W1 continua ativo; antes de cada Task reler max(id) e confirmar `id_novo` reservado |
| 174/218 Renato Alcantra ou 280/281 Everton César são pessoas/cadastros diferentes | Investigar no Calendar antes (Step A das Tasks T3/T5/T6/T7) |
| Evento sem `id: N` no título (W1 não pegou) | Step A retorna vazio → pausar e perguntar |
| Recorrência tem múltiplas RRULEs (`recurrence` array com mais de 1 item) | Tratar como caso especial — pausar e investigar |
| Aluno tem 2x/semana com 2 recurringEventIds | Step A dedup por `getDay()` mantém os 2 separados; Steps C/D rodam pra cada |
| OAuth expirou | Skill `mcp-auto-reauth` + Chrome MCP + 1Password |

---

## Critério de "feito" do Grupo A

- 17 linhas antigas na Controle têm `situacao=finalizado`, `motivo_termino=Automático`, `termino` preenchido
- 17 linhas novas `pendente` na Controle (ids 423–439)
- 17 linhas novas em Logs com `data | id antigo | id novo | * | * | * | * | colorId | nome | ` (check_automatico vazio)
- `GET /events?q=id: <antigo>&timeMin=hoje` retorna vazio pra cada um dos 17 ids antigos
- `GET /events?q=id: <novo>&timeMin=hoje` retorna ≥1 evento futuro pra cada um dos 17 ids novos, com a cor herdada correta
- W2 reativado e rodando no cron
