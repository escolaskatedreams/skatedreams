# SkateDreams — Controle de Aulas

Sistema interno da Escola SkateDreams para registrar flags qualitativos sobre aulas individuais,
sincronizado com o Google Agenda via service account.

> Documentação completa: [`docs/README.md`](docs/README.md).

## Dev

```bash
# 1. Postgres local
docker compose -f docker/docker-compose.yml up -d postgres

# 2. Variáveis de ambiente
cp .env.example .env.local
# Gerar chaves:
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)" >> .env.local
echo "SESSION_SECRET=$(openssl rand -hex 32)" >> .env.local
# Ajustar GOOGLE_SERVICE_ACCOUNT_KEY_PATH e GOOGLE_CALENDAR_ID

# 3. Colocar o JSON do service account em secrets/google-service-account.json
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

Docker Swarm via Portainer na Hetzner, Cloudflare na frente. Ver `docker/stack.yml` e `docs/03-arquitetura.md`.

Antes do deploy:
1. `docker secret create google_sa_key /path/to/service-account.json` (no host Swarm)
2. Ajustar env vars do stack (`POSTGRES_PASSWORD`, `ENCRYPTION_KEY`, `SESSION_SECRET`, etc.)
3. Importar `docker/stack.yml` no Portainer

## Estado atual (2026-05-17)

MVP funcional. Login, agenda com FullCalendar, modal de aula com edição e flags, relatórios consolidados, export CSV. Service account já conectada à agenda `escolaskatedreams@gmail.com`. ~4800 eventos sincronizados.

Identidade visual provisória (`docs/brand/design-system.md` v0). Aguarda brand book oficial do Caio.
