# 03 — Arquitetura

## Visão geral

```
┌─────────────────────────────────────────────────────────────┐
│                  Cloudflare — DNS + WAF + Proxy             │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS
                           ▼
┌─────────────────────────────────────────────────────────────┐
│         Hetzner — Docker Swarm (gerenciado: Portainer)      │
│                                                             │
│  ┌──────────────────────┐      ┌────────────────────────┐   │
│  │  app-skatedreams     │      │  postgres:16            │  │
│  │  Next.js (App Rtr)   │◄────►│  volume persistente     │  │
│  │  serve UI + API      │      └────────────────────────┘  │
│  │  + cron de sync      │                                  │
│  └──────────┬───────────┘                                  │
└─────────────┼──────────────────────────────────────────────┘
              │
              ▼ HTTPS
        Google Calendar API
        OAuth 2.0 — events, events.readonly
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
| Orquestração | Docker Swarm via Portainer |
| Edge | Cloudflare (DNS + proxy + WAF) |

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
│   │       ├── auth/[...]
│   │       ├── google/callback/
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
│   │   ├── google/                # cliente OAuth + Calendar
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
│   ├── docker-compose.yml         # dev local
│   └── stack.yml                  # Docker Swarm prod
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
  googleEmail: text("google_email").notNull(),
  accessTokenEnc: text("access_token_enc").notNull(),
  refreshTokenEnc: text("refresh_token_enc").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  calendarId: text("calendar_id").notNull().default("primary"),
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

1. **OAuth do Google** — fluxo em `/api/google/callback`. State param para CSRF. Tokens passam por `lib/crypto/aes-gcm.ts` antes do `INSERT`.
2. **Sync incremental** — `lib/sync/run.ts` chamado a cada 5 min via `setInterval` registrado em `instrumentation.ts`. Mutex em memória + `SELECT FOR UPDATE` na linha de `google_connection` para impedir overlap. Quando `syncToken` retorna 410, faz full sync da janela `[-90d, +30d]`.
3. **Edição de evento** — operação dual-write: nossa API faz `events.patch()` no Google **primeiro**, com etag; só em caso de sucesso (200) atualiza o cache local. Falha → erro visível ao usuário, sem inconsistência.
4. **Toggle de flag** — escrita local somente. Sem efeito colateral fora do app. Operação simples.

## Segurança

- Senhas com **bcrypt** (cost factor 12+).
- Tokens OAuth criptografados com **AES-256-GCM** usando `ENCRYPTION_KEY` (32 bytes random, no env).
- Cookies de sessão: `HttpOnly`, `Secure`, `SameSite=Lax`, expira em 7 dias.
- Cloudflare na frente, com regra básica para bloquear bots agressivos.
- Variáveis de ambiente em `.env` no host, montadas como secrets do Docker Swarm.

## Observabilidade

MVP modesto:

- Log estruturado JSON no stdout (Pino).
- Sentry (free tier) para captura de erros não tratados — opcional, decidir no plano de execução.
- Métrica simples de "última sync" e "última sync com erro" exposta em `/config`.

Sem Prometheus, sem Grafana — escopo de uma única escola.

## Deploy

1. Build da imagem via CI ao mergear em `main` (provedor — GH Actions ou outro — decidido no plano de execução).
2. Push para um registry privado (GHCR ou Docker Hub privado).
3. Portainer faz pull e atualiza o serviço no Swarm.
4. Migrations rodam via `drizzle-kit migrate` num passo `pre_start` do container.
5. Cloudflare aponta para o IP da Hetzner; Swarm publica porta 80 → Cloudflare faz TLS.

Detalhes finais (registry escolhido, conta GitHub) ficam pro plano de execução.
