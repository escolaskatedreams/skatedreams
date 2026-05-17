# 03 — Arquitetura

## Visão geral

```
┌─────────────────────────────────────────────────────────────┐
│            Cloudflare — DNS (app.skatedreams.com.br)        │
│            Proxy desligado por enquanto (DNS only)          │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS :443
                           ▼
┌─────────────────────────────────────────────────────────────┐
│         Hetzner — Docker Swarm (gerenciado: Portainer)      │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Traefik (v3) — TLS via Let's Encrypt (HTTP-01)      │   │
│  │  router: Host(`app.skatedreams.com.br`) → app:3000   │   │
│  └────────────────────┬─────────────────────────────────┘   │
│                       │                                     │
│  ┌────────────────────▼──────┐    ┌────────────────────┐    │
│  │  app_app                  │    │  app_postgres      │    │
│  │  Next.js (App Router)     │◄──►│  postgres:16-alp.  │    │
│  │  serve UI + API           │    │  volume persist.   │    │
│  │  + cron de sync (5 min)   │    └────────────────────┘    │
│  └────────────┬──────────────┘                              │
└───────────────┼─────────────────────────────────────────────┘
                │
                ▼ HTTPS
          Google Calendar API
          Service Account (JWT) — calendar.events
```

Tudo num único container Next.js. Postgres num container irmão. Cron de sync roda no mesmo processo Node usando `setInterval` em ambiente server (registrado em `instrumentation.ts`). Não há fila de jobs externa — não justifica para o volume esperado.

## Stack

| Camada | Escolha |
|---|---|
| Frontend / Backend | **Next.js 15** (App Router, RSC, server actions) |
| Linguagem | **TypeScript** estrito |
| Estilo | **Tailwind CSS** + **shadcn/ui** para primitivas |
| Calendário | **FullCalendar** (`@fullcalendar/react`, plugins `daygrid`, `timegrid`, `interaction`) |
| Banco | **Postgres 16** |
| ORM / migrations | **Drizzle ORM** (+ `drizzle-kit` para migrations) |
| Google Calendar | **`googleapis`** (SDK oficial) |
| Auth | **iron-session** (cookie HTTP-only, sem dep de provider externo) |
| Validação | **Zod** |
| Form | **react-hook-form** |
| Container | Dockerfile multi-stage (Node 22 alpine) |
| Orquestração | Docker Swarm via Portainer (CE) |
| Reverse proxy | **Traefik v3** com auto-discovery via labels do Swarm |
| TLS | Let's Encrypt (HTTP-01 challenge) via Traefik |
| Edge | Cloudflare (DNS; proxy laranja opcional) |

Decisões individuais ficam registradas em [04-adrs](04-adrs.md).

## Estrutura de pastas

```
app-skatedreams/
├── docs/                          # esta documentação
├── src/
│   ├── app/                       # Next App Router
│   │   ├── (auth)/login/
│   │   ├── agenda/
│   │   ├── relatorios/
│   │   ├── config/
│   │   ├── @modal/(.)aula/[id]/   # route intercepting do modal
│   │   └── api/
│   │       ├── calendar/sync/
│   │       ├── events/[id]/
│   │       ├── events/[id]/flags/
│   │       └── reports/export/
│   ├── components/
│   │   ├── calendar/              # Calendar, LessonEventCard
│   │   ├── flags/                 # FlagChip
│   │   ├── ui/                    # primitivas shadcn
│   │   └── layout/
│   ├── lib/
│   │   ├── auth/
│   │   ├── google/                # auth (SA) + Calendar
│   │   ├── sync/                  # rotina de sync incremental
│   │   ├── reports/               # agregações SQL
│   │   ├── crypto/                # AES-GCM helpers
│   │   └── db/
│   │       ├── schema.ts          # tabelas Drizzle
│   │       ├── client.ts
│   │       └── migrations/
│   ├── instrumentation.ts         # registra cron de sync
│   └── styles/
├── docker/
│   ├── Dockerfile
│   ├── entrypoint.sh              # migrations + next start
│   ├── docker-compose.yml         # dev local
│   ├── stack.yml                  # template versionado (placeholders ${VARS})
│   ├── stack.deploy.yml           # renderizado com segredos — gitignored
│   └── stack.env                  # vars do Swarm — gitignored
├── .github/workflows/
│   └── build-and-deploy.yml       # CI → GHCR → webhook Portainer
├── .env.example
└── package.json
```

## Modelo de dados

Definido em SQL no arquivo de design original. Resumo Drizzle:

```ts
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").$type<"admin" | "professor">().notNull().default("professor"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const googleConnection = pgTable("google_connection", {
  id: uuid("id").primaryKey().defaultRandom(),
  calendarId: text("calendar_id").notNull(),
  serviceAccountEmail: text("service_account_email"),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  syncToken: text("sync_token"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const calendarEvents = pgTable("calendar_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  googleId: text("google_id").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  studentName: text("student_name"),
  status: text("status").$type<"confirmed" | "cancelled">().notNull().default("confirmed"),
  googleEtag: text("google_etag"),
  syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  startsAtIdx: index().on(t.startsAt),
}));

export const eventFlags = pgTable("event_flags", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull().references(() => calendarEvents.id, { onDelete: "cascade" }),
  flagType: text("flag_type").$type<FlagType>().notNull(),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  eventIdx: index().on(t.eventId),
  createdAtIdx: index().on(t.createdAt),
  uniquePerEvent: uniqueIndex().on(t.eventId, t.flagType),
}));
```

Onde `FlagType = "student_absent" | "teacher_late" | "teacher_very_late" | "teacher_unmotivated" | "students_disengaged"`.

## Fluxos críticos (referência)

Os fluxos detalhados estão na seção 3 da apresentação de design e refletidos no `02-escopo`. Os 4 que mais merecem atenção arquitetural:

1. **Auth Google** — `lib/google/auth.ts` instancia `google.auth.GoogleAuth` aceitando duas formas de credencial:
   - **Produção:** `GOOGLE_SERVICE_ACCOUNT_JSON` — JSON inteiro em base64 numa única env var (decodificado e passado como `credentials`).
   - **Dev local:** `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` — caminho pro arquivo `secrets/google-service-account.json`.
   Sem callback, sem refresh token, sem encryption. Ver ADR-012.
2. **Sync incremental** — `lib/sync/run.ts` chamado a cada 5 min via `setInterval` registrado em `instrumentation.ts`. Mutex em memória previne overlap. Quando `syncToken` retorna 410, faz full sync da janela `[-90d, +30d]` com paginação automática.
3. **Edição de evento** — operação dual-write: `events.patch()` no Google primeiro, com etag; só em caso de sucesso atualiza o cache local. Falha → erro visível ao usuário, sem inconsistência.
4. **Toggle de flag** — escrita local somente. Sem efeito colateral fora do app.

## Segurança

- Senhas com **bcrypt** (cost factor 12+).
- Service account em **env var base64** (`GOOGLE_SERVICE_ACCOUNT_JSON`) em produção; em dev local, arquivo `secrets/google-service-account.json` (gitignored, perms 600). Ver ADR-012.
- `ENCRYPTION_KEY` (32 bytes base64) mantida no env como utilitário (`lib/crypto/aes-gcm.ts` — sem consumidor ativo no MVP).
- `SESSION_SECRET` (32+ chars) usada por iron-session para cifrar o cookie.
- Cookies de sessão: `HttpOnly`, `Secure`, `SameSite=Lax`, expiram em 7 dias.
- TLS terminado em Traefik (Let's Encrypt). Cloudflare faz só DNS por padrão; proxy laranja pode ser religado depois de o cert estabilizar.
- Variáveis sensíveis vivem **apenas no painel do Portainer** e na cópia pessoal do operador (1Password/Bitwarden). O repo só carrega `docker/stack.yml` como template (`${VARS}`). Ver seção [Operação](#operação).

## Observabilidade

MVP modesto:

- Log estruturado JSON no stdout (Pino).
- Sentry (free tier) para captura de erros não tratados — opcional, decidir no plano de execução.
- Métrica simples de "última sync" e "última sync com erro" exposta em `/config`.

Sem Prometheus, sem Grafana — escopo de uma única escola.

## Deploy

Pipeline contínuo (vive em `.github/workflows/build-and-deploy.yml`):

```
git push main
    │
    ▼
GitHub Actions
  1. docker build (Dockerfile multi-stage, Node 22 alpine)
  2. docker push ghcr.io/escolaskatedreams/skatedreams:latest (+ :sha)
  3. curl -X POST $PORTAINER_WEBHOOK_URL
    │
    ▼
Portainer (CE) recebe webhook
  → docker service update --force --image ... app_app
  → puxa imagem nova do GHCR (público) e troca o container
    │
    ▼
entrypoint.sh do container
  1. npx drizzle-kit migrate
  2. node next start
```

**Tempo médio push → live:** ~5 min (build domina; webhook + swap são ~30s).

**Componentes do pipeline:**

| Pedaço | Onde mora | Como muda |
|---|---|---|
| Workflow CI | `.github/workflows/build-and-deploy.yml` no repo | edit + push |
| Imagem Docker | `ghcr.io/escolaskatedreams/skatedreams` (público) | CI publica em todo push pra `main` |
| `PORTAINER_WEBHOOK_URL` | GitHub Secret no repo | `gh secret set` |
| Webhook do Portainer | criado via API em `painel.skatedreams.com.br` | Portainer UI ou API |
| Stack do Swarm | painel do Portainer (Stacks → `app`) | UI: cola `docker/stack.deploy.yml` |
| Env vars de runtime | painel do Portainer (Stack environment) | UI |
| Imagem `:latest` cache | host Hetzner | `docker pull` ou redeploy |

**O que NÃO entra automático nesse pipeline:**

- Mudanças no `stack.yml` (labels Traefik, env nova, service novo) — só com update da stack no Portainer.
- Mudanças em env var existente — só no painel do Portainer.

**Reverter / redeployar manualmente:**

```bash
# do seu shell (com chave SSH do operador)
ssh skatedreams 'docker service update --force --image ghcr.io/escolaskatedreams/skatedreams:<sha-anterior> app_app'

# OU disparar webhook na mão (puxa latest):
curl -X POST "$(grep PORTAINER_WEBHOOK_URL secrets/portainer-token | cut -d= -f2-)"
```

## Operação

### Inventário do host

- **Hetzner Cloud (Falkenstein):** 1 VM `manager` em `178.156.235.107`.
- **Domínios em uso:**
  - `app.skatedreams.com.br` → aplicação
  - `painel.skatedreams.com.br` → Portainer

### Acesso

- **SSH:** `root@178.156.235.107` por chave pública (alias local `skatedreams` no `~/.ssh/config` do operador). Senha root **deve** ficar desligada — `PasswordAuthentication no` em `/etc/ssh/sshd_config`.
- **Estações autorizadas** (`/root/.ssh/authorized_keys`): chave de Pedro Mascarenhas (WSL `manager01`). Adicionar nova estação implica em commitar a public key e ela aparecer aqui.
- **Portainer:** https://painel.skatedreams.com.br — admin único; tokens de API revogáveis em *My account → Access tokens* pra automações.

### Segredos — onde mora cada coisa

| Segredo | Fonte da verdade | Cópia local do operador |
|---|---|---|
| Senha root SSH do host | (idealmente desativada) | — |
| Chave SSH do operador | `~/.ssh/id_ed25519` na estação dele | — |
| Env vars do app | painel Portainer (Stack environment) | `docker/stack.env` (gitignored, 600) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | env var no Portainer (base64) | `secrets/google-service-account.json` (gitignored, 600) |
| `PORTAINER_WEBHOOK_URL` | GitHub Secrets do repo | `secrets/portainer-token` (gitignored, 600) |
| Token API do Portainer | criado por demanda; revogável | `secrets/portainer-token` |
| Credenciais do app (`SEED_EMAIL`/`SEED_PASSWORD`) | env vars no Portainer | 1Password/Bitwarden do operador |

> `secrets/portainer-token` agrega `PORTAINER_TOKEN`, `PORTAINER_BASE` e `PORTAINER_WEBHOOK_URL` num único arquivo gitignored. Útil pra scripts de automação local; não substitui o cofre.

### Network do Swarm

Duas networks por design:

- `network_swarm_public` — externa, compartilhada com Traefik. Só serviços expostos entram.
- `app_internal` — interna do stack, comunicação app ↔ postgres.

### Logs e debug rápido

```bash
ssh skatedreams '
docker service ls
docker service ps app_app --no-trunc | head -5
docker service logs app_app --tail 80
docker service logs traefik_traefik --tail 80 | grep -i skate
'
```

### Rotação de chaves

- **Service account Google:** gerar novo JSON no GCP → `base64 -w0` → atualizar `GOOGLE_SERVICE_ACCOUNT_JSON` no Portainer → *Update the stack*. Revogar a chave antiga no GCP só depois de confirmar saúde.
- **Token do Portainer:** revogar em *My account → Access tokens*; criar novo se ainda precisar de automação.
- **`SESSION_SECRET` / `ENCRYPTION_KEY`:** gerar novas, atualizar env vars do stack, *Update*. Sessões ativas serão invalidadas (usuário precisa relogar).
