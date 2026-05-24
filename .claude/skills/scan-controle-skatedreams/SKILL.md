---
name: scan-controle-skatedreams
description: Use quando precisar diagnosticar problemas na aba Controle 2026 da escolaskatedreams antes de aplicar correções. Escaneia toda a planilha e categoriza alunos por tipo de anomalia (zerados, estourados, estados intermediários, case-sensitive, ids duplicados, finalizados com inconsistência). Read-only — não altera nada.
metadata:
  type: project
---

# Scan da Controle (diagnóstico read-only)

## Overview

Escaneia a aba `Controle` (planilha `1gGUc9eWNhcKXHaftG7xdsTV_exmz-DSWNXynYyJymwU`) e produz relatório categorizado de anomalias. Pré-requisito antes de invocar skills de correção (`finalizar-pedidos-zerados`, `finalizar-pedidos-estourados`, `limpar-estados-intermediarios`).

## Quando usar

- Antes de rodar skill de correção (ver estado real antes de mudar)
- Periodicamente, pra ver acúmulo de pendências do W2
- Após operações em massa, pra validar resultado
- Pra auditar saúde da operação

## Pré-requisitos

- MCP `google-drive-skatedreams` ativo
- Não precisa de service account nem webhook

## Procedimento

### 1. Ler Controle inteira

```
mcp__google-drive-skatedreams__getGoogleSheetContent
  spreadsheetId: 1gGUc9eWNhcKXHaftG7xdsTV_exmz-DSWNXynYyJymwU
  range: Controle!A:S
```

### 2. Categorizar cada row

Aplicar filtros em sequência. Cada linha pode cair em múltiplas categorias.

#### Grupo A — Zerados prontos pra fechar (skill `finalizar-pedidos-zerados`)
```js
situacao IN ('ativo','Ativo') AND aulas_restantes === 0
```

#### Grupo B — Estourados (skill `finalizar-pedidos-estourados`)
```js
situacao IN ('ativo','Ativo') AND aulas_restantes < 0
```

#### Grupo C — Estados intermediários (skill `limpar-estados-intermediarios`)
```js
situacao IN ('ativo','Ativo') AND
  (motivo_termino !== '' OR termino !== '')
```
Sinais de "workflow começou e não terminou" ou "motivo residual herdado erradamente".

#### Grupo D — IDs duplicados
```js
GROUP BY id HAVING COUNT(*) > 1
```
Filtrar `id != -1` (linhas antigas legacy não contam).

#### Grupo E — Case sensitive (`Ativo` maiúsculo)
```js
situacao === 'Ativo'  // maiúsculo exato
```
W2 filtra `=== 'ativo'` lowercase — esses passam batidos.

#### Grupo F — Finalizados com S<0 (estouro histórico)
```js
situacao === 'finalizado' AND aulas_restantes < 0
```
Não é urgente, mas indica que aluno fez aulas a mais do que contratou e ninguém ajustou.

#### Grupo G — Pendentes sem financeiro (informativo, não é erro)
```js
situacao === 'pendente' AND aulas_contratadas === ''
```
Esperando humano da escola preencher. **Não é problema**, só relatório.

#### Grupo H — Coluna A com valor literal (anomalia visual)
```js
A !== '' AND A !== '1' AND id !== -1
```
A é fórmula ARRAYFORMULA → deveria ser sempre `1` ou `""`. Valor literal (ex: `2`) indica edição manual que pode quebrar a fórmula.

### 3. Output formatado

Apresentar pro humano em formato:

```markdown
## Scan Controle — <data hoje>

### 🔴 Crítico (atacar agora)
**Grupo A — Zerados prontos (N alunos)**
| Row | id | aluno | P/Q/R/S |
| ... |

**Grupo B — Estourados (M alunos)**
| Row | id | aluno | P/Q/S | Estouro |
| ... |

### 🟡 Não-urgente (revisar)
Grupo C, D, E, F.

### 📋 Informativo
Grupo G: N pendentes esperando preenchimento.
Grupo H: M linhas com col A irregular.

### Resumo
- Total ativos: X
- Total finalizados: Y
- Total pendentes: Z
- Anomalias: N (crítico=A, médio=B, info=C)
```

### 4. Recomendar próxima ação

Baseado nos achados:
- Se Grupo A > 5: sugerir invocar `finalizar-pedidos-zerados` em batch
- Se Grupo B > 0: sugerir `finalizar-pedidos-estourados`
- Se Grupo C > 0: sugerir `limpar-estados-intermediarios`
- Se Grupo D > 0: caso a caso (não automatizado)
- Se Grupo E > 0: incluir no fluxo das outras skills (cada uma normaliza Ativo→ativo)

## Detalhes da contagem (regra das estáticas)

`aulas_realizadas_agenda` (Q) = `aulas_realizadas_estatico` (R) + dinâmicas pós-31/03/2026 da aba Calendario.

Se R > 0: aluno começou antes do cutoff. Q correto = R + dinâmicas que apareceram no Calendar com `id: N` e cor != Tomate (11).

Não computar `data_termino` aqui — esse cálculo é responsabilidade das skills de finalização.

## O que NÃO fazer

- ❌ Mexer na planilha (skill é read-only)
- ❌ Chamar Calendar API (skill é só de leitura da planilha)
- ❌ Tentar resolver problemas (delegue pras outras skills)
- ❌ Disparar webhook Apps Script (não precisa)

## Output esperado

Texto/markdown estruturado pro humano decidir o que atacar primeiro. Idealmente também um JSON em `/tmp/scan-controle-<timestamp>.json` pra rastreabilidade.
