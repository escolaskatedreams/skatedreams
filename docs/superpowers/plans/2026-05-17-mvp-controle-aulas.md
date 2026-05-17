# MVP — Controle de Aulas SkateDreams — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o MVP do app SkateDreams: webapp Next.js que lê o Google Calendar da escola, exibe os eventos numa UI estilo Google Agenda, e permite ao professor marcar 5 flags por aula (❌ ⏱️ ⏱️⏱️ 😐 😭), com relatórios consolidados e export CSV.

**Architecture:** Next.js 15 App Router (UI + API + cron de sync no mesmo container). Postgres 16 como cache dos eventos do Google + storage dos flags. Drizzle ORM. FullCalendar para a view. Deploy num container Docker no Swarm da Hetzner, Cloudflare na frente.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind v3, shadcn/ui, FullCalendar v6, Drizzle ORM, Postgres 16, googleapis, iron-session, bcryptjs, Zod, react-hook-form, Playwright, Vitest, Docker.

**Spec de referência:** `docs/01-contexto-e-problema.md` · `docs/02-escopo-e-entregas.md` · `docs/03-arquitetura.md` · `docs/04-adrs.md`

**Convenção de commit:** `<type>: <descrição curta em pt-BR>` (`feat`, `fix`, `chore`, `docs`, `test`, `refactor`).

---

## Mapa de arquivos

```
app-skatedreams/
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── drizzle.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── .env.example
├── .env.local                     (git-ignored)
├── .eslintrc.json
├── docker/
│   ├── Dockerfile
│   ├── docker-compose.yml         (dev: postgres + app)
│   └── stack.yml                  (prod: Swarm)
├── src/
│   ├── instrumentation.ts         (registra cron de sync)
│   ├── middleware.ts              (guard de auth)
│   ├── env.ts                     (validação Zod das env vars)
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   ├── page.tsx               (redirect → /agenda)
│   │   ├── login/
│   │   │   ├── page.tsx
│   │   │   └── actions.ts
│   │   ├── agenda/
│   │   │   ├── page.tsx
│   │   │   └── _components/CalendarView.tsx
│   │   ├── relatorios/
│   │   │   ├── page.tsx
│   │   │   └── _components/ReportTable.tsx
│   │   ├── config/
│   │   │   ├── page.tsx
│   │   │   └── actions.ts
│   │   ├── aula/[id]/page.tsx     (página standalone do evento)
│   │   ├── @modal/
│   │   │   ├── default.tsx
│   │   │   └── (.)aula/[id]/page.tsx   (route intercept → drawer)
│   │   └── api/
│   │       ├── google/callback/route.ts
│   │       ├── calendar/sync/route.ts
│   │       ├── events/[id]/route.ts          (PATCH)
│   │       ├── events/[id]/flags/route.ts    (POST, DELETE)
│   │       └── reports/export/route.ts       (GET → CSV)
│   ├── components/
│   │   ├── ui/                       (shadcn primitives)
│   │   ├── flags/{FlagChip,FlagBar}.tsx
│   │   ├── calendar/LessonEventCard.tsx
│   │   ├── layout/Topbar.tsx
│   │   └── reports/SummaryCards.tsx
│   ├── lib/
│   │   ├── auth/{session,password,guards}.ts
│   │   ├── crypto/aes-gcm.ts
│   │   ├── google/{oauth-client,calendar}.ts
│   │   ├── sync/{run,parse-student-name,cron}.ts
│   │   ├── reports/aggregate.ts
│   │   ├── flags/types.ts
│   │   └── db/{schema,client,index}.ts
│   └── styles/
└── tests/
    ├── unit/lib/
    │   ├── crypto/aes-gcm.test.ts
    │   ├── sync/parse-student-name.test.ts
    │   ├── sync/run.test.ts
    │   ├── google/calendar.test.ts
    │   └── reports/aggregate.test.ts
    └── e2e/golden-path.spec.ts
```

---

# Fase 1 — Fundação

## Task 1: Scaffold do Next.js + TypeScript + Tailwind

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `tailwind.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`

- [ ] **Step 1: Iniciar projeto Next.js**

```bash
cd /home/pedro/app-skatedreams
npx create-next-app@15 . --typescript --tailwind --app --src-dir --no-import-alias --use-npm --eslint --skip-install
```

Aceita todos os defaults. Sobrescreve arquivos existentes do skeleton se houver.

- [ ] **Step 2: Instalar dependências base**

```bash
npm install next@15 react@19 react-dom@19 typescript tailwindcss@^3 postcss autoprefixer
npm install -D @types/node @types/react @types/react-dom eslint eslint-config-next prettier
```

- [ ] **Step 3: Configurar `tsconfig.json` com paths**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Rodar dev server para sanidade**

```bash
npm run dev
```

Expected: servidor sobe em `http://localhost:3000`. Ctrl+C para parar.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold next.js 15 + typescript + tailwind"
```

---

## Task 2: Configurar Postgres local via Docker Compose

**Files:**
- Create: `docker/docker-compose.yml`, `.env.example`, `.env.local`, `src/env.ts`

- [ ] **Step 1: Criar `docker/docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: skatedreams
      POSTGRES_PASSWORD: skatedreams_dev
      POSTGRES_DB: skatedreams
    ports:
      - "5432:5432"
    volumes:
      - skatedreams_pg:/var/lib/postgresql/data

volumes:
  skatedreams_pg:
```

- [ ] **Step 2: Subir o Postgres**

```bash
docker compose -f docker/docker-compose.yml up -d
docker compose -f docker/docker-compose.yml ps
```

Expected: container `postgres` em estado `running` na porta 5432.

- [ ] **Step 3: Criar `.env.example`**

```
# Database
DATABASE_URL=postgres://skatedreams:skatedreams_dev@localhost:5432/skatedreams

# Crypto
ENCRYPTION_KEY=  # 32 bytes em base64 — gerar com: openssl rand -base64 32
SESSION_SECRET=  # 32+ chars random — gerar com: openssl rand -hex 32

# Auth (seed do usuário compartilhado)
SEED_EMAIL=admin@skatedreams.local
SEED_PASSWORD=trocar-em-producao

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google/callback

# Sync
SYNC_INTERVAL_MS=300000   # 5 min
SYNC_WINDOW_PAST_DAYS=90
SYNC_WINDOW_FUTURE_DAYS=30
```

- [ ] **Step 4: Criar `.env.local` (cópia do example com valores reais)**

```bash
cp .env.example .env.local
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)" >> /tmp/keys
echo "SESSION_SECRET=$(openssl rand -hex 32)" >> /tmp/keys
cat /tmp/keys
# Copiar os valores em /tmp/keys para .env.local
rm /tmp/keys
```

- [ ] **Step 5: Criar `src/env.ts` (validação Zod)**

```typescript
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  ENCRYPTION_KEY: z.string().min(32),
  SESSION_SECRET: z.string().min(32),
  SEED_EMAIL: z.string().email(),
  SEED_PASSWORD: z.string().min(8),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  SYNC_INTERVAL_MS: z.coerce.number().int().positive().default(300000),
  SYNC_WINDOW_PAST_DAYS: z.coerce.number().int().positive().default(90),
  SYNC_WINDOW_FUTURE_DAYS: z.coerce.number().int().positive().default(30),
});

export const env = schema.parse(process.env);
```

- [ ] **Step 6: Instalar Zod**

```bash
npm install zod
```

- [ ] **Step 7: Verificar que `npm run build` ainda passa**

```bash
npm run build
```

Expected: build OK (mesmo sem usar env.ts ainda — só validamos o módulo).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: postgres local + validação de env vars"
```

---

## Task 3: Setup Drizzle + schema inicial + primeira migration

**Files:**
- Create: `drizzle.config.ts`, `src/lib/db/schema.ts`, `src/lib/db/client.ts`, `src/lib/db/index.ts`

- [ ] **Step 1: Instalar Drizzle**

```bash
npm install drizzle-orm pg
npm install -D drizzle-kit @types/pg
```

- [ ] **Step 2: Criar `drizzle.config.ts`**

```typescript
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./src/lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

- [ ] **Step 3: Criar `src/lib/db/schema.ts` com as 4 tabelas**

```typescript
import { pgTable, uuid, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";

export type FlagType =
  | "student_absent"
  | "teacher_late"
  | "teacher_very_late"
  | "teacher_unmotivated"
  | "students_disengaged";

export const FLAG_TYPES: FlagType[] = [
  "student_absent",
  "teacher_late",
  "teacher_very_late",
  "teacher_unmotivated",
  "students_disengaged",
];

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

export const calendarEvents = pgTable(
  "calendar_events",
  {
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
  },
  (t) => ({
    startsAtIdx: index("calendar_events_starts_at_idx").on(t.startsAt),
  }),
);

export const eventFlags = pgTable(
  "event_flags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => calendarEvents.id, { onDelete: "cascade" }),
    flagType: text("flag_type").$type<FlagType>().notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    eventIdx: index("event_flags_event_id_idx").on(t.eventId),
    createdAtIdx: index("event_flags_created_at_idx").on(t.createdAt),
    uniquePerEvent: uniqueIndex("event_flags_event_flag_unique").on(t.eventId, t.flagType),
  }),
);
```

- [ ] **Step 4: Criar `src/lib/db/client.ts`**

```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/env";
import * as schema from "./schema";

const pool = new Pool({ connectionString: env.DATABASE_URL });

export const db = drizzle(pool, { schema });
export type DB = typeof db;
```

- [ ] **Step 5: Criar `src/lib/db/index.ts`**

```typescript
export * from "./client";
export * from "./schema";
```

- [ ] **Step 6: Gerar a primeira migration**

```bash
npx drizzle-kit generate --name init
```

Expected: arquivo `src/lib/db/migrations/0000_init.sql` é criado.

- [ ] **Step 7: Aplicar a migration**

```bash
npx drizzle-kit migrate
```

Expected: as 4 tabelas existem no Postgres. Verificar com:

```bash
docker compose -f docker/docker-compose.yml exec postgres psql -U skatedreams -d skatedreams -c "\dt"
```

Expected: lista contém `users`, `google_connection`, `calendar_events`, `event_flags`.

- [ ] **Step 8: Adicionar scripts no `package.json`**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio"
  }
}
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: drizzle + schema inicial (users, google_connection, calendar_events, event_flags)"
```

---

## Task 4: Módulo de criptografia (AES-256-GCM)

**Files:**
- Create: `src/lib/crypto/aes-gcm.ts`, `tests/unit/lib/crypto/aes-gcm.test.ts`
- Modify: `package.json` (adicionar Vitest)

- [ ] **Step 1: Instalar Vitest**

```bash
npm install -D vitest @vitest/coverage-v8
```

- [ ] **Step 2: Criar `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    coverage: { reporter: ["text", "html"] },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

- [ ] **Step 3: Adicionar script `test` no `package.json`**

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Escrever o teste primeiro (RED)**

`tests/unit/lib/crypto/aes-gcm.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "@/lib/crypto/aes-gcm";

const KEY = Buffer.from("a".repeat(32)).toString("base64");

describe("aes-gcm", () => {
  it("encrypts and decrypts a string", () => {
    const plaintext = "ya29.refresh_token_secret";
    const ciphertext = encrypt(plaintext, KEY);
    expect(ciphertext).not.toBe(plaintext);
    expect(decrypt(ciphertext, KEY)).toBe(plaintext);
  });

  it("produces different ciphertexts for the same plaintext (random IV)", () => {
    const a = encrypt("same", KEY);
    const b = encrypt("same", KEY);
    expect(a).not.toBe(b);
  });

  it("throws on tampered ciphertext", () => {
    const c = encrypt("hello", KEY);
    const tampered = c.slice(0, -2) + "00";
    expect(() => decrypt(tampered, KEY)).toThrow();
  });

  it("throws on wrong key", () => {
    const wrongKey = Buffer.from("b".repeat(32)).toString("base64");
    const c = encrypt("hello", KEY);
    expect(() => decrypt(c, wrongKey)).toThrow();
  });
});
```

- [ ] **Step 5: Rodar o teste para confirmar que falha**

```bash
npm test -- aes-gcm
```

Expected: FAIL — module not found.

- [ ] **Step 6: Implementar o módulo**

`src/lib/crypto/aes-gcm.ts`:

```typescript
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function keyBuf(b64: string): Buffer {
  const buf = Buffer.from(b64, "base64");
  if (buf.length !== 32) throw new Error("ENCRYPTION_KEY must decode to 32 bytes");
  return buf;
}

/**
 * Output format: base64(iv || tag || ciphertext)
 */
export function encrypt(plaintext: string, key: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, keyBuf(key), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decrypt(payload: string, key: string): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, keyBuf(key), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
```

- [ ] **Step 7: Rodar o teste e confirmar que passa (GREEN)**

```bash
npm test -- aes-gcm
```

Expected: 4 tests passed.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(crypto): aes-256-gcm encrypt/decrypt para tokens em repouso"
```

---

## Task 5: Auth — hashing de senha + sessão iron-session

**Files:**
- Create: `src/lib/auth/password.ts`, `src/lib/auth/session.ts`, `src/lib/auth/guards.ts`
- Modify: `src/env.ts` (já tem SESSION_SECRET)

- [ ] **Step 1: Instalar deps**

```bash
npm install bcryptjs iron-session
npm install -D @types/bcryptjs
```

- [ ] **Step 2: Criar `src/lib/auth/password.ts`**

```typescript
import bcrypt from "bcryptjs";

const COST = 12;

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, COST);
}

export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}
```

- [ ] **Step 3: Criar `src/lib/auth/session.ts`**

```typescript
import { getIronSession, IronSession, SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { env } from "@/env";

export type SessionData = {
  userId?: string;
  email?: string;
  role?: "admin" | "professor";
};

const options: SessionOptions = {
  password: env.SESSION_SECRET,
  cookieName: "skatedreams_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 dias
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), options);
}
```

- [ ] **Step 4: Criar `src/lib/auth/guards.ts`**

```typescript
import { redirect } from "next/navigation";
import { getSession } from "./session";

export async function requireSession() {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  return session;
}
```

- [ ] **Step 5: Verificar que o build passa**

```bash
npm run build
```

Expected: build passes (módulos auth ainda não usados em routes; só compilação).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(auth): password hashing + iron-session"
```

---

## Task 6: Seed do usuário compartilhado

**Files:**
- Create: `scripts/seed.ts`
- Modify: `package.json`

- [ ] **Step 1: Criar `scripts/seed.ts`**

```typescript
import "dotenv/config";
import { db, users } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { env } from "@/env";
import { eq } from "drizzle-orm";

async function main() {
  const existing = await db.select().from(users).where(eq(users.email, env.SEED_EMAIL));
  if (existing.length > 0) {
    console.log("Seed user already exists:", env.SEED_EMAIL);
    process.exit(0);
  }
  const hash = await hashPassword(env.SEED_PASSWORD);
  await db.insert(users).values({
    email: env.SEED_EMAIL,
    passwordHash: hash,
    role: "admin",
  });
  console.log("Seed user created:", env.SEED_EMAIL);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Instalar `tsx` e `dotenv`**

```bash
npm install -D tsx
npm install dotenv
```

- [ ] **Step 3: Adicionar script no `package.json`**

```json
"db:seed": "tsx scripts/seed.ts"
```

- [ ] **Step 4: Rodar o seed**

```bash
npm run db:seed
```

Expected: log "Seed user created: admin@skatedreams.local".

- [ ] **Step 5: Verificar no Postgres**

```bash
docker compose -f docker/docker-compose.yml exec postgres psql -U skatedreams -d skatedreams -c "SELECT email, role FROM users;"
```

Expected: linha única com email e role=admin.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(db): seed do usuário compartilhado admin"
```

---

## Task 7: Página de login + server action

**Files:**
- Create: `src/app/login/page.tsx`, `src/app/login/actions.ts`, `src/app/page.tsx` (redirect)
- Modify: `src/middleware.ts`

- [ ] **Step 1: Criar `src/app/login/actions.ts`**

```typescript
"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, users } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { getSession } from "@/lib/auth/session";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function loginAction(_prev: unknown, formData: FormData) {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Dados inválidos" };

  const found = await db.select().from(users).where(eq(users.email, parsed.data.email));
  if (found.length === 0) return { error: "Credenciais inválidas" };

  const user = found[0];
  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) return { error: "Credenciais inválidas" };

  const session = await getSession();
  session.userId = user.id;
  session.email = user.email;
  session.role = user.role;
  await session.save();

  redirect("/agenda");
}
```

- [ ] **Step 2: Criar `src/app/login/page.tsx`**

```tsx
"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";

export default function LoginPage() {
  const [state, formAction] = useActionState(loginAction, null);

  return (
    <main className="min-h-screen grid place-items-center bg-neutral-50 px-4">
      <form action={formAction} className="w-full max-w-sm space-y-4 bg-white p-6 rounded-lg shadow">
        <h1 className="text-2xl font-bold">SkateDreams</h1>
        <p className="text-sm text-neutral-600">Entrar no sistema</p>

        <div>
          <label className="block text-sm mb-1">Email</label>
          <input name="email" type="email" required className="w-full border rounded px-3 py-2" />
        </div>

        <div>
          <label className="block text-sm mb-1">Senha</label>
          <input name="password" type="password" required className="w-full border rounded px-3 py-2" />
        </div>

        {state?.error && <p className="text-red-600 text-sm">{state.error}</p>}

        <button className="w-full bg-neutral-900 text-white py-2 rounded font-medium">Entrar</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Criar `src/app/page.tsx` que redireciona pra /agenda**

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/agenda");
}
```

- [ ] **Step 4: Criar `src/middleware.ts`**

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC = ["/login", "/api/google/callback"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) return NextResponse.next();

  const cookie = req.cookies.get("skatedreams_session");
  if (!cookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 5: Subir o dev server e testar login manualmente**

```bash
npm run dev
```

No browser:
- Abrir `http://localhost:3000` → redireciona pra `/login`.
- Tentar email errado → "Credenciais inválidas".
- Logar com `admin@skatedreams.local` / senha do `.env.local` → redireciona pra `/agenda` (404 ok ainda).

- [ ] **Step 6: Criar placeholder `/agenda` para o redirect funcionar**

`src/app/agenda/page.tsx`:

```tsx
export default function AgendaPage() {
  return <div className="p-8">Agenda — em construção</div>;
}
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(auth): tela de login + middleware de proteção de rota"
```

---

# Fase 2 — Integração Google Calendar

## Task 8: Cliente OAuth do Google

**Files:**
- Create: `src/lib/google/oauth-client.ts`

- [ ] **Step 1: Instalar `googleapis`**

```bash
npm install googleapis
```

- [ ] **Step 2: Criar `src/lib/google/oauth-client.ts`**

```typescript
import { google } from "googleapis";
import { env } from "@/env";

export const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function makeOAuthClient() {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
    throw new Error("Google OAuth env vars missing");
  }
  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI,
  );
}

export function buildAuthUrl(state: string): string {
  const client = makeOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // garante refresh_token
    scope: SCOPES,
    state,
  });
}
```

- [ ] **Step 3: Confirmar build**

```bash
npm run build
```

Expected: ok.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(google): oauth client + scopes calendar.events/readonly"
```

---

## Task 9: Route de callback OAuth + persistência da conexão

**Files:**
- Create: `src/app/api/google/callback/route.ts`, `src/lib/google/connection.ts`

- [ ] **Step 1: Criar `src/lib/google/connection.ts`**

```typescript
import { db, googleConnection } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto/aes-gcm";
import { env } from "@/env";
import { makeOAuthClient } from "./oauth-client";

export async function saveConnection(input: {
  googleEmail: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}) {
  // Singleton: limpa e insere
  await db.delete(googleConnection);
  await db.insert(googleConnection).values({
    googleEmail: input.googleEmail,
    accessTokenEnc: encrypt(input.accessToken, env.ENCRYPTION_KEY),
    refreshTokenEnc: encrypt(input.refreshToken, env.ENCRYPTION_KEY),
    expiresAt: input.expiresAt,
    calendarId: "primary",
  });
}

export async function getConnection() {
  const rows = await db.select().from(googleConnection).limit(1);
  if (rows.length === 0) return null;
  const c = rows[0];
  return {
    ...c,
    accessToken: decrypt(c.accessTokenEnc, env.ENCRYPTION_KEY),
    refreshToken: decrypt(c.refreshTokenEnc, env.ENCRYPTION_KEY),
  };
}

export async function getAuthorizedClient() {
  const conn = await getConnection();
  if (!conn) throw new Error("No google connection");
  const client = makeOAuthClient();
  client.setCredentials({
    access_token: conn.accessToken,
    refresh_token: conn.refreshToken,
    expiry_date: conn.expiresAt.getTime(),
  });
  return client;
}
```

- [ ] **Step 2: Criar `src/app/api/google/callback/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { makeOAuthClient } from "@/lib/google/oauth-client";
import { saveConnection } from "@/lib/google/connection";
import { getSession } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.userId) return NextResponse.redirect(new URL("/login", req.url));

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const expected = (session as any).oauthState as string | undefined;

  if (!code || !state || state !== expected) {
    return NextResponse.redirect(new URL("/config?error=invalid_state", req.url));
  }

  const client = makeOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const me = await oauth2.userinfo.get();

  if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
    return NextResponse.redirect(new URL("/config?error=missing_tokens", req.url));
  }

  await saveConnection({
    googleEmail: me.data.email ?? "unknown@unknown",
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: new Date(tokens.expiry_date),
  });

  // limpa state
  (session as any).oauthState = undefined;
  await session.save();

  return NextResponse.redirect(new URL("/config?connected=1", req.url));
}
```

- [ ] **Step 3: Confirmar build**

```bash
npm run build
```

Expected: ok.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(google): callback OAuth + persistência criptografada da conexão"
```

---

## Task 10: Página /config — conectar/desconectar Google

**Files:**
- Create: `src/app/config/page.tsx`, `src/app/config/actions.ts`

- [ ] **Step 1: Criar `src/app/config/actions.ts`**

```typescript
"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { db, googleConnection } from "@/lib/db";
import { buildAuthUrl } from "@/lib/google/oauth-client";
import { getSession } from "@/lib/auth/session";
import { requireSession } from "@/lib/auth/guards";

export async function startGoogleOAuth() {
  await requireSession();
  const session = await getSession();
  const state = randomBytes(16).toString("hex");
  (session as any).oauthState = state;
  await session.save();
  const url = buildAuthUrl(state);
  redirect(url);
}

export async function disconnectGoogle() {
  await requireSession();
  await db.delete(googleConnection);
  redirect("/config");
}

export async function logoutAction() {
  const session = await getSession();
  session.destroy();
  redirect("/login");
}
```

- [ ] **Step 2: Criar `src/app/config/page.tsx`**

```tsx
import { requireSession } from "@/lib/auth/guards";
import { getConnection } from "@/lib/google/connection";
import { startGoogleOAuth, disconnectGoogle, logoutAction } from "./actions";

export default async function ConfigPage() {
  await requireSession();
  const conn = await getConnection();

  return (
    <main className="max-w-2xl mx-auto p-8 space-y-8">
      <h1 className="text-3xl font-bold">Configurações</h1>

      <section className="border rounded-lg p-4 space-y-3">
        <h2 className="text-xl font-semibold">Google Calendar</h2>
        {conn ? (
          <>
            <p className="text-sm text-neutral-600">
              Conectado como <strong>{conn.googleEmail}</strong>.
            </p>
            <p className="text-sm text-neutral-600">
              Última sync:{" "}
              {conn.lastSyncAt
                ? new Intl.DateTimeFormat("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(conn.lastSyncAt)
                : "ainda não"}
            </p>
            <form action={disconnectGoogle}>
              <button className="bg-red-600 text-white px-4 py-2 rounded">Desconectar</button>
            </form>
          </>
        ) : (
          <>
            <p className="text-sm text-neutral-600">Nenhuma conta Google conectada.</p>
            <form action={startGoogleOAuth}>
              <button className="bg-blue-600 text-white px-4 py-2 rounded">
                Conectar Google Calendar
              </button>
            </form>
          </>
        )}
      </section>

      <section className="border rounded-lg p-4">
        <form action={logoutAction}>
          <button className="text-red-600 underline">Sair</button>
        </form>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Subir o dev server e testar fluxo manualmente**

```bash
npm run dev
```

Abrir `http://localhost:3000/config`. Clicar "Conectar Google Calendar". Faz OAuth com uma conta de teste do Google. Volta na `/config` com `connected=1` e mostra o email.

> Se ainda não há credenciais Google: criar projeto no Google Cloud, habilitar Calendar API, criar OAuth 2.0 Client ID, autorizar `http://localhost:3000/api/google/callback`. Colar Client ID + Secret no `.env.local`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(config): tela de configuração com conexão Google"
```

---

## Task 11: Parser de student_name (TDD)

**Files:**
- Create: `src/lib/sync/parse-student-name.ts`, `tests/unit/lib/sync/parse-student-name.test.ts`

- [ ] **Step 1: Escrever os testes (RED)**

`tests/unit/lib/sync/parse-student-name.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseStudentName } from "@/lib/sync/parse-student-name";

describe("parseStudentName", () => {
  it("extrai do padrão 'Aula — Nome — 16h'", () => {
    expect(parseStudentName("Aula — Joãozinho — 16h")).toBe("Joãozinho");
  });

  it("extrai do padrão 'Aula - Nome - 16h' (hífen ASCII)", () => {
    expect(parseStudentName("Aula - Joãozinho - 16h")).toBe("Joãozinho");
  });

  it("extrai do padrão 'Aula <Nome>'", () => {
    expect(parseStudentName("Aula Maria")).toBe("Maria");
    expect(parseStudentName("Aula Maria Silva")).toBe("Maria Silva");
  });

  it("extrai do padrão '<Nome> — 16h'", () => {
    expect(parseStudentName("Lucas — 16h")).toBe("Lucas");
  });

  it("retorna null quando não bate nenhum padrão", () => {
    expect(parseStudentName("")).toBeNull();
    expect(parseStudentName("Reunião administrativa")).toBeNull();
    expect(parseStudentName("Almoço")).toBeNull();
  });

  it("normaliza espaços extras e trim", () => {
    expect(parseStudentName("Aula —   Pedro   — 14h")).toBe("Pedro");
  });

  it("não pega 'Aula' nem horários como nome", () => {
    expect(parseStudentName("Aula 16h")).toBeNull();
    expect(parseStudentName("16h Aula")).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar — confirmar FAIL**

```bash
npm test -- parse-student-name
```

- [ ] **Step 3: Implementar**

`src/lib/sync/parse-student-name.ts`:

```typescript
const TIME_TOKEN = /^\d{1,2}h(\d{2})?$/i;

function isHourish(token: string): boolean {
  return TIME_TOKEN.test(token);
}

function clean(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Heurística de extração do nome do aluno a partir do título do evento.
 * Padrões cobertos:
 *   - "Aula — Nome — 16h" / "Aula - Nome - 16h"
 *   - "Aula Nome [Sobrenome ...]"
 *   - "Nome — 16h"
 * Retorna null quando nenhum bate ou o resultado seria vazio / um horário / a palavra "Aula".
 */
export function parseStudentName(title: string): string | null {
  if (!title) return null;
  const normalized = clean(title.replace(/[–—]/g, "—"));

  // Padrão A: "Aula — X — Y" ou "Aula - X - Y"
  const segmented = normalized.split(/\s+[—-]\s+/).map(clean).filter(Boolean);
  if (segmented.length >= 2) {
    const head = segmented[0].toLowerCase();
    if (head === "aula") {
      const candidate = segmented[1];
      if (candidate && !isHourish(candidate) && candidate.toLowerCase() !== "aula") return candidate;
    } else if (!isHourish(segmented[0]) && segmented.slice(1).every(isHourish)) {
      return segmented[0];
    }
  }

  // Padrão B: "Aula <Nome>"
  const m = normalized.match(/^Aula\s+(.+)$/i);
  if (m) {
    const rest = clean(m[1]);
    const firstToken = rest.split(/\s+/)[0];
    if (!isHourish(firstToken) && firstToken.toLowerCase() !== "aula") {
      // pega tudo que não é horário no resto
      const nameTokens = rest.split(/\s+/).filter((t) => !isHourish(t));
      const name = nameTokens.join(" ");
      return name || null;
    }
  }

  return null;
}
```

- [ ] **Step 4: Rodar — confirmar GREEN**

```bash
npm test -- parse-student-name
```

Expected: 7 tests passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(sync): heurística de extração de student_name (ADR-009)"
```

---

## Task 12: Wrapper do Google Calendar (lib/google/calendar.ts)

**Files:**
- Create: `src/lib/google/calendar.ts`, `tests/unit/lib/google/calendar.test.ts`

- [ ] **Step 1: Escrever testes com mock do googleapis**

`tests/unit/lib/google/calendar.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const eventsList = vi.fn();
const eventsPatch = vi.fn();

vi.mock("googleapis", () => ({
  google: {
    calendar: () => ({
      events: { list: eventsList, patch: eventsPatch },
    }),
  },
}));

import { listEvents, patchEvent } from "@/lib/google/calendar";

const fakeClient = {} as any;

beforeEach(() => {
  eventsList.mockReset();
  eventsPatch.mockReset();
});

describe("listEvents", () => {
  it("aceita syncToken e devolve items + nextSyncToken", async () => {
    eventsList.mockResolvedValue({
      data: {
        items: [
          { id: "g1", summary: "Aula — Lucas — 16h", start: { dateTime: "2026-05-12T16:00:00-03:00" }, end: { dateTime: "2026-05-12T17:00:00-03:00" }, status: "confirmed", etag: "abc" },
        ],
        nextSyncToken: "next-token",
      },
    });
    const r = await listEvents(fakeClient, { calendarId: "primary", syncToken: "prev" });
    expect(eventsList).toHaveBeenCalledWith(expect.objectContaining({ calendarId: "primary", syncToken: "prev" }));
    expect(r.items).toHaveLength(1);
    expect(r.nextSyncToken).toBe("next-token");
  });

  it("relança 410 (sync token expirado)", async () => {
    eventsList.mockRejectedValue({ code: 410, message: "Sync token expired" });
    await expect(
      listEvents(fakeClient, { calendarId: "primary", syncToken: "old" }),
    ).rejects.toMatchObject({ code: 410 });
  });
});

describe("patchEvent", () => {
  it("encaminha campos para events.patch", async () => {
    eventsPatch.mockResolvedValue({ data: { id: "g1", etag: "xyz" } });
    const r = await patchEvent(fakeClient, "g1", {
      title: "Aula — Lucas — 17h",
      startsAt: new Date("2026-05-12T17:00:00-03:00"),
      endsAt: new Date("2026-05-12T18:00:00-03:00"),
    });
    expect(eventsPatch).toHaveBeenCalledWith(
      expect.objectContaining({
        calendarId: "primary",
        eventId: "g1",
        requestBody: expect.objectContaining({
          summary: "Aula — Lucas — 17h",
        }),
      }),
    );
    expect(r.etag).toBe("xyz");
  });
});
```

- [ ] **Step 2: Rodar — confirmar FAIL**

```bash
npm test -- google/calendar
```

- [ ] **Step 3: Implementar**

`src/lib/google/calendar.ts`:

```typescript
import { google, calendar_v3 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

type ListOpts =
  | { calendarId: string; syncToken: string }
  | { calendarId: string; timeMin: string; timeMax: string };

export type GEvent = calendar_v3.Schema$Event;

export async function listEvents(client: OAuth2Client, opts: ListOpts) {
  const cal = google.calendar({ version: "v3", auth: client });
  const params: calendar_v3.Params$Resource$Events$List = {
    calendarId: opts.calendarId,
    singleEvents: true,
    showDeleted: true,
    maxResults: 2500,
    ...("syncToken" in opts
      ? { syncToken: opts.syncToken }
      : { timeMin: opts.timeMin, timeMax: opts.timeMax, orderBy: "startTime" }),
  };
  const res = await cal.events.list(params);
  return {
    items: (res.data.items ?? []) as GEvent[],
    nextSyncToken: res.data.nextSyncToken ?? null,
  };
}

export async function patchEvent(
  client: OAuth2Client,
  googleEventId: string,
  patch: { title?: string; description?: string; startsAt?: Date; endsAt?: Date; status?: "confirmed" | "cancelled" },
  calendarId = "primary",
) {
  const cal = google.calendar({ version: "v3", auth: client });
  const requestBody: calendar_v3.Schema$Event = {
    ...(patch.title !== undefined ? { summary: patch.title } : {}),
    ...(patch.description !== undefined ? { description: patch.description } : {}),
    ...(patch.startsAt ? { start: { dateTime: patch.startsAt.toISOString() } } : {}),
    ...(patch.endsAt ? { end: { dateTime: patch.endsAt.toISOString() } } : {}),
    ...(patch.status ? { status: patch.status } : {}),
  };
  const res = await cal.events.patch({ calendarId, eventId: googleEventId, requestBody });
  return { id: res.data.id ?? googleEventId, etag: res.data.etag ?? null };
}
```

- [ ] **Step 4: Rodar — confirmar GREEN**

```bash
npm test -- google/calendar
```

Expected: 3 tests passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(google): wrappers listEvents/patchEvent com testes"
```

---

## Task 13: Rotina de sync (full + incremental) com testes

**Files:**
- Create: `src/lib/sync/run.ts`, `tests/unit/lib/sync/run.test.ts`

- [ ] **Step 1: Escrever testes da função de aplicar batch ao DB**

`tests/unit/lib/sync/run.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { eventsToUpserts } from "@/lib/sync/run";

describe("eventsToUpserts", () => {
  it("mapeia evento confirmed com dateTime", () => {
    const rows = eventsToUpserts([
      {
        id: "g1",
        summary: "Aula — Lucas — 16h",
        description: "",
        start: { dateTime: "2026-05-12T16:00:00-03:00" },
        end: { dateTime: "2026-05-12T17:00:00-03:00" },
        status: "confirmed",
        etag: "abc",
      } as any,
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      googleId: "g1",
      title: "Aula — Lucas — 16h",
      studentName: "Lucas",
      status: "confirmed",
      googleEtag: "abc",
    });
    expect(rows[0].startsAt).toBeInstanceOf(Date);
    expect(rows[0].endsAt).toBeInstanceOf(Date);
  });

  it("marca evento cancelled", () => {
    const rows = eventsToUpserts([
      { id: "g2", summary: null, status: "cancelled", etag: "z" } as any,
    ]);
    expect(rows[0].status).toBe("cancelled");
  });

  it("ignora eventos all-day (sem dateTime e não cancelled)", () => {
    const rows = eventsToUpserts([
      { id: "g3", summary: "Feriado", start: { date: "2026-05-12" }, end: { date: "2026-05-13" }, status: "confirmed" } as any,
    ]);
    expect(rows).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Rodar — FAIL**

```bash
npm test -- sync/run
```

- [ ] **Step 3: Implementar**

`src/lib/sync/run.ts`:

```typescript
import { db, calendarEvents, googleConnection } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { getAuthorizedClient } from "@/lib/google/connection";
import { listEvents, type GEvent } from "@/lib/google/calendar";
import { parseStudentName } from "./parse-student-name";
import { env } from "@/env";

type UpsertRow = {
  googleId: string;
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date;
  studentName: string | null;
  status: "confirmed" | "cancelled";
  googleEtag: string | null;
};

export function eventsToUpserts(events: GEvent[]): UpsertRow[] {
  const out: UpsertRow[] = [];
  for (const e of events) {
    if (!e.id) continue;
    const cancelled = e.status === "cancelled";
    const startDt = e.start?.dateTime;
    const endDt = e.end?.dateTime;
    if (!cancelled && (!startDt || !endDt)) continue; // ignora all-day
    out.push({
      googleId: e.id,
      title: e.summary ?? "(sem título)",
      description: e.description ?? null,
      startsAt: new Date(startDt ?? Date.now()),
      endsAt: new Date(endDt ?? Date.now()),
      studentName: e.summary ? parseStudentName(e.summary) : null,
      status: cancelled ? "cancelled" : "confirmed",
      googleEtag: e.etag ?? null,
    });
  }
  return out;
}

async function upsertBatch(rows: UpsertRow[]) {
  if (rows.length === 0) return;
  await db
    .insert(calendarEvents)
    .values(rows.map((r) => ({ ...r, syncedAt: new Date() })))
    .onConflictDoUpdate({
      target: calendarEvents.googleId,
      set: {
        title: sql`excluded.title`,
        description: sql`excluded.description`,
        startsAt: sql`excluded.starts_at`,
        endsAt: sql`excluded.ends_at`,
        studentName: sql`excluded.student_name`,
        status: sql`excluded.status`,
        googleEtag: sql`excluded.google_etag`,
        syncedAt: sql`excluded.synced_at`,
      },
    });
}

export async function runSync(): Promise<{ scope: "incremental" | "full"; applied: number }> {
  const [conn] = await db.select().from(googleConnection).limit(1);
  if (!conn) return { scope: "incremental", applied: 0 };

  const client = await getAuthorizedClient();

  // Tenta incremental primeiro
  if (conn.syncToken) {
    try {
      const { items, nextSyncToken } = await listEvents(client, {
        calendarId: conn.calendarId,
        syncToken: conn.syncToken,
      });
      await upsertBatch(eventsToUpserts(items));
      await db
        .update(googleConnection)
        .set({ syncToken: nextSyncToken ?? conn.syncToken, lastSyncAt: new Date() })
        .where(eq(googleConnection.id, conn.id));
      return { scope: "incremental", applied: items.length };
    } catch (err: any) {
      if (err?.code !== 410) throw err;
      // cai pro full sync
    }
  }

  // Full sync
  const now = Date.now();
  const past = new Date(now - env.SYNC_WINDOW_PAST_DAYS * 86400000);
  const future = new Date(now + env.SYNC_WINDOW_FUTURE_DAYS * 86400000);
  const { items, nextSyncToken } = await listEvents(client, {
    calendarId: conn.calendarId,
    timeMin: past.toISOString(),
    timeMax: future.toISOString(),
  });
  await upsertBatch(eventsToUpserts(items));
  await db
    .update(googleConnection)
    .set({ syncToken: nextSyncToken, lastSyncAt: new Date() })
    .where(eq(googleConnection.id, conn.id));
  return { scope: "full", applied: items.length };
}
```

- [ ] **Step 4: Rodar — GREEN**

```bash
npm test -- sync/run
```

Expected: 3 tests passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(sync): rotina full/incremental + upsert por google_id"
```

---

## Task 14: Cron de sync + route on-demand

**Files:**
- Create: `src/lib/sync/cron.ts`, `src/instrumentation.ts`, `src/app/api/calendar/sync/route.ts`

- [ ] **Step 1: Criar `src/lib/sync/cron.ts`**

```typescript
import { runSync } from "./run";
import { env } from "@/env";

let timer: NodeJS.Timeout | null = null;
let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    await runSync();
  } catch (err) {
    console.error("[sync.cron] error:", err);
  } finally {
    running = false;
  }
}

export function startSyncCron() {
  if (timer) return;
  // primeiro tick em 10s, depois a cada SYNC_INTERVAL_MS
  setTimeout(tick, 10_000);
  timer = setInterval(tick, env.SYNC_INTERVAL_MS);
}
```

- [ ] **Step 2: Criar `src/instrumentation.ts`**

```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startSyncCron } = await import("@/lib/sync/cron");
    startSyncCron();
  }
}
```

- [ ] **Step 3: Habilitar instrumentation no `next.config.ts`**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { instrumentationHook: true },
};

export default nextConfig;
```

Para Next 15.x estável, `instrumentationHook` pode já estar default — verificar antes; se já estiver default, remover `experimental`.

- [ ] **Step 4: Criar route on-demand `src/app/api/calendar/sync/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/guards";
import { runSync } from "@/lib/sync/run";

export async function POST() {
  await requireSession();
  const r = await runSync();
  return NextResponse.json(r);
}
```

- [ ] **Step 5: Testar manualmente**

Com Google conectado e dev server rodando, em outro terminal:

```bash
curl -X POST http://localhost:3000/api/calendar/sync -b "skatedreams_session=<cookie>"
```

Expected: JSON `{ scope, applied }`. Conferir no Postgres:

```bash
docker compose -f docker/docker-compose.yml exec postgres psql -U skatedreams -d skatedreams -c "SELECT COUNT(*) FROM calendar_events;"
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(sync): cron interno + endpoint on-demand de sync"
```

---

# Fase 3 — Agenda e edição

## Task 15: Topbar + layout base

**Files:**
- Create: `src/components/layout/Topbar.tsx`, `src/app/layout.tsx` (modificar)

- [ ] **Step 1: Criar `src/components/layout/Topbar.tsx`**

```tsx
import Link from "next/link";
import { getConnection } from "@/lib/google/connection";

function fmt(d: Date | null): string {
  if (!d) return "—";
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h}h`;
}

export async function Topbar() {
  const conn = await getConnection();

  return (
    <header className="border-b bg-white">
      <nav className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/agenda" className="font-bold">
            SkateDreams
          </Link>
          <Link href="/agenda" className="text-sm hover:underline">
            Agenda
          </Link>
          <Link href="/relatorios" className="text-sm hover:underline">
            Relatórios
          </Link>
          <Link href="/config" className="text-sm hover:underline">
            Config
          </Link>
        </div>
        <div className="text-xs text-neutral-500">
          {conn ? `Última sync: ${fmt(conn.lastSyncAt)}` : "Google não conectado"}
        </div>
      </nav>
    </header>
  );
}
```

- [ ] **Step 2: Modificar `src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import "./globals.css";
import { Topbar } from "@/components/layout/Topbar";

export const metadata: Metadata = {
  title: "SkateDreams",
  description: "Controle de aulas",
};

export default function RootLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-neutral-50 min-h-screen">
        <Topbar />
        {children}
        {modal}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Criar `src/app/@modal/default.tsx`**

```tsx
export default function ModalDefault() {
  return null;
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(ui): topbar + slot de modal paralelo no layout"
```

---

## Task 16: Página /agenda com FullCalendar

**Files:**
- Create: `src/app/agenda/page.tsx` (modificar placeholder), `src/app/agenda/_components/CalendarView.tsx`, `src/components/calendar/LessonEventCard.tsx`

- [ ] **Step 1: Instalar FullCalendar**

```bash
npm install @fullcalendar/core @fullcalendar/react @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/interaction
```

- [ ] **Step 2: Criar action para listar eventos no servidor**

`src/app/agenda/actions.ts`:

```typescript
"use server";

import { and, gte, lte } from "drizzle-orm";
import { db, calendarEvents, eventFlags } from "@/lib/db";
import { requireSession } from "@/lib/auth/guards";

export async function listEventsBetween(startISO: string, endISO: string) {
  await requireSession();
  const start = new Date(startISO);
  const end = new Date(endISO);

  const events = await db
    .select()
    .from(calendarEvents)
    .where(and(gte(calendarEvents.startsAt, start), lte(calendarEvents.startsAt, end)));

  const flags = await db.select().from(eventFlags);

  const byEvent: Record<string, string[]> = {};
  for (const f of flags) {
    (byEvent[f.eventId] ??= []).push(f.flagType);
  }

  return events.map((e) => ({
    id: e.id,
    googleId: e.googleId,
    title: e.title,
    studentName: e.studentName,
    start: e.startsAt.toISOString(),
    end: e.endsAt.toISOString(),
    status: e.status,
    flags: byEvent[e.id] ?? [],
  }));
}
```

- [ ] **Step 3: Criar `src/components/calendar/LessonEventCard.tsx`**

```tsx
"use client";

import type { EventContentArg } from "@fullcalendar/core";

const ICON: Record<string, string> = {
  student_absent: "❌",
  teacher_late: "⏱️",
  teacher_very_late: "⏱️⏱️",
  teacher_unmotivated: "😐",
  students_disengaged: "😭",
};

export function LessonEventCard(arg: EventContentArg) {
  const flags: string[] = arg.event.extendedProps.flags ?? [];
  const student = arg.event.extendedProps.studentName ?? null;
  return (
    <div className="px-1 py-0.5 text-xs leading-tight">
      <div className="font-semibold truncate">{student ?? arg.event.title}</div>
      <div className="text-[10px] text-white/80">{arg.timeText}</div>
      {flags.length > 0 && (
        <div className="mt-0.5 text-sm">{flags.map((f) => ICON[f] ?? "").join(" ")}</div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Criar `src/app/agenda/_components/CalendarView.tsx`**

```tsx
"use client";

import { useCallback, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { useRouter } from "next/navigation";
import { LessonEventCard } from "@/components/calendar/LessonEventCard";
import { listEventsBetween } from "../actions";

export function CalendarView() {
  const ref = useRef<FullCalendar | null>(null);
  const router = useRouter();

  const fetchEvents = useCallback(async (info: { startStr: string; endStr: string }) => {
    const rows = await listEventsBetween(info.startStr, info.endStr);
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      start: r.start,
      end: r.end,
      backgroundColor: r.status === "cancelled" ? "#9ca3af" : "#0f1115",
      borderColor: r.status === "cancelled" ? "#9ca3af" : "#0f1115",
      extendedProps: { studentName: r.studentName, flags: r.flags, status: r.status },
    }));
  }, []);

  return (
    <FullCalendar
      ref={ref}
      plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
      initialView="timeGridWeek"
      locale="pt-br"
      firstDay={1}
      headerToolbar={{
        left: "prev,next today",
        center: "title",
        right: "dayGridMonth,timeGridWeek,timeGridDay",
      }}
      buttonText={{ today: "Hoje", month: "Mês", week: "Semana", day: "Dia" }}
      allDaySlot={false}
      slotMinTime="07:00:00"
      slotMaxTime="22:00:00"
      events={fetchEvents}
      eventContent={LessonEventCard}
      eventClick={(arg) => router.push(`/aula/${arg.event.id}`)}
      height="auto"
    />
  );
}
```

- [ ] **Step 5: Atualizar `src/app/agenda/page.tsx`**

```tsx
import { requireSession } from "@/lib/auth/guards";
import { CalendarView } from "./_components/CalendarView";

export default async function AgendaPage() {
  await requireSession();
  return (
    <main className="max-w-7xl mx-auto p-4">
      <CalendarView />
    </main>
  );
}
```

- [ ] **Step 6: Testar no browser**

```bash
npm run dev
```

Abrir `/agenda`. Esperar carregamento da semana. Eventos do Google (sincronizados na Task 14) devem aparecer.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(agenda): visualização FullCalendar com eventos do DB"
```

---

## Task 17: Página standalone /aula/[id] + modal route-intercept

**Files:**
- Create: `src/app/aula/[id]/page.tsx`, `src/app/@modal/(.)aula/[id]/page.tsx`, `src/app/aula/[id]/_components/LessonForm.tsx`

- [ ] **Step 1: Criar componente `LessonForm`**

`src/app/aula/[id]/_components/LessonForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  event: {
    id: string;
    title: string;
    description: string | null;
    startsAt: string; // ISO
    endsAt: string;
    status: "confirmed" | "cancelled";
    flags: string[];
  };
};

const FLAG_DEFS = [
  { type: "student_absent", icon: "❌", label: "Aluno não veio" },
  { type: "teacher_late", icon: "⏱️", label: "Atraso professor" },
  { type: "teacher_very_late", icon: "⏱️⏱️", label: "Atraso grave" },
  { type: "teacher_unmotivated", icon: "😐", label: "Professor desanimado" },
  { type: "students_disengaged", icon: "😭", label: "Alunos não engajados" },
] as const;

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

export function LessonForm({ event }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description ?? "");
  const [startsAt, setStartsAt] = useState(toLocalInput(event.startsAt));
  const [endsAt, setEndsAt] = useState(toLocalInput(event.endsAt));
  const [flags, setFlags] = useState<Set<string>>(new Set(event.flags));
  const [saving, setSaving] = useState(false);

  async function toggleFlag(type: string) {
    const next = new Set(flags);
    const method = next.has(type) ? "DELETE" : "POST";
    if (method === "DELETE") next.delete(type);
    else next.add(type);
    setFlags(next);
    const res = await fetch(`/api/events/${event.id}/flags`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flagType: type }),
    });
    if (!res.ok) {
      // rollback
      setFlags(new Set(event.flags));
      alert("Erro ao salvar flag.");
    }
  }

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/events/${event.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      alert("Erro ao salvar.");
      return;
    }
    router.refresh();
    router.back();
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm mb-1">Título</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border rounded px-3 py-2" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm mb-1">Início</label>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Fim</label>
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm mb-1">Descrição</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border rounded px-3 py-2" rows={3} />
      </div>

      <div>
        <p className="text-sm font-medium mb-2">Flags</p>
        <div className="flex flex-wrap gap-2">
          {FLAG_DEFS.map((f) => {
            const active = flags.has(f.type);
            return (
              <button
                key={f.type}
                type="button"
                onClick={() => toggleFlag(f.type)}
                className={`min-w-14 h-14 px-3 rounded-lg border text-xl flex items-center justify-center ${
                  active ? "bg-neutral-900 text-white border-neutral-900" : "bg-white"
                }`}
                aria-pressed={active}
                title={f.label}
              >
                {f.icon}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="bg-neutral-900 text-white px-4 py-2 rounded">
          {saving ? "Salvando..." : "Salvar"}
        </button>
        <button type="button" onClick={() => router.back()} className="px-4 py-2 rounded border">
          Fechar
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Criar `src/app/aula/[id]/page.tsx` (standalone)**

```tsx
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/guards";
import { db, calendarEvents, eventFlags } from "@/lib/db";
import { eq } from "drizzle-orm";
import { LessonForm } from "./_components/LessonForm";

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const [event] = await db.select().from(calendarEvents).where(eq(calendarEvents.id, id));
  if (!event) notFound();
  const flags = await db.select().from(eventFlags).where(eq(eventFlags.eventId, id));

  return (
    <main className="max-w-2xl mx-auto p-6">
      <h1 className="text-xl font-bold mb-4">Aula</h1>
      <LessonForm
        event={{
          id: event.id,
          title: event.title,
          description: event.description,
          startsAt: event.startsAt.toISOString(),
          endsAt: event.endsAt.toISOString(),
          status: event.status,
          flags: flags.map((f) => f.flagType),
        }}
      />
    </main>
  );
}
```

- [ ] **Step 3: Criar a versão modal (route intercepting)**

`src/app/@modal/(.)aula/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/guards";
import { db, calendarEvents, eventFlags } from "@/lib/db";
import { eq } from "drizzle-orm";
import { LessonForm } from "@/app/aula/[id]/_components/LessonForm";

export default async function LessonModal({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const [event] = await db.select().from(calendarEvents).where(eq(calendarEvents.id, id));
  if (!event) notFound();
  const flags = await db.select().from(eventFlags).where(eq(eventFlags.eventId, id));

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <h2 className="text-xl font-bold mb-4">Aula</h2>
        <LessonForm
          event={{
            id: event.id,
            title: event.title,
            description: event.description,
            startsAt: event.startsAt.toISOString(),
            endsAt: event.endsAt.toISOString(),
            status: event.status,
            flags: flags.map((f) => f.flagType),
          }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Testar fluxo manualmente**

`npm run dev` → `/agenda` → clica num evento → vê o modal. Reload da página `/aula/[id]` renderiza standalone.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(aula): página standalone + modal route-intercept com form de edição e flags"
```

---

## Task 18: API PATCH /api/events/[id] — edição com sync no Google

**Files:**
- Create: `src/app/api/events/[id]/route.ts`

- [ ] **Step 1: Implementar**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, calendarEvents } from "@/lib/db";
import { requireSession } from "@/lib/auth/guards";
import { getAuthorizedClient } from "@/lib/google/connection";
import { patchEvent } from "@/lib/google/calendar";
import { parseStudentName } from "@/lib/sync/parse-student-name";

const bodySchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await ctx.params;
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.format() }, { status: 400 });

  const [existing] = await db.select().from(calendarEvents).where(eq(calendarEvents.id, id));
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const startsAt = new Date(parsed.data.startsAt);
  const endsAt = new Date(parsed.data.endsAt);
  const client = await getAuthorizedClient();
  const r = await patchEvent(client, existing.googleId, {
    title: parsed.data.title,
    description: parsed.data.description ?? undefined,
    startsAt,
    endsAt,
  });

  await db
    .update(calendarEvents)
    .set({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      startsAt,
      endsAt,
      studentName: parseStudentName(parsed.data.title),
      googleEtag: r.etag ?? existing.googleEtag,
      syncedAt: new Date(),
    })
    .where(eq(calendarEvents.id, id));

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Testar manualmente**

No browser, abrir um evento, alterar o título e salvar. Conferir no Google Calendar que o evento foi atualizado.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(api): PATCH /api/events/[id] propaga edição para Google + atualiza cache"
```

---

## Task 19: API POST/DELETE /api/events/[id]/flags

**Files:**
- Create: `src/app/api/events/[id]/flags/route.ts`

- [ ] **Step 1: Implementar**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, eventFlags } from "@/lib/db";
import { FLAG_TYPES, type FlagType } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/guards";
import { getSession } from "@/lib/auth/session";

const bodySchema = z.object({ flagType: z.enum(FLAG_TYPES as [FlagType, ...FlagType[]]) });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await ctx.params;
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const session = await getSession();

  await db
    .insert(eventFlags)
    .values({ eventId: id, flagType: parsed.data.flagType, createdBy: session.userId! })
    .onConflictDoNothing();

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await ctx.params;
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  await db
    .delete(eventFlags)
    .where(and(eq(eventFlags.eventId, id), eq(eventFlags.flagType, parsed.data.flagType)));

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Testar via UI**

No modal, marcar e desmarcar flags. Conferir no Postgres que linhas em `event_flags` aparecem/somem.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(api): POST/DELETE /api/events/[id]/flags (toggle)"
```

---

# Fase 4 — Relatórios e export

## Task 20: Agregações de relatório (TDD)

**Files:**
- Create: `src/lib/reports/aggregate.ts`, `tests/unit/lib/reports/aggregate.test.ts`

- [ ] **Step 1: Setup do banco de teste**

Esses testes precisam de um Postgres real. Vamos usar o mesmo container do dev (banco separado).

Adicionar ao `docker-compose.yml`:

```yaml
  postgres-test:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: skatedreams
      POSTGRES_PASSWORD: skatedreams_dev
      POSTGRES_DB: skatedreams_test
    ports:
      - "5433:5432"
```

Subir: `docker compose -f docker/docker-compose.yml up -d postgres-test`.

Aplicar migrations no banco de teste:

```bash
DATABASE_URL=postgres://skatedreams:skatedreams_dev@localhost:5433/skatedreams_test npx drizzle-kit migrate
```

- [ ] **Step 2: Helper de setup nos testes**

`tests/unit/lib/_helpers/db.ts`:

```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/lib/db/schema";

const pool = new Pool({
  connectionString: process.env.TEST_DATABASE_URL ?? "postgres://skatedreams:skatedreams_dev@localhost:5433/skatedreams_test",
});

export const testDb = drizzle(pool, { schema });

export async function reset() {
  await testDb.execute(`TRUNCATE event_flags, calendar_events, google_connection, users RESTART IDENTITY CASCADE`);
}
```

- [ ] **Step 3: Escrever os testes de agregação**

`tests/unit/lib/reports/aggregate.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { testDb, reset } from "../_helpers/db";
import { users, calendarEvents, eventFlags } from "@/lib/db/schema";
import { aggregateByStudent } from "@/lib/reports/aggregate";

let userId: string;

beforeEach(async () => {
  await reset();
  const [u] = await testDb.insert(users).values({
    email: "t@t.t",
    passwordHash: "x",
    role: "admin",
  }).returning();
  userId = u.id;
});

async function makeEvent(opts: { gid: string; title: string; student: string | null; date: string; flags?: string[] }) {
  const [e] = await testDb.insert(calendarEvents).values({
    googleId: opts.gid,
    title: opts.title,
    studentName: opts.student,
    startsAt: new Date(opts.date),
    endsAt: new Date(new Date(opts.date).getTime() + 3600000),
  }).returning();
  for (const f of opts.flags ?? []) {
    await testDb.insert(eventFlags).values({ eventId: e.id, flagType: f as any, createdBy: userId });
  }
  return e;
}

describe("aggregateByStudent", () => {
  it("agrupa aulas e flags por aluno normalizado", async () => {
    await makeEvent({ gid: "1", title: "Aula — Lucas — 16h", student: "Lucas", date: "2026-05-12T16:00:00Z", flags: ["student_absent"] });
    await makeEvent({ gid: "2", title: "Aula — Lucas — 17h", student: "Lucas", date: "2026-05-13T17:00:00Z", flags: ["teacher_late"] });
    await makeEvent({ gid: "3", title: "Aula — Maria — 10h", student: "Maria", date: "2026-05-12T10:00:00Z" });

    const r = await aggregateByStudent({
      db: testDb,
      from: new Date("2026-05-01"),
      to: new Date("2026-06-01"),
    });
    const lucas = r.find((row) => row.student === "Lucas");
    const maria = r.find((row) => row.student === "Maria");
    expect(lucas?.totalLessons).toBe(2);
    expect(lucas?.flags.student_absent).toBe(1);
    expect(lucas?.flags.teacher_late).toBe(1);
    expect(maria?.totalLessons).toBe(1);
    expect(maria?.flags.student_absent).toBe(0);
  });

  it("ignora eventos sem student_name", async () => {
    await makeEvent({ gid: "4", title: "Reunião", student: null, date: "2026-05-12T09:00:00Z" });
    const r = await aggregateByStudent({
      db: testDb,
      from: new Date("2026-05-01"),
      to: new Date("2026-06-01"),
    });
    expect(r.find((row) => row.student === null)).toBeUndefined();
  });
});
```

- [ ] **Step 4: Implementar**

`src/lib/reports/aggregate.ts`:

```typescript
import { and, gte, lte, isNotNull, sql } from "drizzle-orm";
import { calendarEvents, eventFlags, FLAG_TYPES, type FlagType } from "@/lib/db/schema";
import type { DB } from "@/lib/db/client";

export type StudentRow = {
  student: string;
  totalLessons: number;
  flags: Record<FlagType, number>;
};

type Args = { db: DB; from: Date; to: Date; student?: string };

export async function aggregateByStudent(args: Args): Promise<StudentRow[]> {
  const { db, from, to } = args;

  const rows = await db
    .select({
      student: calendarEvents.studentName,
      totalLessons: sql<number>`count(distinct ${calendarEvents.id})`,
      ...Object.fromEntries(
        FLAG_TYPES.map((f) => [
          `f_${f}`,
          sql<number>`count(distinct case when ${eventFlags.flagType} = ${f} then ${eventFlags.id} end)`,
        ]),
      ),
    })
    .from(calendarEvents)
    .leftJoin(eventFlags, sql`${eventFlags.eventId} = ${calendarEvents.id}`)
    .where(
      and(
        gte(calendarEvents.startsAt, from),
        lte(calendarEvents.startsAt, to),
        isNotNull(calendarEvents.studentName),
      ),
    )
    .groupBy(calendarEvents.studentName);

  return rows.map((r) => ({
    student: r.student!,
    totalLessons: Number(r.totalLessons),
    flags: Object.fromEntries(
      FLAG_TYPES.map((f) => [f, Number((r as Record<string, unknown>)[`f_${f}`] ?? 0)]),
    ) as Record<FlagType, number>,
  }));
}
```

- [ ] **Step 5: Adicionar script de teste com DB**

`package.json`:

```json
"test:db": "TEST_DATABASE_URL=postgres://skatedreams:skatedreams_dev@localhost:5433/skatedreams_test vitest run --include 'tests/unit/lib/reports/**'"
```

- [ ] **Step 6: Rodar — GREEN**

```bash
npm run test:db
```

Expected: 2 tests passed.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(reports): agregação por aluno + setup de DB de teste"
```

---

## Task 21: Página /relatorios

**Files:**
- Create: `src/app/relatorios/page.tsx`, `src/app/relatorios/_components/ReportTable.tsx`, `src/app/relatorios/_components/SummaryCards.tsx`, `src/app/relatorios/actions.ts`

- [ ] **Step 1: Criar action**

`src/app/relatorios/actions.ts`:

```typescript
"use server";

import { db } from "@/lib/db";
import { aggregateByStudent } from "@/lib/reports/aggregate";
import { requireSession } from "@/lib/auth/guards";

export async function getReport(fromISO: string, toISO: string) {
  await requireSession();
  return aggregateByStudent({
    db,
    from: new Date(fromISO),
    to: new Date(toISO),
  });
}
```

- [ ] **Step 2: Criar `SummaryCards`**

`src/app/relatorios/_components/SummaryCards.tsx`:

```tsx
import type { StudentRow } from "@/lib/reports/aggregate";

export function SummaryCards({ rows }: { rows: StudentRow[] }) {
  const totalLessons = rows.reduce((a, r) => a + r.totalLessons, 0);
  const withAnyFlag = rows.reduce(
    (a, r) => a + Object.values(r.flags).reduce((x, y) => x + y, 0),
    0,
  );
  const pct = totalLessons > 0 ? Math.round((withAnyFlag / totalLessons) * 100) : 0;

  const topAbsent = [...rows].sort((a, b) => b.flags.student_absent - a.flags.student_absent).slice(0, 3);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card title="Total de aulas" value={String(totalLessons)} />
      <Card title="% com flag" value={`${pct}%`} />
      <Card
        title="Top 3 faltas"
        value={topAbsent.map((r) => `${r.student} (${r.flags.student_absent})`).join(", ") || "—"}
      />
      <Card title="Alunos únicos" value={String(rows.length)} />
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-white border rounded-lg p-3">
      <div className="text-xs text-neutral-500">{title}</div>
      <div className="text-lg font-semibold mt-1">{value}</div>
    </div>
  );
}
```

- [ ] **Step 3: Criar `ReportTable`**

`src/app/relatorios/_components/ReportTable.tsx`:

```tsx
"use client";

import type { StudentRow } from "@/lib/reports/aggregate";

export function ReportTable({ rows }: { rows: StudentRow[] }) {
  return (
    <div className="overflow-x-auto border rounded-lg bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-neutral-100">
          <tr>
            <th className="px-3 py-2 text-left">Aluno</th>
            <th className="px-3 py-2 text-right">Aulas</th>
            <th className="px-3 py-2 text-right">❌</th>
            <th className="px-3 py-2 text-right">⏱️</th>
            <th className="px-3 py-2 text-right">⏱️⏱️</th>
            <th className="px-3 py-2 text-right">😐</th>
            <th className="px-3 py-2 text-right">😭</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.student} className="border-t">
              <td className="px-3 py-2">{r.student}</td>
              <td className="px-3 py-2 text-right">{r.totalLessons}</td>
              <td className="px-3 py-2 text-right">{r.flags.student_absent}</td>
              <td className="px-3 py-2 text-right">{r.flags.teacher_late}</td>
              <td className="px-3 py-2 text-right">{r.flags.teacher_very_late}</td>
              <td className="px-3 py-2 text-right">{r.flags.teacher_unmotivated}</td>
              <td className="px-3 py-2 text-right">{r.flags.students_disengaged}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-6 text-center text-neutral-500">
                Sem dados no período.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Criar página**

`src/app/relatorios/page.tsx`:

```tsx
import { requireSession } from "@/lib/auth/guards";
import { getReport } from "./actions";
import { ReportTable } from "./_components/ReportTable";
import { SummaryCards } from "./_components/SummaryCards";

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireSession();
  const sp = await searchParams;
  const to = sp.to ? new Date(sp.to) : new Date();
  const from = sp.from ? new Date(sp.from) : new Date(to.getTime() - 30 * 86400000);
  const rows = await getReport(from.toISOString(), to.toISOString());

  return (
    <main className="max-w-7xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">Relatórios</h1>

      <form className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="block text-xs mb-1">De</label>
          <input
            type="date"
            name="from"
            defaultValue={from.toISOString().slice(0, 10)}
            className="border rounded px-2 py-1"
          />
        </div>
        <div>
          <label className="block text-xs mb-1">Até</label>
          <input
            type="date"
            name="to"
            defaultValue={to.toISOString().slice(0, 10)}
            className="border rounded px-2 py-1"
          />
        </div>
        <button className="bg-neutral-900 text-white px-3 py-1.5 rounded text-sm">Aplicar</button>
        <a
          href={`/api/reports/export?from=${from.toISOString()}&to=${to.toISOString()}`}
          className="border px-3 py-1.5 rounded text-sm"
        >
          Exportar CSV
        </a>
      </form>

      <SummaryCards rows={rows} />
      <ReportTable rows={rows} />
    </main>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(relatorios): página com filtros, cards de resumo e tabela por aluno"
```

---

## Task 22: Export CSV

**Files:**
- Create: `src/app/api/reports/export/route.ts`

- [ ] **Step 1: Implementar**

```typescript
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { aggregateByStudent } from "@/lib/reports/aggregate";
import { requireSession } from "@/lib/auth/guards";
import { FLAG_TYPES } from "@/lib/db/schema";

function csvEscape(value: unknown): string {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  await requireSession();
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  if (!from || !to) return new Response("from/to required", { status: 400 });

  const rows = await aggregateByStudent({
    db,
    from: new Date(from),
    to: new Date(to),
  });

  const headers = ["aluno", "aulas", ...FLAG_TYPES];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        csvEscape(r.student),
        r.totalLessons,
        ...FLAG_TYPES.map((f) => r.flags[f]),
      ].join(","),
    );
  }
  const csv = "﻿" + lines.join("\n"); // BOM para Excel pt-BR

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="skatedreams-report-${from.slice(0, 10)}_${to.slice(0, 10)}.csv"`,
    },
  });
}
```

- [ ] **Step 2: Testar manualmente**

Abrir `/relatorios`, clicar "Exportar CSV". Arquivo deve baixar e abrir corretamente no Excel/Sheets em pt-BR.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(api): export CSV de relatório por aluno (UTF-8 BOM)"
```

---

# Fase 5 — Tema e polimento

## Task 23: Aplicar tokens SkateDreams no Tailwind

**Files:**
- Modify: `tailwind.config.ts`, `src/app/globals.css`

- [ ] **Step 1: Atualizar `tailwind.config.ts`**

```typescript
import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#FF5A1F",
          dark: "#0F1115",
          light: "#FAFAF7",
          accent: "#3DDC84",
          warn: "#FFC93C",
          danger: "#E63946",
          muted: "#6B7280",
        },
      },
      fontFamily: {
        display: ["Archivo", "Inter", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "JetBrains Mono", "monospace"],
      },
    },
  },
} satisfies Config;
```

- [ ] **Step 2: Atualizar `src/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url("https://fonts.googleapis.com/css2?family=Archivo:wght@500;700&family=Inter:wght@400;500;700&display=swap");

html, body {
  font-family: var(--font-body, "Inter"), system-ui, sans-serif;
  background: theme("colors.brand.light");
  color: theme("colors.brand.dark");
}
```

- [ ] **Step 3: Aplicar nos componentes principais**

Trocar `bg-neutral-900 text-white` por `bg-brand-dark text-brand-light` nas seguintes telas:
- `src/app/login/page.tsx` (botão e título com `font-display`)
- `src/app/aula/[id]/_components/LessonForm.tsx` (botão "Salvar" → `bg-brand-primary`)
- `src/app/agenda/_components/CalendarView.tsx` (cores do `backgroundColor` do evento: `#0F1115` → `theme.colors.brand.dark`, e `#9ca3af` para `brand.muted`)
- `src/components/layout/Topbar.tsx` (link "SkateDreams" com `font-display text-xl`)
- `src/app/relatorios/page.tsx` (botão "Aplicar" → `bg-brand-dark`)

(Substituições simples — verificar visualmente no `npm run dev`.)

- [ ] **Step 4: Adicionar cores semânticas aos FlagChips**

Em `LessonForm.tsx`, mudar a definição dos chips para usar cores quando ativos:

```tsx
const FLAG_COLORS: Record<string, string> = {
  student_absent: "bg-brand-danger border-brand-danger",
  teacher_late: "bg-brand-warn border-brand-warn text-brand-dark",
  teacher_very_late: "bg-brand-danger border-brand-danger",
  teacher_unmotivated: "bg-brand-muted border-brand-muted",
  students_disengaged: "bg-brand-warn border-brand-warn text-brand-dark",
};

// no botão:
className={`min-w-14 h-14 px-3 rounded-lg border text-xl flex items-center justify-center ${
  active ? `${FLAG_COLORS[f.type]} text-white` : "bg-white"
}`}
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "style: aplica tokens SkateDreams (paleta provisória + Archivo/Inter)"
```

---

# Fase 6 — Deploy

## Task 24: Dockerfile multi-stage

**Files:**
- Create: `docker/Dockerfile`, `.dockerignore`

- [ ] **Step 1: Criar `.dockerignore`**

```
node_modules
.next
.git
.env
.env.local
docs
tests
*.log
.vscode
.idea
```

- [ ] **Step 2: Criar `docker/Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/src/lib/db/migrations ./src/lib/db/migrations
COPY --from=builder /app/drizzle.config.ts ./
COPY docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

EXPOSE 3000
CMD ["./entrypoint.sh"]
```

- [ ] **Step 3: Criar `docker/entrypoint.sh`**

```bash
#!/bin/sh
set -e

echo "Running database migrations..."
npx drizzle-kit migrate

echo "Starting Next.js..."
exec node node_modules/.bin/next start -p 3000
```

- [ ] **Step 4: Build local da imagem**

```bash
docker build -f docker/Dockerfile -t skatedreams:dev .
```

Expected: build conclui sem erro.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(docker): Dockerfile multi-stage + entrypoint com migrate"
```

---

## Task 25: Manifesto Docker Swarm

**Files:**
- Create: `docker/stack.yml`

- [ ] **Step 1: Criar `docker/stack.yml`**

```yaml
version: "3.9"

services:
  app:
    image: ${REGISTRY}/skatedreams:${TAG:-latest}
    environment:
      DATABASE_URL: postgres://skatedreams:${POSTGRES_PASSWORD}@postgres:5432/skatedreams
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      SESSION_SECRET: ${SESSION_SECRET}
      SEED_EMAIL: ${SEED_EMAIL}
      SEED_PASSWORD: ${SEED_PASSWORD}
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
      GOOGLE_REDIRECT_URI: ${GOOGLE_REDIRECT_URI}
      NODE_ENV: production
    deploy:
      replicas: 1
      restart_policy:
        condition: on-failure
    networks: [internal, edge]
    depends_on: [postgres]

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: skatedreams
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: skatedreams
    volumes:
      - skatedreams_pg:/var/lib/postgresql/data
    deploy:
      replicas: 1
    networks: [internal]

volumes:
  skatedreams_pg:

networks:
  internal:
  edge:
    external: true   # rede já existente que conecta ao reverse-proxy do Swarm
```

- [ ] **Step 2: Documentar no `docs/03-arquitetura.md`**

Adicionar parágrafo na seção "Deploy":

> O manifesto `docker/stack.yml` é importado pelo Portainer. Variáveis sensíveis ficam como secrets do Swarm ou variáveis injetadas pelo Portainer. A rede `edge` é compartilhada com um reverse proxy (Traefik/Caddy) que expõe o serviço ao Cloudflare.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore(deploy): stack.yml Docker Swarm + nota no doc de arquitetura"
```

---

# Fase 7 — E2E smoke

## Task 26: Playwright golden-path

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/golden-path.spec.ts`

- [ ] **Step 1: Instalar Playwright**

```bash
npm install -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Criar `playwright.config.ts`**

```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    headless: true,
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        port: 3000,
        reuseExistingServer: true,
      },
});
```

- [ ] **Step 3: Criar teste**

`tests/e2e/golden-path.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test("login → ver agenda → abrir modal de aula", async ({ page }) => {
  // pré-requisito: usuário seed existe; nenhum evento precisa estar presente.
  await page.goto("/login");
  await page.fill('input[name="email"]', process.env.SEED_EMAIL ?? "admin@skatedreams.local");
  await page.fill('input[name="password"]', process.env.SEED_PASSWORD ?? "trocar-em-producao");
  await page.click('button:has-text("Entrar")');

  await page.waitForURL("**/agenda");
  await expect(page.locator(".fc")).toBeVisible(); // FullCalendar root

  // não interage com modal de aula porque depende de eventos sincronizados;
  // smoke termina garantindo que página carrega e tabela de relatórios renderiza
  await page.goto("/relatorios");
  await expect(page.getByText("Relatórios")).toBeVisible();
});
```

- [ ] **Step 4: Adicionar script**

```json
"test:e2e": "playwright test"
```

- [ ] **Step 5: Rodar**

```bash
npm run test:e2e
```

Expected: 1 test passed.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test(e2e): smoke do golden path (login → agenda → relatórios)"
```

---

## Task 27: README do projeto + checklist final

**Files:**
- Create: `README.md` (raiz)

- [ ] **Step 1: Criar `README.md`**

```markdown
# SkateDreams — Controle de Aulas

Sistema interno da Escola SkateDreams para registrar flags qualitativos sobre aulas individuais,
sincronizado com o Google Agenda.

> Documentação completa: [`docs/README.md`](docs/README.md).

## Dev

```bash
docker compose -f docker/docker-compose.yml up -d postgres
cp .env.example .env.local        # preencher GOOGLE_* e gerar chaves
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Acesse http://localhost:3000.

## Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | dev server |
| `npm run build` | build de produção |
| `npm run test` | unit tests (Vitest) |
| `npm run test:db` | unit tests que tocam Postgres de teste |
| `npm run test:e2e` | Playwright |
| `npm run db:generate` | gera migration a partir do schema |
| `npm run db:migrate` | aplica migrations |
| `npm run db:seed` | cria usuário admin |

## Stack

Next.js 15 · React 19 · TypeScript · Tailwind · FullCalendar · Drizzle · Postgres · iron-session · googleapis.

## Deploy

Docker Swarm via Portainer na Hetzner, Cloudflare na frente. Ver `docker/stack.yml` e `docs/03-arquitetura.md`.

```

- [ ] **Step 2: Commit final**

```bash
git add -A
git commit -m "docs: README com instruções de dev e deploy"
```

---

# Checklist final do MVP

Antes de declarar "pronto":

- [ ] `npm run build` passa.
- [ ] `npm run lint` passa.
- [ ] `npm test` passa (unit).
- [ ] `npm run test:db` passa (reports).
- [ ] `npm run test:e2e` passa (golden path).
- [ ] Login funciona com credenciais do seed.
- [ ] Botão "Conectar Google Calendar" leva ao consentimento e volta com email correto.
- [ ] Sync inicial popula eventos no Postgres.
- [ ] `/agenda` mostra eventos da semana com ícones de flag corretos.
- [ ] Clique em evento abre modal/drawer; URL muda para `/aula/[id]`.
- [ ] Editar título/horário no modal salva no Google e no DB.
- [ ] Marcar/desmarcar flag persiste no DB e re-renderiza no calendário ao voltar.
- [ ] `/relatorios?from=...&to=...` mostra agregação correta.
- [ ] Botão "Exportar CSV" baixa arquivo legível no Excel pt-BR.
- [ ] `docker build` sobe imagem sem erro.
- [ ] Página renderiza com paleta SkateDreams (laranja energético, fontes Archivo/Inter).

# Trade-offs explícitos

- **Login compartilhado:** sem auditoria real de quem marcou cada flag (todos viram `admin`). Upgrade documentado em ADR-004.
- **Heurística de student_name:** títulos fora do padrão somem do relatório. Mitigação: cliente pode ver "eventos sem aluno identificado" em uma futura versão. ADR-009.
- **Cron in-process:** se o container reiniciar durante sync, ela morre. Próximo tick recupera via `syncToken`. ADR-007.
- **Paleta provisória:** vai precisar de pass quando Caio entregar a brand book.
