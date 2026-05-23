# SkateDreams — Monorepo

Sistema interno da Escola SkateDreams. Repo estruturado como monorepo:

- [`app-skatedreams/`](app-skatedreams/) — app Next.js (controle de aulas, agenda, relatórios)
- [`docs/`](docs/) — documentação técnica e brand (compartilhada entre apps)
- [`secrets/`](secrets/) — credenciais fora do git (service accounts, tokens)

> Documentação completa: [`docs/README.md`](docs/README.md).

## Dev

```bash
cd app-skatedreams

# 1. Postgres local
docker compose -f docker/docker-compose.yml up -d postgres

# 2. Variáveis de ambiente
cp .env.example .env.local
# Gerar chaves:
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)" >> .env.local
echo "SESSION_SECRET=$(openssl rand -hex 32)" >> .env.local
# Ajustar GOOGLE_SERVICE_ACCOUNT_KEY_PATH e GOOGLE_CALENDAR_ID

# 3. Colocar o JSON do service account em ../secrets/google-service-account.json
# (gitignored — fornecido pelo cliente fora deste repo)

# 4. Setup
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
| `npm run test:db` | unit tests que tocam Postgres de teste (precisa do serviço `postgres-test`) |
| `npm run test:e2e` | smoke E2E (Playwright) |
| `npm run db:generate` | gera migration a partir do schema |
| `npm run db:migrate` | aplica migrations |
| `npm run db:seed` | cria usuário admin |
| `npm run db:studio` | Drizzle Studio (DB GUI) |

## Stack

Next.js 15 · React 19 · TypeScript · Tailwind v3 · FullCalendar v6 · Drizzle · Postgres 16 · iron-session · googleapis (service account).

## Deploy

Docker Swarm via Portainer na Hetzner, Cloudflare na frente. Ver `docs/03-arquitetura.md`.

Pipeline contínuo (`.github/workflows/build-and-deploy.yml`):

```
push main → build & push GHCR (:latest + :sha) → POST webhook Portainer → service update
```

Service account vai como env var base64 (`GOOGLE_SERVICE_ACCOUNT_JSON`), não como docker secret.
Stack file e env file moram fora do git (`docker/stack.yml`, `docker/stack.env` — ambos gitignored, único source-of-truth é o painel do Portainer).

App em produção: <https://app.skatedreams.com.br>.

## Estado atual (2026-05-17)

MVP em produção. Login, agenda com FullCalendar, modal de aula com edição e flags, relatórios consolidados, export CSV. Service account já conectada à agenda `escolaskatedreams@gmail.com`. ~4800 eventos sincronizados.

Identidade visual provisória (`docs/brand/design-system.md` v0). Aguarda brand book oficial do Caio.
