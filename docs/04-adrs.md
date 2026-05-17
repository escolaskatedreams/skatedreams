# 04 — ADRs

Registros de Decisões Arquiteturais (Architecture Decision Records). Formato:

> **Status / Contexto / Opções consideradas / Decisão / Consequências / Gatilho de revisão**

## ADR-001 — Next.js como framework único (UI + API)

- **Status:** Aceito — 2026-05-17
- **Contexto:** Precisamos servir UI responsiva e expor endpoints HTTP para sincronização com Google Calendar e leitura/escrita de flags. Equipe enxuta (1 dev). Deploy é num container em Docker Swarm.
- **Opções consideradas:**
  - (A) **Next.js monolítico** (App Router faz UI + API routes)
  - (B) **SPA Vite + backend separado** (Express ou Hono)
  - (C) **Remix monolítico**
- **Decisão:** (A) Next.js 15 com App Router. Servidor único, um container, um deploy.
- **Consequências:**
  - ✅ Menos infra para operar.
  - ✅ Server Components reduzem JS no client; rendering inicial rápido.
  - ✅ Combina bem com o plugin `frontend-design` para acelerar UI.
  - ⚠️ Acoplamento entre UI e API — se um dia precisar abrir a API para outro consumidor (ex.: app mobile nativo), refatorar.
- **Gatilho de revisão:** existência de um segundo cliente da API ou volume que justifique separar processos.

## ADR-002 — FullCalendar para visualização

- **Status:** Aceito — 2026-05-17
- **Contexto:** Requisito explícito do cliente: "parecer com o Google Agenda". Precisamos de week/day/month views, suporte a drag/drop (talvez no futuro), eventos coloridos, fuso-horário correto.
- **Opções consideradas:**
  - (A) **FullCalendar** + wrapper React
  - (B) **react-big-calendar**
  - (C) **Custom** (CSS Grid + nossas próprias views)
- **Decisão:** (A) FullCalendar. Visual default já bate com Google Agenda; tem week/day/month/list prontos; suporta render customizado de evento (`eventContent`) para nossos LessonEventCards.
- **Consequências:**
  - ✅ Tempo até "agenda funcional" cai drasticamente (dias, não semanas).
  - ✅ Edge cases de calendário (DST, multi-day, all-day) já resolvidos.
  - ⚠️ Bundle de ~150kb. Aceitável.
  - ⚠️ Features avançadas (timeline view, resource view) são pagas — não usamos.
- **Gatilho de revisão:** necessidade de customizar visual além do que `eventContent` + CSS permitem, ou precisar de uma feature paga.

## ADR-003 — Cache local dos eventos no Postgres

- **Status:** Aceito — 2026-05-17
- **Contexto:** Para relatórios consolidados e gráficos, precisamos rodar queries agregadas. Chamar a API do Google em cada query é lento e bate quota. A API do Google é fonte da verdade — mas precisamos de uma cópia consultável.
- **Opções consideradas:**
  - (A) **Sync periódico para Postgres** (events.list + syncToken)
  - (B) **Buscar do Google em cada page load**
  - (C) **Webhook do Google** (push notifications) para atualizar em tempo real
- **Decisão:** (A) Cache local com sync incremental a cada 5 min + on-demand. Postgres é fonte para leituras; Google é fonte para escritas (que depois reflete no cache).
- **Consequências:**
  - ✅ Relatórios SQL nativos, rápidos.
  - ✅ Quota da API do Google não vira gargalo.
  - ⚠️ Janela de até 5 min de delay para eventos criados fora do app.
  - ⚠️ Lógica de sync precisa lidar com `syncToken` expirado (410) — full sync transparente.
- **Gatilho de revisão:** se 5 min for muito (cliente pedir near-real-time), avaliar opção (C) com webhooks.

## ADR-004 — Login compartilhado para MVP

- **Status:** Aceito — 2026-05-17
- **Contexto:** Cliente pediu explicitamente "uma conta de teste por enquanto" — fase de validação, não de produção multi-usuário.
- **Opções consideradas:**
  - (A) **Login único compartilhado**, criado via seed
  - (B) **NextAuth com Google OAuth para cada professor**
  - (C) **Sem login**, app aberto
- **Decisão:** (A). Uma linha em `users` criada via seed com senha vinda de `SEED_PASSWORD`.
- **Consequências:**
  - ✅ Zero atrito no teste com o cliente.
  - ✅ Hooks de auth já no lugar — upgrade futuro só substitui o provider.
  - ❌ Sem auditoria real de "quem marcou o flag" enquanto compartilhado.
  - ❌ Não pode ir para produção real sem upgrade.
- **Gatilho de revisão:** entrada de um segundo professor real OU decisão de ir para produção/multi-escola.

## ADR-005 — Estratégia de testes pragmática

- **Status:** Aceito — 2026-05-17
- **Contexto:** MVP com 1 dev, sem time de QA. Testes valem o esforço onde a lógica é genuinamente complexa ou onde a regressão é cara.
- **Opções consideradas:**
  - (A) **Sem testes automatizados** — só QA manual
  - (B) **TDD total**
  - (C) **Pragmática:** testes unitários só onde dói, smoke E2E
- **Decisão:** (C). Testes obrigatórios em:
  - `lib/sync/` (lógica de incremental + recuperação de 410)
  - `lib/google/` (mock do googleapis, sem chamadas reais)
  - `lib/reports/` (agregações SQL — SQL test contra Postgres em container)
  - `lib/crypto/` (AES-GCM ida e volta)
  - Uma suíte E2E mínima com Playwright cobrindo o golden path: login → conectar Google (mock) → ver agenda → abrir aula → marcar flag → ver no relatório.
- **Consequências:**
  - ✅ Pega as regressões caras sem virar projeto-pra-testes.
  - ⚠️ Cobertura visivelmente parcial — UI fica sem testes unitários, dependendo do E2E + QA manual.
- **Gatilho de revisão:** primeiro bug em produção que um teste teria pego.

## ADR-006 — Drizzle no lugar de Prisma

- **Status:** Aceito — 2026-05-17
- **Contexto:** Precisamos de um ORM/migration tool. Os dois sérios no ecossistema Next são Prisma e Drizzle.
- **Opções consideradas:**
  - (A) **Drizzle ORM**
  - (B) **Prisma**
  - (C) **Kysely** (query builder puro)
- **Decisão:** (A) Drizzle.
- **Consequências:**
  - ✅ Sem geração de cliente nem binário Rust. Build do container mais leve.
  - ✅ Schema em TS é também o source-of-truth das migrations (`drizzle-kit generate`).
  - ✅ SQL transparente — fácil de fazer agregações sem cair no escape-hatch.
  - ⚠️ Comunidade menor que Prisma. Documentação mais técnica.
- **Gatilho de revisão:** se a equipe crescer e o time preferir Prisma, migração é viável.

## ADR-007 — Não usar fila de jobs externa para o cron de sync

- **Status:** Aceito — 2026-05-17
- **Contexto:** Sync periódico a cada 5 min. Volume baixíssimo (uma escola).
- **Opções consideradas:**
  - (A) **`setInterval` no processo Next.js** (registrado em `instrumentation.ts`)
  - (B) **BullMQ + Redis**
  - (C) **Cron externo** (cron do host chamando endpoint HTTP)
- **Decisão:** (A). Mutex em memória + lock pessimista em DB previnem overlap entre replicas.
- **Consequências:**
  - ✅ Zero infra extra.
  - ⚠️ Se virar multi-replica, lock em DB segura — mas precisa ser bem testado.
  - ⚠️ Se Next reiniciar durante uma sync, ela morre — próxima execução pega no `syncToken` salvo. Tolerável.
- **Gatilho de revisão:** múltiplas replicas em produção, ou volume que justifique fila/observabilidade de jobs.

## ADR-008 — Identidade visual provisória, refinada quando assets chegarem

- **Status:** Aceito — 2026-05-17
- **Contexto:** Cliente não forneceu brand book ainda. Instagram e Facebook bloqueiam download anônimo de assets. Não dá pra travar o projeto esperando.
- **Opções consideradas:**
  - (A) **Construir com design system provisório** e iterar depois.
  - (B) **Esperar o cliente entregar todos os assets** antes de começar.
- **Decisão:** (A). Construímos com o `docs/brand/design-system.md` v0 — tokens placeholder (laranja energético, off-white, paleta funcional para flags). Quando o Caio entregar logo/cores/fontes oficiais, atualizamos os tokens em um único lugar.
- **Consequências:**
  - ✅ Sem bloqueio.
  - ⚠️ Vai precisar de uma passada de polimento visual depois dos assets chegarem.
- **Gatilho de revisão:** assets oficiais chegam — atualizar `design-system.md` e refazer screenshots.

## ADR-009 — Extração de `student_name` por heurística

- **Status:** Aceito — 2026-05-17
- **Contexto:** Aulas hoje são modeladas como eventos do Google Calendar com o aluno embutido no título (ex.: *"Aula — Joãozinho — 16h"*). Não existe entidade `students` separada no MVP. Mas relatórios por aluno são requisito.
- **Opções consideradas:**
  - (A) **Heurística no parsing do título** (split por `—` / regex) e normalização.
  - (B) **Tabela `students` rica** com cadastro manual e ligação por FK.
  - (C) **Campo livre por flag** ("a quem este flag se refere?") sem entidade.
- **Decisão:** (A). Regex tenta padrões conhecidos (`Aula — <Nome>`, `Aula <Nome>`, `<Nome> — <horário>`). Sem match → `student_name = null`, evento ainda aparece mas não conta no relatório por aluno. Nomes são normalizados (trim + casefold) para agregação.
- **Consequências:**
  - ✅ MVP entrega "relatório por aluno" sem cadastrar nada.
  - ⚠️ Se Caio começar a usar formatos divergentes, perdemos eventos do relatório. Mitigação: tela `/relatorios` mostra contagem de "eventos sem aluno identificado" — sinal para corrigir títulos ou ajustar a heurística.
- **Gatilho de revisão:** mais de 10% dos eventos sem aluno identificado, ou cliente pedir features que exijam entidade `students` real (foto, contato, observações longitudinais).

## ADR-010 — Service Account em vez de OAuth Web Client

- **Status:** Aceito — 2026-05-17 (substitui parte das decisões anteriores sobre integração Google)
- **Contexto:** O cliente forneceu um arquivo de credenciais de **service account** (`geral-google@automacoes-n8n-491322.iam.gserviceaccount.com`) já existente, reaproveitado de uma automação n8n. Para a SkateDreams ter aulas sincronizadas no app, precisamos acessar o Google Calendar `escolaskatedreams@gmail.com`. Caio já compartilhou a agenda com o email do SA com permissão "Fazer alterações e gerenciar compartilhamento".
- **Opções consideradas:**
  - (A) **Service Account com calendário compartilhado** (o que o cliente forneceu).
  - (B) **OAuth 2.0 Web Client** (plano original): exigiria criar credenciais novas no GCP, callback route, encryption de refresh tokens, fluxo de consent. Mais complexo.
  - (C) **API Key**: descartado — só permite leitura de calendários públicos; não atende ao requisito de edição (F5).
- **Decisão:** (A). O SA assina JWTs e troca por access tokens transparentemente via `google.auth.GoogleAuth` — sem refresh tokens persistidos.
- **Consequências:**
  - ✅ Sem fluxo OAuth, sem callback route, sem `accessTokenEnc`/`refreshTokenEnc`/`expiresAt` no banco.
  - ✅ Caio fez consentimento uma vez (compartilhamento da agenda) — não há re-autorização periódica.
  - ✅ Código mais simples (`src/lib/google/auth.ts` substitui `oauth-client.ts` + `callback/route.ts`).
  - ⚠️ A chave do SA fica em `/secrets/google-service-account.json` (gitignored, perms 600). Rotação manual quando necessário.
  - ⚠️ O service account compartilhado é de outra automação (`automacoes-n8n-...`). Idealmente teria um SA dedicado da SkateDreams, mas reusa-se para evitar setup novo. Se a automação n8n for desativada e a chave revogada, este app quebra.
  - ⚠️ Migração de schema 0001 removeu colunas de tokens da `google_connection`; tabela vira "estado de sync" (calendar_id, sync_token, last_sync_at, service_account_email).
- **Gatilho de revisão:** se a SkateDreams adquirir Google Workspace e precisar de domain-wide delegation, ou se o n8n for desativado (criar SA dedicado).

## ADR-009 (atualização) — Padrão real de título de aula

- O padrão observado na agenda da SkateDreams é `<Nome do aluno> | id: <N>`, não `Aula — Nome — 16h` como o plano original assumiu. O parser `parseStudentName` foi atualizado para cobrir esse caso como prioritário, mantendo os fallbacks anteriores. O `id: N` parece ser uma referência externa (planilha de Caio?) — não vamos usar por enquanto, só extrair o nome.

## ADR-011 — Fidelidade ao Google Calendar como fonte da verdade

- **Status:** Aceito — 2026-05-17
- **Contexto:** Ao sincronizar 4778 eventos da agenda real (`escolaskatedreams@gmail.com`), observamos:
  - 1480 eventos marcados como `status=cancelled` (~31% do total). Subdividem-se em:
    - 423 com título literalmente `"CANCELLED"` (Caio renomeou eventos antes de excluir manualmente).
    - 1057 com status `cancelled` do Google e título preservado (cancelamentos formais).
  - Vários slots de horário com **múltiplas séries recorrentes apontando para o mesmo aluno** (ex.: "Karina Rocha | id: 356" tem 39 séries distintas convergindo no domingo 09h). Origem provável: importações sucessivas de planilha ao longo do tempo, sem limpeza das séries antigas.
- **Opções consideradas:**
  - (A) **Refletir fielmente; esconder cancelados no view por padrão; sinalizar duplicações ao usuário.**
  - (B) Auto-deduplicar por `(title, starts_at)` durante a sincronização.
  - (C) Soft-delete via `studentName=null` para eventos suspeitos.
- **Decisão:** (A). O app não modifica nem esconde dados da agenda; só:
  1. Filtra `status='cancelled'` E `title='CANCELLED'` do `/agenda` por padrão (toggle `?cancelados=1` para mostrar).
  2. Exibe em `/config` → "Saúde dos dados" um card sinalizando duplicações para o Caio limpar manualmente no Google.
- **Consequências:**
  - ✅ App não esconde dados — Caio sempre consegue ver o que está na agenda real.
  - ✅ View padrão fica limpa (1057 cancelados + 423 renomeados saem da tela).
  - ✅ Caio recebe sinal claro sobre a higiene da agenda dele.
  - ⚠️ Relatórios podem mostrar "Cinthia Gomes" duas vezes em horários sobrepostos. É correto, mas potencialmente confuso. Mitigação: explicar no relatório que "aulas duplicadas no mesmo horário podem ser séries acumuladas".
- **Gatilho de revisão:** se o Caio fizer a limpeza no Google e os duplicados sumirem, o card de "Saúde" naturalmente esvazia. Se ele preferir auto-dedup no app, reabrir esta decisão.
