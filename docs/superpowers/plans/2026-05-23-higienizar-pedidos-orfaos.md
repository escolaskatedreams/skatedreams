# Higienização de Pedidos Órfãos — Plano de Execução

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Limpar manualmente 33 pedidos em estado anômalo na aba Controle, espelhando ações no Google Calendar `escolaskatedreams@gmail.com`, replicando o que o W2 Fase 2 (`Finalizacao de Perdidos Latest`, id `Urgspel6dgvdAZ6n`) deveria ter automatizado mas não está fazendo desde 22/04/2026.

**Architecture:** Pra cada pedido zerado (Grupo A), replicar o ciclo do W2 Fase 2:
1. Encerrar pedido antigo na Controle (`situacao=finalizado`, `motivo_termino=Automático`, `termino=<data última aula>`)
2. Encerrar recorrência antiga no Calendar (`PATCH` RRULE adicionando `UNTIL=<data última aula>`)
3. Criar pedido novo `pendente` na Controle com `id` sequencial seguinte
4. Criar nova recorrência no Calendar com `summary="<nome> | id: <id_novo>"` herdando cor + dia/horário
5. Registrar transição em `Logs` com 4 marcas `*` (replicando o que o W2 grava)

Grupos C, D, E e B têm tratamento individual no fim do plano.

**Tech Stack:**
- `mcp__google-drive-skatedreams__*` — leitura/escrita Controle e Logs
- `mcp__n8n-skatedreams__*` — disparo HTTP API Calendar via credencial OAuth `XUTql9ehj69XFV4B` (mesma que os workflows usam)
- Próximo `id` sequencial disponível: **423** (último ocupado: 422 Priscilla Zottino, em 21/05/2026)
- Data de hoje (referência): **2026-05-23**

**Princípio operacional:** Toda a execução é **idempotente por aluno** e tem **checkpoint visual** depois de cada um. Em caso de falha, parar e investigar antes de continuar.

---

## Setup (executar 1x antes do bloco principal)

**Files/MCPs envolvidos:**
- Read: `mcp__google-drive-skatedreams__getRevisions` (snapshot)
- Read: `mcp__google-drive-skatedreams__getGoogleSheetContent` (validar IDs)
- Read: `mcp__n8n-skatedreams__n8n_get_workflow` (validar credenciais)

- [ ] **Step S.1: Snapshot da planilha (ponto de reversão)**

Comando:
```
mcp__google-drive-skatedreams__getRevisions
  fileId: 1gGUc9eWNhcKXHaftG7xdsTV_exmz-DSWNXynYyJymwU
```
Anotar o ID da revisão mais recente. Em caso de erro durante a execução, dá pra reverter via:
```
mcp__google-drive-skatedreams__restoreRevision
  fileId: 1gGUc9eWNhcKXHaftG7xdsTV_exmz-DSWNXynYyJymwU
  revisionId: <id anotado>
```

Output esperado: ID numérico (ex: `16332`).

- [ ] **Step S.2: Confirmar próximo id sequencial**

Comando:
```
mcp__google-drive-skatedreams__getGoogleSheetContent
  spreadsheetId: 1gGUc9eWNhcKXHaftG7xdsTV_exmz-DSWNXynYyJymwU
  range: Controle!B:B
```
Tomar `max()` da coluna. Se > 422, recalcular as reservas de `id_novo` abaixo (somar a diferença).

Output esperado: 422. Se diferente, **pausar e ajustar mapping abaixo antes de continuar.**

- [ ] **Step S.3: Reservar ids sequenciais para o Grupo A**

Mapping fixo (assumindo último id = 422):

| id_antigo | aluno | id_novo |
|---|---|---|
| 105 | Leandro M Pinto | 423 |
| 136 | Carla Gil | 424 |
| 174 | Renato Alcantra | 425 |
| 191 | Alexsandra | 426 |
| 218 | Renato Alcantra | 427 |
| 280 | Everton César | 428 |
| 281 | Everton César | 429 |
| 290 | Marta Concistre | 430 |
| 293 | Renata Rocha (Malu) | 431 |
| 294 | Renata Rocha (Gemeo 1) | 432 |
| 295 | Renata Rocha (Gemeo 2) | 433 |
| 319 | Domingos | 434 |
| 324 | Jorge Akinaga | 435 |
| 329 | Kelly | 436 |
| 331 | Renato Tilkian | 437 |
| 360 | Eduardo Thompson | 438 |
| 362 | Fabio | 439 |
| 365 | Patricia Galvão | 440 |
| 367 | Cassia Silva (Laura) | 441 |
| 381 | Camila Vasconcellos | 442 |

- [ ] **Step S.4: Pausa W2 (evitar concorrência durante execução manual)**

Comando:
```
mcp__n8n-skatedreams__n8n_update_partial_workflow
  workflowId: Urgspel6dgvdAZ6n
  operations: [{ "type": "setActive", "active": false }]
```

Output esperado: workflow desativado. Confirmar via `n8n_get_workflow` que `active: false`.

Motivo: se rodar durante a execução, o W2 pode tentar processar os mesmos pedidos e criar duplicatas/conflitos de id.

- [ ] **Step S.5: Validar credencial Calendar OAuth do n8n está viva**

Comando: criar workflow temporário de teste OU usar `n8n_test_workflow` rodando uma chamada GET trivial no Calendar:
```
GET https://www.googleapis.com/calendar/v3/calendars/escolaskatedreams@gmail.com/events
  ?q=id: 105
  &timeMin=2026-02-01T00:00:00Z
  &timeMax=2026-05-23T23:59:59Z
  &singleEvents=true
  &maxResults=5
```
Authentication: `googleCalendarOAuth2Api`, credential id `XUTql9ehj69XFV4B`.

Output esperado: lista de eventos do Leandro M Pinto. Se 401/403, **parar — reautenticar OAuth no n8n** antes de prosseguir.

---

## Task 1: Padrão "Fechar Pedido Zerado" (template usado nas Tasks 2–21)

Esse é o template canônico. Cada task seguinte (2–21) executa esses 11 steps com as variáveis específicas do aluno.

### Variáveis por execução

| Variável | Descrição | Origem |
|---|---|---|
| `id_antigo` | id atual na Controle | Mapping S.3 |
| `id_novo` | id reservado | Mapping S.3 |
| `nome` | nome do aluno (cabeçalho do evento) | Controle col D |
| `nome_filho` | nome do filho (se aplica) | Controle col G |
| `cpf` | CPF (preservar) | Controle col C |
| `data_termino` | data última aula realizada (dd/MM/yyyy) | Step 1.1 |
| `recurringEventIds[]` | lista de recorrências do aluno | Step 1.3 |
| `colorId` | cor herdada (= professor) | Step 1.4 |

### Steps do template

- [ ] **Step 1.1: Achar data da última aula realizada do aluno**

Caminho preferido (rápido, sem HTTP) — consultar aba `Calendario`:
```
mcp__google-drive-skatedreams__getGoogleSheetContent
  spreadsheetId: 1gGUc9eWNhcKXHaftG7xdsTV_exmz-DSWNXynYyJymwU
  range: Calendario!A:K
```
Filtrar localmente onde `id == <id_antigo>` AND `presenca == "Presença"`, pegar `MAX(inicio)`. Converter pra `dd/MM/yyyy`.

Caminho alternativo (se Calendario não tiver registro) — HTTP no Calendar:
```
GET https://www.googleapis.com/calendar/v3/calendars/escolaskatedreams@gmail.com/events
  ?q=id: <id_antigo>
  &timeMin=<hoje - 180d>
  &timeMax=<hoje>
  &singleEvents=true
  &orderBy=startTime
```
Pegar último evento, `start.dateTime`.

Exceções: se na Controle já tem `termino` preenchido (Carla Gil 29/04, Renata Rocha 15/05), **usar o valor preenchido** sem recalcular.

Output esperado: string `dd/MM/yyyy` (ex: `15/05/2026`).

- [ ] **Step 1.2: Validar que NÃO há eventos futuros do `id_antigo`**

Comando:
```
GET https://www.googleapis.com/calendar/v3/calendars/escolaskatedreams@gmail.com/events
  ?q=id: <id_antigo>
  &timeMin=<hoje>
  &timeMax=<hoje + 180d>
  &singleEvents=true
```

Se a lista vier vazia → continuar (recorrência já encerrou organicamente).
Se vier com eventos → continuar mesmo assim (Step 1.5 vai encerrar a recorrência).
Se vier 401/403 → parar, reautenticar OAuth.

- [ ] **Step 1.3: Capturar lista de `recurringEventId`s únicos do aluno**

Da resposta combinada de 1.1 + 1.2, extrair `recurringEventId` de cada evento, dedup por valor único. Pra alunos com 2x/semana, esperam-se 2 recurringEventIds diferentes (um por dia da semana).

Verificação: contar `dayOfWeek` (`new Date(start.dateTime).getDay()`) por recurringEventId. Se 2 recurringEventIds têm mesmo dayOfWeek, manter o mais recente (lastDate).

Output esperado: array com 1 ou 2 strings `recurringEventId`.

- [ ] **Step 1.4: Pra cada `recurringEventId`, buscar RRULE e colorId**

Comando:
```
GET https://www.googleapis.com/calendar/v3/calendars/escolaskatedreams@gmail.com/events/<recurringEventId>
```

Anotar:
- `recurrence[0]` — string RRULE (ex: `RRULE:FREQ=WEEKLY;BYDAY=TU`)
- `colorId` — número string (ex: `"7"`)
- `start.dateTime` — pra preservar hora
- `end.dateTime` — pra preservar duração

- [ ] **Step 1.5: PATCH RRULE encerrando recorrência antiga**

Pra cada `recurringEventId` capturado em 1.3:
```
PATCH https://www.googleapis.com/calendar/v3/calendars/escolaskatedreams@gmail.com/events/<recurringEventId>
body: {
  "recurrence": ["<RRULE original sem qualquer ;UNTIL=...>;UNTIL=<YYYYMMDD>T235959Z"]
}
```

Onde `<YYYYMMDD>` = `data_termino` no formato ISO compacto (ex: `20260515`).
Lógica: remover qualquer `;UNTIL=...` que já exista na RRULE original (regex `/;UNTIL=[^;]*/g`), depois acrescentar o UNTIL novo.

Verificação: chamar `GET .../events/<recurringEventId>` de novo, conferir que `recurrence[0]` agora termina com `UNTIL=...`.

- [ ] **Step 1.6: Buscar próxima ocorrência da recorrência após `data_termino`**

Pra cada `recurringEventId`:
```
GET https://www.googleapis.com/calendar/v3/calendars/escolaskatedreams@gmail.com/events/<recurringEventId>/instances
  ?timeMin=<data_termino + 1 dia, ISO>
  &maxResults=1
```

Se vier item: usar `items[0].start.dateTime` e `items[0].end.dateTime` como `nova_start` / `nova_end`.

Se vier vazio (recorrência já encerrou completamente antes de `data_termino + 1`): calcular fallback baseado no `dayOfWeek` da última ocorrência da recorrência antiga:
- Primeiro dia da semana correspondente após `data_termino`
- Usar hora/duração do último evento

Output esperado: `nova_start` e `nova_end` em ISO 8601 com timezone `America/Sao_Paulo`.

- [ ] **Step 1.7: Criar nova recorrência no Calendar com `id: <id_novo>`**

Pra cada recurringEventId antiga (cria uma nova pra cada):
```
POST https://www.googleapis.com/calendar/v3/calendars/escolaskatedreams@gmail.com/events
body: {
  "summary": "<nome> | id: <id_novo>",
  "start": { "dateTime": "<nova_start>", "timeZone": "America/Sao_Paulo" },
  "end":   { "dateTime": "<nova_end>",   "timeZone": "America/Sao_Paulo" },
  "recurrence": ["<RRULE original SEM UNTIL>"],
  "colorId": "<colorId capturado em 1.4>"
}
```

Tratamento de summary: se o nome original do evento tinha `nome_filho` ou outro adendo, preservar (ex: "Renata Rocha (Malu) | id: 431"). Limpar qualquer `id: N` antigo do título (regex `/\s*(?:\||-)?\s*\bid\s*:?\s*\d+\b/gi`).

Verificação: chamar `GET .../events?q=id: <id_novo>&timeMin=<nova_start>&timeMax=<nova_start + 30d>` e confirmar que retorna eventos.

- [ ] **Step 1.8: Atualizar linha do `id_antigo` na Controle**

Achar a linha: leitura da Controle, encontrar row onde `B = <id_antigo>`.

Comando:
```
mcp__google-drive-skatedreams__updateGoogleSheet
  spreadsheetId: 1gGUc9eWNhcKXHaftG7xdsTV_exmz-DSWNXynYyJymwU
  range: Controle!E<row>
  values: [["finalizado"]]
```
Repetir pras colunas:
- `J<row>` (termino): `<data_termino>`
- `K<row>` (motivo_termino): `Automático`

(Preservar todas as outras colunas.)

- [ ] **Step 1.9: Inserir linha nova `id_novo` na Controle**

Comando:
```
mcp__google-drive-skatedreams__appendSpreadsheetRows
  spreadsheetId: 1gGUc9eWNhcKXHaftG7xdsTV_exmz-DSWNXynYyJymwU
  range: Controle!A:S
  values: [[
    "1",                  // A: contador
    "<id_novo>",          // B: id
    "<cpf preservado>",   // C: cpf
    "<nome>",             // D: nome
    "pendente",           // E: situacao
    "",                   // F: obs
    "<nome_filho preservado>", // G: nome_filho
    "",                   // H: aulas (legacy)
    "<data_termino>",     // I: inicio (= termino do antigo)
    "",                   // J: termino
    "",                   // K: motivo_termino
    "",                   // L: valor
    "",                   // M: valor_aula
    "",                   // N: freq.
    "",                   // O: plano
    "",                   // P: aulas_contratadas
    "",                   // Q: aulas_realizadas_agenda
    "",                   // R: aulas_realizadas_estatico
    ""                    // S: aulas_restantes
  ]]
```

Financeiro/plano em branco — humano da escola preenche depois.

- [ ] **Step 1.10: Append linha em Logs**

Comando:
```
mcp__google-drive-skatedreams__appendSpreadsheetRows
  spreadsheetId: 1gGUc9eWNhcKXHaftG7xdsTV_exmz-DSWNXynYyJymwU
  range: Logs!A:J
  values: [[
    "<hoje dd/MM/yyyy>",  // data
    "<id_antigo>",        // id antigo
    "<id_novo>",          // id novo
    "*",                  // pedido_finalizado
    "*",                  // pedido_novo_criado
    "*",                  // agenda_recorrente_antiga_finalizada
    "*",                  // agenda_recorrente_nova_criada
    "<colorId>",          // cor_atribuida
    "<nome>",             // nome
    ""                    // check_automatico (vazio, W3 desligado)
  ]]
```

Se algum step (1.5 / 1.7) foi pulado (ex: recorrência já não existia), usar `-` no lugar de `*` na coluna correspondente.

- [ ] **Step 1.11: Verificação visual + aprovação humana**

Mostrar ao usuário:
- Print/resumo da linha antiga finalizada
- Print/resumo da linha nova pendente
- URL do evento antigo no Calendar (verificar UNTIL preenchido)
- URL do novo evento criado (verificar `id: <id_novo>` no título)
- URL da linha de Logs adicionada

**Aguardar `ok` antes de passar pro próximo aluno.** Se algo não bateu, reverter via revision do Step S.1 + cancelar evento criado no Calendar.

---

## Tasks 2–21: Aplicar template Task 1 para cada aluno do Grupo A

### Task 2: id 105 → 423 — Leandro M Pinto

- `nome` = "Leandro M Pinto"
- `nome_filho` = (vazio)
- `cpf` = (vazio)
- `data_termino` = a determinar via Step 1.1
- Plano original: Trimestral 1x/sem, valor 960, valor_aula 80, contratadas 12/12
- Recorrência esperada: 1
- Inicio pedido original: 11/02/2026

Executar Task 1 template.

### Task 3: id 136 → 424 — Carla Gil

- `nome` = "Carla Gil"
- `cpf` = (vazio)
- `data_termino` = **29/04/2026** (já preenchido na Controle — usar direto, validar em 1.1 só pra conferir)
- Plano: Trimestral 1x/sem, 960/80, 12/12
- Recorrência esperada: 1
- ⚠️ Inicio original: 23/01/2026 — pedido longo, evento provavelmente bem definido no Calendar

Executar Task 1 template.

### Task 4: id 174 → 425 — Renato Alcantra (#1)

- `nome` = "Renato Alcantra"
- Plano: Trimestral 1x/sem, 840/70, 12/12
- ⚠️ **CONFERIR** se é o mesmo Renato Alcantra do id 218 (Task 6) — buscar em Calendar/Calendario por padrão de cor e horário antes de prosseguir. Se for o mesmo, Tasks 4 e 6 podem precisar tratamento conjunto (1 aluno com 2 pedidos paralelos?).

Executar Task 1 template após desambiguação.

### Task 5: id 191 → 426 — Alexsandra

- `nome` = "Alexsandra"
- Plano: Mensal 1x/sem, 360/90, 4/4
- Recorrência esperada: 1

Executar Task 1 template.

### Task 6: id 218 → 427 — Renato Alcantra (#2)

- `nome` = "Renato Alcantra"
- Plano: Trimestral 1x/sem, 840/70, 12/12
- ⚠️ Ver nota da Task 4. Confirmar com humano antes de fechar duplicado.

Executar Task 1 template após desambiguação.

### Task 7: id 280 → 428 — Everton César (#1)

- `nome` = "Everton César"
- Plano: Mensal, 300/75, 4/4
- ⚠️ Há outro pedido pro mesmo nome (id 281, Task 8) — provavelmente 2x/semana (cada pedido = 1 recorrência), ou 2 pacotes paralelos. Confirmar.

Executar Task 1 template.

### Task 8: id 281 → 429 — Everton César (#2)

- Mesmo aluno da Task 7, segundo pedido.

Executar Task 1 template. Cuidar pra criar **recorrência DIFERENTE** (dia/horário) no Calendar — não duplicar a do 280.

### Task 9: id 290 → 430 — Marta Concistre

- `nome` = "Marta Concistre"
- Plano: Mensal 1x/sem, 360/90, 4/4
- Recorrência esperada: 1

Executar Task 1 template.

### Task 10: id 293 → 431 — Renata Rocha (Malu)

- `nome` = "Renata Rocha"
- `nome_filho` = "Malu "
- `data_termino` = **15/05/2026** (já preenchido)
- Plano: Mensal, 300/75, 4/4
- ⚠️ Renata Rocha tem 3 pedidos paralelos (293 Malu, 294 Gemeo 1, 295 Gemeo 2). Cada um tem **evento próprio** no Calendar? Ou são 3 nomes no mesmo evento? Pelo histórico de Logs (transições 144→144 Renata Rocha 5/03), eventos são separados. Confirmar antes.

Summary do novo evento: `"Renata Rocha (Malu) | id: 431"`.

### Task 11: id 294 → 432 — Renata Rocha (Gemeo 1)

- `data_termino` = 15/05/2026 (já preenchido)
- Summary do novo evento: `"Renata Rocha (Gemeo 1) | id: 432"`.

Executar Task 1 template.

### Task 12: id 295 → 433 — Renata Rocha (Gemeo 2)

- `data_termino` = 15/05/2026 (já preenchido)
- Summary do novo evento: `"Renata Rocha (Gemeo 2) | id: 433"`.

Executar Task 1 template.

### Task 13: id 319 → 434 — Domingos

- Plano: Mensal, 360/90, 4/4
- Inicio: 19/04/2026

Executar Task 1 template.

### Task 14: id 324 → 435 — Jorge Akinaga

- Plano: Mensal, 360/90, 4/4

Executar Task 1 template.

### Task 15: id 329 → 436 — Kelly

- Plano: Mensal, 360/90, 4/4

Executar Task 1 template.

### Task 16: id 331 → 437 — Renato Tilkian

- Plano: Mensal, 360/90, 4/4

Executar Task 1 template.

### Task 17: id 360 → 438 — Eduardo Thompson

- Plano: Mensal, 320/80, 4/4
- ⚠️ Existe id 321 Eduardo Thompson também ativo (4/3/1) — pedido atual ainda em andamento. Confirmar que 360 e 321 são pedidos sequenciais do mesmo aluno e o 321 é o que continua vivo.

Executar Task 1 template.

### Task 18: id 362 → 439 — Fabio

- `nome` = "Fabio"
- Plano: Mensal, 360/90, 4/4

Executar Task 1 template.

### Task 19: id 365 → 440 — Patricia Galvão

- `nome` = "Patricia Galvão "
- Plano: Mensal, 320/80, 4/4
- ⚠️ Existe id 366 Patricia Galvão ativo (4/3/1) — pedido paralelo (2x/sem? ou apenas pedido continuação?). Fechar 365 sem mexer no 366.

Executar Task 1 template.

### Task 20: id 367 → 441 — Cassia Silva (Laura)

- `nome` = "Cassia Silva"
- `nome_filho` = "Laura "
- Plano: Mensal, 360/90, 4/4
- ⚠️ `situacao` está como `Ativo` (maiúsculo). Step 1.8 sobrescreve com `finalizado` (lowercase), então corrige automaticamente.

Executar Task 1 template.

### Task 21: id 381 → 442 — Camila Vasconcellos

- `nome` = "Camila Vasconcellos"
- Plano: Mensal, 360/90, 4/4
- ⚠️ Camila Vasconcellos tem histórico (id 170 finalizado 26/03, id 269 finalizado 24/04). Linhagem: 170 → 269 → 381 → 442.

Executar Task 1 template.

---

## Task 22: Grupo C — Estados intermediários (3 casos, decisão por caso)

Esses não seguem o template puro porque o estado parcial precisa de interpretação humana antes.

### Task 22.1: id 92 — Neto (Luca)

Estado: `ativo`, `termino=17/04/2026`, `motivo_termino=Automático`, `restantes=1`.

Decisão necessária:
- Opção A: aluno teve mais 1 aula depois do 17/04 e ainda há aulas a fazer → limpar `termino` e `motivo_termino`, deixar `ativo` rodando.
- Opção B: workflow começou em 17/04 mas não consolidou → tratar como zerado (restantes vai virar 0 se ele já cumpriu) e aplicar Task 1 template com `data_termino=17/04/2026`.

Pergunta ao usuário: o aluno fez 11 aulas das 12 contratadas? Ou 12 e a 11 do `aulas_realizadas_agenda` está desatualizado?

### Task 22.2: id 142 — Renata Gibertoni

Estado: `ativo`, `motivo_termino=Automático`, `termino=` (vazio), `restantes=2`.

Inconsistência: tem motivo mas não tem data fim, e ainda tem aulas a fazer.

Decisão: limpar `motivo_termino` (resíduo errado) e deixar pedido `ativo` continuar. OU se de fato encerrou: preencher `termino`, mudar `situacao=finalizado` e criar pendente (Task 1 template).

### Task 22.3: id 377 — Carla Beatriz (Beatriz)

Estado: `ativo`, `motivo_termino=Automático`, sem `termino`, `restantes=11`.

Contexto: 377 é **pedido novo** criado pela transição 115→377 (Logs row 17). O motivo `Automático` provavelmente foi colado erroneamente quando o W2 criou a linha — esses campos deveriam estar vazios em `pendente` (depois `ativo`).

Ação: limpar `motivo_termino` (vazio). Manter `situacao=ativo`. **Não criar pendente novo.**

Comando:
```
mcp__google-drive-skatedreams__updateGoogleSheet
  range: Controle!K<row>
  values: [[""]]
```

---

## Task 23: Grupo E — Normalizar "Ativo" → "ativo" (4 linhas)

Batch update de 4 células. Não toca Calendar nem Logs (apenas tipografia).

Linhas afetadas:
- id 384 Dani Feng
- id 385 Michelle Cavalcante
- id 386 Tatiane Ginger
- id 388 Mariana Vingilis (Gabriel)

(Cassia Silva id 367 também é "Ativo" mas Task 20 já corrige no fluxo de fechamento.)

- [ ] **Step 23.1: Pra cada id, achar row e atualizar coluna E pra `ativo`**

Comando por linha:
```
mcp__google-drive-skatedreams__updateGoogleSheet
  range: Controle!E<row>
  values: [["ativo"]]
```

- [ ] **Step 23.2: Verificar visualmente que todas as 4 linhas agora têm minúsculo**

Re-leitura da Controle, conferir que nenhuma linha tem `situacao=Ativo` com A maiúsculo.

---

## Task 24: Grupo D — Desambiguar id 382 duplicado

Duas linhas têm id 382:
- row 303: **Katia Sakai** `Ativo 4/3/1`, col A = `2`, inicio 24/04/2026
- row 309: **Fernando do Carmo** `ativo 4/3/1`, col A = `2`, inicio 09/05/2026

A coluna A = `2` em ambas parece ser marca manual de "esta linha tem problema".

- [ ] **Step 24.1: Investigar qual evento(s) no Calendar carrega `id: 382`**

Comando:
```
GET https://www.googleapis.com/calendar/v3/calendars/escolaskatedreams@gmail.com/events
  ?q=id: 382
  &timeMin=2026-04-01T00:00:00Z
  &timeMax=2026-06-30T23:59:59Z
  &singleEvents=true
```
Listar todos os eventos retornados com seu `summary` completo. Inferir o aluno pelo nome no título.

- [ ] **Step 24.2: Decidir qual aluno fica com 382 e qual recebe novo id**

Critério padrão: aluno cujos eventos no Calendar **realmente** carregam `id: 382` mantém. O outro é renumerado.

Apresentar ao usuário, esperar decisão.

- [ ] **Step 24.3: Renumerar o aluno perdedor**

Suponha que Fernando do Carmo perde o 382 e recebe `id_novo` = próximo sequencial (provavelmente 443 após Task 21):

a) Atualizar Controle linha do Fernando: `B<row> = 443`, limpar `A<row>` (voltar pra `1`).
b) Re-rotular evento(s) no Calendar:
```
PATCH https://www.googleapis.com/calendar/v3/calendars/escolaskatedreams@gmail.com/events/<eventId>
body: { "summary": "<nome original sem id> | id: 443" }
```

- [ ] **Step 24.4: Limpar marcador `2` da linha vencedora**

Comando:
```
mcp__google-drive-skatedreams__updateGoogleSheet
  range: Controle!A<row da Katia>
  values: [["1"]]
```

---

## Task 25: Grupo B — Estourados (5 casos, decisão de negócio)

Esses são `ativo` com `restantes < 0` — aluno fez mais aulas do que contratou. Antes de fechar precisa decidir o desfecho com a escola.

| id | aluno | excesso | sugestões |
|---|---|---|---|
| 151 | Regis Guithelar | -1 | Cobrar 1 aula extra ou virar crédito |
| 316 | Paty Serpe | -1 | idem |
| 332 | Marcelo Pontedeiro | -1 | idem |
| 350 | Miriam | -1 | idem |
| 380 | Lilian Batista (RECORRENCIA) | -1 | Investigar: id tem nome com "(RECORRENCIA)" — pode ser flag manual |

- [ ] **Step 25.1: Levantar contexto de cada um**

Pra cada id: ler Calendario e listar todas as instâncias com data + presença. Confirmar visualmente o excesso (não é erro de contagem na fórmula).

- [ ] **Step 25.2: Decisão por aluno**

Apresentar ao usuário em batch (1 mensagem com os 5), pedir decisão por id:
- (a) Cobrar excesso e fechar (mudar `aulas_contratadas` pra valor real, criar pendente novo via Task 1)
- (b) Tratar excesso como crédito do próximo pacote (criar pendente novo já com `aulas_contratadas` ajustado pra cima)
- (c) Erro de contagem na fórmula (investigar Calendario, talvez tem evento marcado errado)

- [ ] **Step 25.3: Aplicar decisão**

Cada decisão é variação do Task 1 template. Se (a) ou (b), executar template com `data_termino` = última aula. Se (c), corrigir Calendario antes.

---

## Task 26 (opcional, pós-execução): Reativar workflows

- [ ] **Step 26.1: Reativar W2 (Finalizacao de Perdidos Latest)**

```
mcp__n8n-skatedreams__n8n_update_partial_workflow
  workflowId: Urgspel6dgvdAZ6n
  operations: [{ "type": "setActive", "active": true }]
```

- [ ] **Step 26.2: Ativar W3 (Check Automático)**

```
mcp__n8n-skatedreams__n8n_update_partial_workflow
  workflowId: qtgEPff48DApV0Y0
  operations: [{ "type": "setActive", "active": true }]
```

Adicionar trigger schedule (atualmente é só manual) — adicionar Schedule node executando 1x ao dia (ex: 06h00).

- [ ] **Step 26.3: Rodar W3 1x manual e revisar resultado**

```
mcp__n8n-skatedreams__n8n_test_workflow
  workflowId: qtgEPff48DApV0Y0
```

Ler aba Logs e conferir coluna `check_automatico`: tudo `*` significa nossas transições manuais ficaram consistentes. `! <msg>` = inconsistência, investigar.

- [ ] **Step 26.4: Investigar por que W2 Fase 2 parou de achar zerados**

Não há ação corretiva no plano atual (fora do escopo da higienização). Mas após a limpeza, o próximo aluno a zerar deveria ser pego pelo cron W2. Se não for, abrir nova investigação:
- Logs do W2 nas próximas 3 execuções (00h, 01h, 02h, 03h)
- Confirmar que filter `situacao=='ativo'` está casando (atenção ao case `Ativo`)
- Confirmar que `aulas_restantes==0` é número e não string

---

## Resumo das fases

| Fase | Tasks | Esforço estimado | Bloqueio |
|---|---|---|---|
| Setup | S.1 – S.5 | 10 min | Reautenticar OAuth se 401 |
| Grupo A — fechar zerados | 1 (template) + 2–21 (20 alunos) | ~10 min por aluno = ~3h | Confirmação humana após cada |
| Grupo C — intermediários | 22 (3 sub-casos) | 30 min | Decisão por aluno |
| Grupo E — normalize case | 23 | 5 min | Nenhum |
| Grupo D — desambiguar 382 | 24 | 20 min | Decisão de qual aluno fica |
| Grupo B — estourados | 25 (5 sub-casos) | 1h | Decisão de negócio por aluno |
| Reativar workflows | 26 | 20 min | Nenhum |

**Total estimado:** ~5h em sessão guiada (executar via Claude com checkpoints) ou ~1-2 dias de trabalho manual de um humano.

---

## Critério de "feito"

- Todos os ids do Grupo A têm `situacao=finalizado` na Controle E linha nova `pendente` correspondente E entrada em Logs com 4 marcas
- Calendar não tem mais eventos futuros dos `id_antigo`s do Grupo A
- Calendar tem nova recorrência criada pra cada `id_novo` (verificável via `q=id: <N>`)
- Grupo E: nenhuma linha com `Ativo` (case-sensitive)
- Grupo D: id 382 aparece em exatamente 1 linha de Controle
- W3 (se reativado) marca todas as transições novas com `*` em `check_automatico`

---

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Erro durante execução corrompe planilha | Step S.1 captura revision; restoreRevision reverte tudo |
| W2 cron roda durante execução e cria duplicata | Step S.4 desativa W2 antes |
| Recorrência no Calendar fica com UNTIL errado | Step 1.5 tem verificação; é só re-PATCH se errado |
| Aluno tem 2 recorrências (2x/sem) e só fecha 1 | Step 1.3 captura todos os recurringEventIds; cuidar dedup por dia da semana |
| ID novo colide com outro criado pelo W1 entre Setup e execução | Step S.4 desativa W2 mas W1 (Automação ID) continua rodando — eventos novos avançam o id. Re-validar próximo id no início de cada Task se executar com gaps |
| Nome do evento perde sufixo correto na hora de renomear | Regex de limpeza em Step 1.7 testada com formatos `Nome id: N`, `Nome | id: N`, `Nome - id: N` |
| OAuth do n8n expirou no meio | Reautenticar via Chrome MCP + 1Password se 401 (skill `mcp-auto-reauth`) |
