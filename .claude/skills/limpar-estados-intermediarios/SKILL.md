---
name: limpar-estados-intermediarios
description: Use quando a aba Controle 2026 tem rows com situacao=ativo|Ativo|pendente mas com motivo_termino ou termino preenchidos — sinal de workflow W2 que começou e não consolidou, ou motivo "Automático" residual herdado erroneamente. Corrige cada caso preservando ou limpando metadados conforme o diagnóstico.
metadata:
  type: project
---

# Limpar estados intermediários (Skate Dreams)

## Overview

Casos onde a linha está "parcialmente em transição": `situacao` ainda é `ativo|pendente` mas `motivo_termino` e/ou `termino` estão preenchidos. Indica que algum workflow (W2 Fase 1/2) começou a finalizar mas falhou no meio, OU que o motivo foi aplicado erroneamente herdado de pedido anterior.

Não toca em Calendar — só faxina na Controle.

## Quando usar

- `scan-controle-skatedreams` retornou alunos no Grupo C
- Linhas com `(situacao IN ('ativo','Ativo','pendente'))` AND `(motivo_termino !== '' OR termino !== '')`

## Pré-requisitos

- MCP `google-drive-skatedreams`
- Não precisa SA, Calendar, webhook

## Diagnóstico — 4 sub-casos

Pra cada linha do Grupo C, identificar qual sub-caso:

### Sub-caso 1: Workflow começou e parou no meio
```
situacao = ativo
termino  = preenchido
motivo_termino = Automático
aulas_restantes ≥ 0
```
**Interpretação**: W2 começou a finalizar (preencheu termino + motivo) mas não trocou situacao pra finalizado. Pode ser que:
- (a) Restantes ≥ 0 e termino aponta data real → completar finalização (situacao=finalizado)
- (b) Restantes > 0 mas termino preenchido errado → reverter (limpar termino+motivo)

**Decisão**: olhar Calendar pra ver se há aulas futuras do id. Se sim, reverter. Se não, completar.

Exemplo: 92 Neto (Luca) — termino=17/04, motivo=Automático, P=12 Q=11 S=1.

### Sub-caso 2: Motivo Automático sem termino
```
situacao = ativo
termino  = vazio
motivo_termino = Automático
```
**Interpretação**: motivo aplicado mas sem data — claramente inconsistente. Provavelmente herança errada (W2 copiou motivo mas não termino).

**Decisão**: limpar motivo (deixar coluna K vazia).

Exemplo: 142 Renata Gibertoni — motivo=Automático sem termino.

### Sub-caso 3: Motivo residual em pendente novo
```
situacao = pendente
motivo_termino = Automático
```
**Interpretação**: o W2 criou pendente novo (substituição) mas copiou erroneamente o motivo do pedido antigo. Pendente NOVO não pode ter motivo (pacote novo, fresh start).

**Decisão**: limpar motivo.

Exemplo: 377 Carla Beatriz (Beatriz) — situacao=ativo mas era pra ser pendente recém-criado. Motivo=Automático residual.

### Sub-caso 4: Outras combinações
Casos não-listados → apresentar dado completo ao humano e perguntar.

## Procedimento

### 1. Discovery

```
mcp__google-drive-skatedreams__getGoogleSheetContent
  range: Controle!A:S
```

Filtrar Grupo C (definição em [[scan-controle-skatedreams]]). Classificar cada um em sub-caso 1/2/3/4.

### 2. Listar pro humano

Apresentar tabela:
```markdown
| Row | id | aluno | situacao | termino | motivo | sub-caso | ação recomendada |
```

### 3. Esperar autorização por aluno

Não aplicar em batch automático. Cada caso tem decisão.

### 4. Aplicar correção conforme sub-caso

#### Sub-caso 1a (completar finalização)
```
updateGoogleSheet Controle!E<row> = "finalizado"  (RAW)
```
P/Q/S mantém como está. Se há divergência (S != 0), pode ser estouro — então invocar [[finalizar-pedidos-estourados]] ao invés.

#### Sub-caso 1b (reverter)
```
updateGoogleSheet Controle!J<row> = ""  (vazio — limpar termino)
updateGoogleSheet Controle!K<row> = ""  (vazio — limpar motivo)
```
Aluno volta pra estado `ativo` normal.

#### Sub-caso 2 (limpar motivo apenas)
```
updateGoogleSheet Controle!K<row> = ""  (vazio)
```

#### Sub-caso 3 (limpar motivo do pendente)
```
updateGoogleSheet Controle!K<row> = ""  (vazio)
```
Mesma operação do Sub-caso 2.

### 5. Não disparar sync Calendario

Skill não toca em Calendar. Q (aulas_realizadas_agenda) não muda. Não precisa rodar `puxar_calendario`.

### 6. Re-rodar `scan-controle-skatedreams` pra validar

Linha deve ter saído do Grupo C.

## Gotchas

### `updateGoogleSheet` com valor `""` (vazio)
- Use `valueInputOption: USER_ENTERED` pra interpretar `""` como célula vazia
- Se usar RAW, vai escrever string vazia (que parece igual mas pode quebrar algumas fórmulas dependentes)

### Não escrever em colunas-fórmula
A, M, Q, S são ARRAYFORMULA. Tocar quebra. Limitar UPDATE pras colunas seguras: E, F, J, K (entre outras).

### Validar antes
Antes de mexer, verificar se a linha realmente cai no sub-caso:
- Sub-caso 1: confirmar que Q/P fazem sentido pro estado de finalização
- Sub-caso 2: confirmar que NÃO há termino preenchido (caso houver, é Sub-caso 1)
- Sub-caso 3: confirmar `situacao=pendente` exato

### Nada destrutivo
Esta skill só "limpa" (escreve vazio em colunas específicas) ou completa finalização. NÃO deleta linhas, NÃO toca Calendar, NÃO toca outras abas.

## Red flags — STOP

- "Vou aplicar em batch sem olhar caso a caso" — cada caso é diferente
- "Vou apagar a linha" — nunca
- "Vou mexer em outra coluna além de E/J/K" — não previsto

## Real-world impact

Aplicação esperada em 3 casos identificados:
- 92 Neto (Luca) — Sub-caso 1
- 142 Renata Gibertoni — Sub-caso 2
- 377 Carla Beatriz (Beatriz) — Sub-caso 3 (provavelmente — situacao=ativo mas motivo Automático herdado)
