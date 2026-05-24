---
name: finalizar-pedidos-estourados
description: Use quando a aba Controle 2026 tem alunos com aulas_restantes < 0 e situacao=ativo|Ativo (responsáveis que fizeram mais aulas do que contrataram). Move as |S| últimas aulas do pedido antigo pro pedido novo (renomeando id no Calendar) — pedido antigo fecha em P/P/0 (honest) e novo já começa com as aulas migradas contadas.
metadata:
  type: project
---

# Finalizar pedidos estourados (Skate Dreams)

## Overview

Variante da [[finalizar-pedidos-zerados]] pra alunos que estouraram (`Q > P`, ou seja `S < 0`).

**Estratégia padrão (honest mode):** mover as **|S| últimas aulas realizadas** do id_antigo pro id_novo, encurtando o master antigo pra antes delas. Resultado:
- Pedido antigo: Q cai pra P, S=0 ✓ histórico fiel (aluno cumpriu o pacote exato)
- Pedido novo: já começa com as aulas migradas contadas (Q=|S| de início)
- Calendar preserva todas as aulas (só muda o `id` no summary das movidas)

## Quando usar

- `scan-controle-skatedreams` retornou Grupo B
- Aluno com `situacao IN ('ativo','Ativo')` AND `aulas_restantes < 0`

## Pré-requisitos

- `secrets/google-service-account.json` (write no Calendar)
- `secrets/apps-script-webhook.json`
- MCP `google-drive-skatedreams`
- W2 do n8n desativado durante operação

## Fluxo

### 1. Setup

- Snapshot revisão
- Desativar W2
- Validar SA/webhook

### 2. Discovery + cálculo de aulas a mover

Pra cada aluno do Grupo B:

```js
// Da Controle:
P = aulas_contratadas
Q = aulas_realizadas_agenda
R = aulas_realizadas_estatico (pré-31/03)
S = aulas_restantes   // = P - Q, é negativo aqui
excesso = -S          // ex: S=-1 → excesso=1; S=-3 → excesso=3

// Da Calendario:
aulas_presenca_din = todas entries com (id=N, presenca='Presença', inicio >= 31/03/2026)
                     ordenadas crescente por data
                     // já é Q - R = dinâmicas confirmadas
```

**Quais aulas mover**: as **últimas `excesso` aulas dinâmicas** (= últimas |S| entries em ordem por data).

**`data_termino`** (pra fechar o pedido antigo): data da última aula que **PERMANECE** no id antigo (a (Q - excesso - R)-ésima dinâmica, ou seja, a "P - R"-ésima dinâmica = última do pacote contratado).

### 3. Calendar — renomear instâncias específicas

Pra cada aula a mover:

```
GET events.list q='id: <antigo>' (filtrar singleEvents, confirmed)
identificar instances com start ∈ datas_a_mover
PATCH events/<eventId> summary: "<nome limpo> | id: <id_novo>"
```

⚠️ **NÃO altera cor, status, ou data** — só renomeia summary.

### 4. Calendar — encurtar master(s) via DELETE+INSERT

⚠️ **BUG conhecido**: `events.patch({recurrence:[...]})` no master REGENERA ele (novo eventId) e CANCELA todas instâncias filhas (perdendo overrides Tomate/Flamingo). Por isso usamos DELETE+INSERT.

Pra cada `recurringEventId` único do id antigo:

```
1. GET master → guardar summary, start, end, colorId, rrule
2. Mapear cores override das instâncias <= data_corte (cor != cor_master)
3. DELETE master
4. INSERT master novo com mesmas props + RRULE encurtada (UNTIL=data_corte)
5. Listar novas instâncias geradas
6. PATCH colorId nas datas que tinham override (re-aplicar Tomate/Flamingo)
```

Regra inviolável: nunca **estender** UNTIL — só encurtar. Se UNTIL atual já <= data_corte, MANTER.

Script `mover-aulas.mjs` faz isso automaticamente.

### 5. Calendar — criar nova recorrência futura id_novo

Próxima ocorrência APÓS a última aula movida (a Q-ésima):

```
POST events
  summary: "<nome> | id: <id_novo>"
  start: <próxima data depois da última movida>
  end:   <correspondente>
  recurrence: [<RRULE base sem UNTIL>]
  colorId: <herdado>
```

Isso garante continuidade: as aulas migradas + a nova recorrência cobrem todo o futuro com id_novo.

### 6. Controle — UPDATE row antiga

```
updateGoogleSheet Controle!E<row> = "finalizado"      (RAW)
updateGoogleSheet Controle!J<row> = "<data_termino>"  (RAW)  ← data da última aula PERMANENTE
updateGoogleSheet Controle!K<row> = "Automático"      (RAW)
```

⚠️ **NÃO mexer em P** (aulas_contratadas continua o original). Após sync da Calendario, Q cai pra P automaticamente (porque |S| aulas saíram do id antigo).

### 7. Controle — APPEND row nova (pendente)

Pacote novo herda o **P original** (mesmo do antigo). Não somar excesso:

```
appendSpreadsheetRows
  range: Controle!A:S
  valueInputOption: USER_ENTERED
  values: [["", "<id_novo>", "<cpf>", "<nome>", "pendente", "", "<nome_filho>", "",
            "<data_primeira_movida>", "", "", "<valor>", "", "<freq>", "<plano>",
            "<P_original>", "", "", ""]]
```

`inicio` (col I) = data da **primeira aula movida** (ex: P+1 aula).

⚠️ Após sync, Q do novo já será `|S|` (porque as aulas migradas têm id_novo). S = P - Q. Aluno tem `P - |S|` aulas pra cumprir.

### 8. Logs (APPEND)

```
appendSpreadsheetRows Logs!A:J
  values: [["<hoje>", "<id_antigo>", "<id_novo>", "*", "*", "*", "*",
            "<colorId>", "<nome>", ""]]
```

### 9. Sync Calendario

```bash
node ../finalizar-pedidos-zerados/sync-calendario.mjs
```

### 10. Validar pós-sync

Pedido antigo:
- Q deve cair pra P (Apps Script viu menos aulas com id_antigo)
- S = 0 ✓

Pedido novo:
- Q = |S| (Apps Script viu as movidas com id_novo)
- S = P - |S|

Se Q antigo ≠ P, **investigar**: pode ter sobrado aula no master que não foi encurtada, ou master paralelo não identificado.

### 11. Reativar W2

## Exemplo concreto

**380 Lilian Batista de Araujo (RECORRENCIA)**: P=4, Q=5, R=0, S=-1, excesso=1.

1. Calendario tem 5 entries id=380 (todas Presença, todas >= 31/03 já que inicio 20/04). Última é a 5ª.
2. Mover a **1 última aula** (ex: 18/05) pro id_novo.
3. `data_termino` = data da 4ª aula (ex: 11/05).
4. Calendar: PATCH summary 18/05 de `id: 380` → `id: <novo>`. Encurtar master UNTIL=11/05.
5. Criar nova recorrência id_novo começando 25/05 (próxima após 18/05).
6. Controle 380: finalizado, J=11/05, K=Automático.
7. Controle pendente novo: P=4 (original), inicio=18/05.
8. Após sync: Q de 380 = 4 ✓, Q de novo = 1.

## Gotchas

### Excesso > aulas dinâmicas disponíveis
Se R > 0 e excesso > (Q - R), não dá pra mover só dinâmicas — algumas seriam pré-31/03 (estáticas sem id no Calendar). Esse é cenário raro mas exige tratamento especial: pode ser que o aluno NUNCA deveria ter chegado a esse Q. Pausar e perguntar.

### Aulas dinâmicas faltam no Calendar
Se a Calendario diz Q=5 mas o Calendar só lista 4 events com id=N (por algum motivo), a "5ª última" não existe pra mover. Investigar discrepância antes (talvez master paralelo).

### Cor de instância movida
Cada instância pode ter cor diferente (substituto vs professor regular). Ao mover, **manter cor original** — não trocar.

### Nova recorrência não pode sobrepor as movidas
A `start` da nova recorrência deve ser **estritamente depois** da última aula movida. Senão Calendar pode criar dia/horário duplicado.

### `aulas_realizadas_estatico` (R) protege as antigas
Aulas pré-31/03 não podem ser movidas (não têm id no Calendar). Excesso só pode vir das dinâmicas.

## Red flags — STOP

- "Vou DELETAR a aula extra" — NÃO. Renomear, não deletar.
- "Vou usar `events.patch({recurrence})` pra encurtar UNTIL" — NÃO. Isso regenera o master (bug aprendido com Roberta 67 em 2026-05-23). Usar DELETE+INSERT.
- "Vou ESTENDER UNTIL do master" — NÃO. Só encurtar (regra inviolável).
- "Vou alterar cor das instâncias movidas" — NÃO. Cor preserva rastreabilidade do professor.
- "Vou ajustar P=Q na linha antiga" — esse era o approach antigo (rejeitado). Usar honest mode (mover aulas).
- "Pacote novo herda P+excesso" — NÃO. P novo = P original (pacote padrão).

## Casos não cobertos

- **Estourados com P vazio** (ex: Livia 261): pedido nunca foi formalizado financeiramente. Pular essa skill, tratar individualmente.
- **Finalizados com S=1** (sobra de 1 aula): variante oposta — caso a caso, normalmente "aceitar perda" se já existe id mais novo do aluno.

## Real-world impact

- **67 Roberta Rosin** (finalizado S=-1, 2026-05-23): resolvido. id 446 criado pendente com aula 23/05 movida.
- **380 Lilian Batista de Araujo** (RECORRENCIA, ativo S=-1): pendente.
