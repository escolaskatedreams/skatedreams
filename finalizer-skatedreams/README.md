# finalizer-skatedreams

Substitui o workflow n8n `Finalizacao de Perdidos Latest` (W2) e reabilita o `Check Automático` (W3), incorporando os fixes aprendidos em 2026-05-23/24.

## O que faz

Ciclo diário (03:00 BRT, configurável) que lê Controle 2026 + Calendar + Logs e:

- **Grupo A (zerados)** — `situacao=ativo` + `aulas_restantes=0`: encurta recorrência antiga (DELETE+INSERT preservando cores override), cria nova com `id` novo, atualiza Controle (`finalizado`, `Automático`) + Logs.
- **Grupo B (estourados)** — `S<0`: gera proposta de honest mode no report. **Não executa.**
- **Grupo C (estados intermediários)** — `motivo`/`termino` preenchidos sem finalização: diagnóstico do sub-caso no report. **Não executa.**
- **W3** — valida `Controle ↔ Calendar ↔ Logs` para transições dos últimos 7 dias; issues no report.

## Endpoints

- `GET /health` (sem auth) — liveness
- `GET /status` — último report (header `X-Finalizer-Token`)
- `POST /run` — dispara ciclo manualmente (mesmo header)

## Stack

Python 3.12, FastAPI + APScheduler, googleapiclient, structlog, pydantic v2, uv.

## Dev local

```bash
cd finalizer-skatedreams
uv sync --all-groups
cp docker/stack.env.example .env  # preencher
uv run uvicorn finalizer.main:create_app --factory --reload
```

Tests:
```bash
uv run pytest -v
```

Container local:
```bash
docker build -f docker/Dockerfile -t finalizer:dev .
docker compose -f docker/docker-compose.yml up
```

## Deploy

- Imagem em `ghcr.io/escolaskatedreams/finalizer:latest`
- Stack Swarm `finalizer` no Portainer
- Domínio `finalizer.skatedreams.com.br` (Traefik label)

CI pipeline: push em `main` → `tests` → `docker build/push` → `webhook Portainer`.

## Pré-cutover (manual)

1. Compartilhar planilha Controle 2026 com SA `geral-google@automacoes-n8n-491322.iam.gserviceaccount.com` como **Editor**.
2. DNS `finalizer.skatedreams.com.br` → `178.156.235.107`.
3. Criar stack `finalizer` no Portainer com `docker/stack.deploy.yml` renderizado.
4. Configurar GitHub Secret `PORTAINER_FINALIZER_WEBHOOK_URL` (webhook do stack `finalizer`).
5. Subir env vars no painel do Portainer (template em `docker/stack.env.example`).

## Cutover

1. `DRY_RUN=true` no Portainer → 1º ciclo manual via `POST /run` → conferir `/status`.
2. `DRY_RUN=false` → redeploy.
3. Desativar W2 do n8n (`Urgspel6dgvdAZ6n` set active=false via MCP `n8n-skatedreams`).

## Rollback

Reativar W2 do n8n + redeploy imagem `:sha-anterior` no Portainer (ou parar a stack `finalizer`). Tempo: <2min.

## Regras invioláveis incorporadas

- **NUNCA estender UNTIL** — só encurtar.
- **NUNCA `events.patch({recurrence})`** num master — usar DELETE+INSERT.
- **Cor da nova recorrência = master atual**, não instância pontual.
- **Preservar cores override** (Tomate=falta, Flamingo=substituição) ao recriar.
- **Tratar TODOS os masters do aluno**.
- **Idempotência** — rodar 2× = mesmo resultado.

Spec completo: `../docs/superpowers/specs/2026-05-24-finalizer-skatedreams-design.md`.
Plano: `../docs/superpowers/plans/2026-05-24-finalizer-skatedreams.md`.
