# Finalizer SkateDreams — Spec de Design

**Data:** 2026-05-24
**Status:** aprovado (modo autônomo)
**Substitui:** workflow n8n `Finalizacao de Perdidos Latest` (`Urgspel6dgvdAZ6n`) e parte do W3 (`Check Automático`, hoje inativo)

## 1. Problema

O workflow n8n `Finalizacao de Perdidos Latest` (W2) finaliza pedidos da planilha Controle 2026 quando `aulas_restantes ≤ 0`, encurta a recorrência antiga no Google Calendar e cria uma nova com `id` novo. Funcionou por um tempo mas:

- Quebra com regularidade — Fase 1 (retry de etapas parciais) acumula entradas vazias em Logs porque algum I/O falha no meio.
- Não cobre **estourados** (`aulas_restantes < 0`) — exige skill manual (`finalizar-pedidos-estourados`).
- Não cobre **estados intermediários** — exige skill manual (`limpar-estados-intermediarios`).
- Não aplica as correções aprendidas em 2026-05-23/24:
  - `events.patch({recurrence})` regenera o master e cancela todas as instâncias filhas (perdendo overrides Tomate/Flamingo) → tem que ser DELETE+INSERT.
  - "Só encurtar UNTIL, nunca estender."
  - Cor de recorrência nova deve vir do **master** atual, não de instância pontual.
  - Honest mode reverso pra finalizados com `S=1` (transferir primeira aula do id novo após última do antigo).
- W3 (`Check Automático`) está inativo — não há rede de segurança que valide o resultado.

## 2. Objetivo

Substituir o W2 + W3 por um **serviço Python isolado**, idempotente, com os fixes incorporados, deploy independente do app principal, mesma infra (Docker Swarm no Hetzner, Traefik + Let's Encrypt).

**Sucesso = ciclo diário roda sozinho, fecha 100% dos zerados sem regressão, reporta estourados/estados-intermediários/issues W3 num endpoint HTTP que a notificação Windows lê.**

## 3. Decisões de design (Q&A da fase de brainstorming)

| Pergunta | Resposta |
|---|---|
| Escopo | W2 (finalização) + W3 (validação cruzada) |
| Acesso à planilha | Compartilhar Controle 2026 com a SA `geral-google@automacoes-n8n-491322` como **Editor** |
| Trigger | APScheduler in-process, 1×/dia (03:00 BRT) + endpoint `POST /run` manual |
| Persistência | **Stateless** — state em Controle+Calendar+Logs. Último report em memória. |
| Approval | Zerados/Grupo A: automático. Estourados/Grupo B + Estados/Grupo C + W3 issues: **report only** |
| Notificação | Endpoint `GET /status` + skill `monitor-with-windows-notification` |
| Cutover | Direto: desliga W2 do n8n + sobe Python no mesmo deploy |
| Stack | Python 3.12, FastAPI + uvicorn, APScheduler 3.x, googleapiclient, pydantic v2 + pydantic-settings, structlog, httpx, pytest, **uv** (gestor de deps) |
| Pasta | `finalizer-skatedreams/` (irmão de `app-skatedreams/` no monorepo) |
| Imagem | `ghcr.io/escolaskatedreams/finalizer:latest` |
| Stack Swarm | `finalizer` (separada de `app`) |
| Domínio | `finalizer.skatedreams.com.br` |

## 4. Arquitetura

```
┌───────────────────────────────────────────────────────────────────────┐
│                Hetzner — Docker Swarm (mesmo cluster do app)          │
│                                                                       │
│  ┌─────────────────────┐         ┌──────────────────────────┐         │
│  │ Traefik v3          │         │ stack: app  (já existe)  │         │
│  │ (já existe)         │  ─────► │   app_app  +  app_postgres        │
│  └──────────┬──────────┘         └──────────────────────────┘         │
│             │                                                         │
│  Host(`finalizer.skatedreams.com.br`)                                 │
│             │                                                         │
│             ▼                                                         │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │ stack: finalizer  (NOVO)                                     │     │
│  │   finalizer_app                                              │     │
│  │   ─────────────────────────────────                          │     │
│  │   FastAPI (HTTP)  +  APScheduler (cron 1x/dia, 03:00 BRT)    │     │
│  │   googleapiclient (Calendar + Sheets via SA)                 │     │
│  │   httpx → Apps Script webhook (sync Calendario)              │     │
│  │   structlog → stdout JSON                                    │     │
│  │   STATELESS — sem volume, sem DB                             │     │
│  └──────────────────────────────────────────────────────────────┘     │
└────────────────────────┬──────────────────────────────────────────────┘
                         │ HTTPS outbound
            ┌────────────┼────────────┐
            ▼            ▼            ▼
       Google         Google      Apps Script
       Calendar API   Sheets API  Web App (sync Calendario)
```

### Estrutura do pacote

```
finalizer-skatedreams/
├── src/finalizer/
│   ├── __init__.py
│   ├── main.py              # FastAPI app + APScheduler boot
│   ├── config.py            # pydantic-settings
│   ├── pipeline.py          # orquestrador
│   ├── google/
│   │   ├── auth.py
│   │   ├── calendar.py
│   │   └── sheets.py
│   ├── domain/
│   │   ├── models.py
│   │   ├── classifier.py
│   │   ├── grupo_a.py
│   │   ├── grupo_b.py
│   │   └── grupo_c.py
│   ├── operations/
│   │   ├── substituir_recorrencia.py
│   │   ├── encurta_master.py
│   │   └── preserva_cores.py
│   ├── validacao/
│   │   └── w3.py
│   ├── http/
│   │   ├── routes.py
│   │   └── report.py
│   └── sync.py
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── docker/
│   ├── Dockerfile
│   ├── entrypoint.sh
│   ├── docker-compose.yml
│   ├── stack.yml
│   └── stack.env.example
├── pyproject.toml
├── uv.lock
├── README.md
└── .python-version
```

CI: `.github/workflows/finalizer-build-and-deploy.yml` (na raiz do monorepo), gatilhada por `paths: ['finalizer-skatedreams/**']`.

## 5. Componentes

### 5.1 `config.py`

Pydantic-settings com:

```python
class Settings(BaseSettings):
    google_service_account_json: str         # base64
    google_calendar_id: str = "escolaskatedreams@gmail.com"
    sheets_controle_id: str                  # ID da planilha Controle 2026
    apps_script_webhook_url: str
    apps_script_webhook_token: str
    finalizer_api_token: str                 # auth de /run e /status
    finalizer_cron_hour: int = 3
    finalizer_cron_minute: int = 0
    finalizer_timezone: str = "America/Sao_Paulo"
    dry_run: bool = False
    grupo_a_max_per_cycle: int = 50          # sentinela
    log_level: str = "INFO"
```

### 5.2 `google/auth.py`

```python
def build_credentials(sa_json_b64: str, scopes: list[str]) -> Credentials:
    sa_dict = json.loads(base64.b64decode(sa_json_b64))
    return service_account.Credentials.from_service_account_info(sa_dict, scopes=scopes)
```

Scopes: `https://www.googleapis.com/auth/calendar.events` + `https://www.googleapis.com/auth/spreadsheets`.

### 5.3 `google/calendar.py`

Wrapper sobre `build('calendar', 'v3', credentials=creds)`. Métodos:

- `list_events(query, time_min, time_max, single_events=True)`
- `get_event(event_id)`
- `insert_event(body)`
- `delete_event(event_id)`
- `patch_event(event_id, body)`

Cada um faz retry com backoff exponencial 1s/4s/16s em `HttpError` com status 429/500/502/503/504. 3 tentativas.

### 5.4 `google/sheets.py`

Wrapper sobre `build('sheets', 'v4', credentials=creds)`:

- `read(range_a1)` → lista de listas
- `update(range_a1, values, value_input_option='RAW' | 'USER_ENTERED')`
- `append(range_a1, values, value_input_option)`

Mesma política de retry do calendar.

### 5.5 `domain/models.py`

```python
class PedidoControle(BaseModel):
    row: int                            # linha 1-indexed na planilha
    contador: str                       # col A (fórmula)
    id: int                             # col B
    cpf: str | None
    nome: str
    situacao: Literal['pendente','ativo','Ativo','finalizado','encerrado','machucado','credito']
    cancelado_em: str | None
    nome_filho: str | None
    obs: str | None
    inicio: str | None                  # dd/MM/yyyy
    termino: str | None                 # dd/MM/yyyy
    motivo_termino: str | None
    valor: float | None
    valor_aula: float | None            # ARRAYFORMULA — read-only
    freq: str | None
    plano: str | None
    aulas_contratadas: int | None       # P
    aulas_realizadas_estatico: int | None  # R
    extra: str | None
    aulas_realizadas_agenda: int | None # Q — ARRAYFORMULA
    aulas_restantes: int | None         # S — ARRAYFORMULA

class EventoCalendario(BaseModel):
    titulo: str
    cor: int | None
    inicio: datetime
    fim: datetime
    info_descricao: str | None
    presenca: Literal['Presença','Falta'] | None
    id: int | None
    teste: str | None
    nome_controle: str | None
    preco_por_aula: float | None
    professor: str | None

class LogRow(BaseModel):
    data: str
    id_antigo: int
    id_novo: int
    pedido_finalizado: str
    pedido_novo_criado: str
    agenda_recorrente_antiga_finalizada: str
    agenda_recorrente_nova_criada: str
    cor_atribuida: str
    nome: str
    check_automatico: str
```

### 5.6 `domain/classifier.py`

Classifica pedidos em 3 buckets disjuntos:

```python
def classificar(pedidos: list[PedidoControle]) -> Classificacao:
    grupo_a_auto = [
        p for p in pedidos
        if p.situacao.lower() == 'ativo'
        and (p.aulas_restantes or 0) == 0
    ]
    grupo_b_report = [
        p for p in pedidos
        if p.situacao.lower() == 'ativo'
        and (p.aulas_restantes or 0) < 0
    ]
    grupo_c_report = [
        p for p in pedidos
        if p.situacao.lower() in ('ativo','pendente')
        and (p.motivo_termino or p.termino)
        and p not in grupo_a_auto and p not in grupo_b_report
    ]
    normalizacoes_e = [p.row for p in pedidos if p.situacao == 'Ativo']
    return Classificacao(grupo_a_auto, grupo_b_report, grupo_c_report, normalizacoes_e)
```

- **Grupo A (auto)**: zerados (S=0, situação ativo). Único bucket que o serviço executa automaticamente.
- **Grupo B (report)**: estourados (S<0). Vai pro report com proposta de honest mode.
- **Grupo C (report)**: estados intermediários (motivo/termino preenchidos sem finalização).
- **Normalizações**: linhas com `situacao='Ativo'` (maiúsculo) — aplica `update Controle!E<row>='ativo'` antes de classificar.

### 5.7 `domain/grupo_a.py`

Pipeline determinístico:

1. Pra cada pedido com `S==0` e `situacao∈{ativo,Ativo}`:
   1. Compute `data_termino` = max(Calendario.inicio WHERE id=p.id AND presenca='Presença'). Formato `dd/MM/yyyy`.
   2. Compute `id_novo` = max(Controle!B) + 1 — **just-in-time** (relê coluna B antes de cada criação).
   3. Chama `operations.substituir_recorrencia(p.id, id_novo, p.nome, data_termino)`.
   4. Update Controle row antigo: `E=finalizado`, `J=data_termino`, `K=Automático` (RAW).
   5. Append Controle row pendente novo: 19 cols, primeira vazia, USER_ENTERED.
   6. Append Logs: `[hoje, id_antigo, id_novo, *, *, *, *, colorId, nome, ""]`.

Falha de 1 aluno → loga ERROR, continua os outros.

### 5.8 `operations/substituir_recorrencia.py`

Porta do `calendar-substituir-recorrencia.mjs`:

1. List events `id: <antigo>` no range `2025-11-01 → 2027-12-31`, `singleEvents=True`.
2. Extrai todos `recurringEventId` únicos.
3. Pra cada master:
   - GET master → `rrule`, `colorId`, `start`, `end`, `summary`.
   - Parse `UNTIL` do RRULE.
   - **Regra inviolável 1**: se `UNTIL <= data_termino`, **MANTER** (nunca estender).
   - Senão: mapear cores override (instâncias com cor ≠ master color, dentro de `<=data_termino`).
   - `DELETE master` + `INSERT` novo master com `RRULE;UNTIL=<data_termino>T235959Z`, mesma cor.
   - Aguarda 1.5s, lista instâncias do novo master, `PATCH colorId` nas datas que tinham override.
4. Compute próxima ocorrência depois de `data_termino` (mesmo dia da semana + horário).
5. **Idempotência**: GET events `id: <novo>` — se já existe confirmed com recurringEventId, pula POST.
6. `POST` nova recorrência:
   ```
   summary: "<nome limpo> | id: <id_novo>"
   start/end: próxima ocorrência
   recurrence: [master.rrule sem UNTIL]
   colorId: master.colorId  (cor do master, NÃO da última instância)
   ```

### 5.9 `domain/grupo_b.py` (report only)

Pra cada pedido com `S<0`:
- Calcula `excesso = -S`, `aulas_presenca_din` (ordenadas).
- Propõe `datas_mover` = últimas `excesso` aulas dinâmicas.
- Propõe `data_corte` = data da `(Q - excesso - R)`-ésima dinâmica.
- Propõe `data_inicio_novo` = primeira ocorrência depois da última movida.
- Empacota em `Grupo B item` no report.

**Não executa.** Endpoint manual no futuro pode receber `{id, action: "apply_grupo_b"}` pra aplicar caso-a-caso — fora do escopo desta entrega.

### 5.10 `domain/grupo_c.py` (report only)

Diagnóstico dos sub-casos 1a/1b/2/3 (ver `limpar-estados-intermediarios/SKILL.md`). Empacota cada caso com proposta no report.

### 5.11 `validacao/w3.py`

Pra cada par `(id_antigo, id_novo)` em Logs nos últimos 7 dias:
- Verificar: pedido antigo `situacao=finalizado`, `id_novo` existe em Controle.
- Listar eventos futuros (`time_min=hoje`) com `id: <antigo>` → deve ser `[]`.
- Listar dias da semana das instâncias antigas vs novas → cobertura deve bater.
- Issues vão pro report.

### 5.12 `sync.py`

```python
async def dispara_sync():
    url = settings.apps_script_webhook_url
    params = {"token": settings.apps_script_webhook_token}
    async with httpx.AsyncClient() as c:
        r = await c.get(url, params=params, timeout=120)
    if r.text.strip() != "OK":
        raise SyncError(r.text)
```

Retry 1x em caso de timeout.

### 5.13 `pipeline.py`

```python
class Pipeline:
    last_report: CicloReport | None = None
    last_run_at: datetime | None = None
    running: bool = False
    _lock: asyncio.Lock

    async def run_ciclo(self, force: bool = False) -> CicloReport:
        async with self._lock:
            # snapshot, classificar, normalizar, executar grupo_a, sync, w3, report
            ...
```

Lock garante 1 ciclo por vez (cron + manual não colidem).

### 5.14 `http/routes.py`

```python
@app.post("/run", dependencies=[Depends(auth_token)])
async def run(force: bool = False): ...

@app.get("/status", dependencies=[Depends(auth_token)])
async def status(): ...

@app.get("/health")
async def health(): return {"status": "ok"}
```

Auth: header `X-Finalizer-Token` deve bater com `settings.finalizer_api_token`.

### 5.15 `main.py`

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(
        pipeline.run_ciclo,
        CronTrigger(hour=settings.finalizer_cron_hour, minute=settings.finalizer_cron_minute, timezone=settings.finalizer_timezone),
        misfire_grace_time=3600,
        id="ciclo_diario",
    )
    scheduler.start()
    yield
    scheduler.shutdown()

app = FastAPI(lifespan=lifespan)
app.include_router(routes.router)
```

## 6. Error handling, observabilidade

- **Log estruturado JSON** via structlog → stdout. Cada ciclo emite `evento=ciclo_inicio`, `evento=grupo_a_aplicado` (1 por pedido), `evento=ciclo_fim` com métricas.
- **Falha em 1 aluno do Grupo A → continua, registra em report**.
- **Falha de I/O de leitura → aborta ciclo, log ERROR, próximo tick re-tenta**.
- **Rate limit Google (429) → backoff exponencial** (3×, 1s/4s/16s) por chamada.
- **Sentinela `GRUPO_A_MAX_PER_CYCLE`**: se > N pedidos pra finalizar num ciclo, aborta com `evento=sentinela_disparada`. Override via `POST /run?force=true`.
- **DRY_RUN=true**: classifier e operations rodam mas operações de escrita só logam — não chamam API. Sync é pulado.

## 7. Testing

| Tipo | Quantidade alvo | Cobre |
|---|---|---|
| Unit | 60+ | classifier (todos sub-casos), parsing RRULE/UNTIL, regex de id no título, limpa_titulo, preserva_cores, models pydantic |
| Integration | 15+ | pipeline.run_ciclo end-to-end com fakes — 0 zerados, 1 zerado simples, 1 zerado múltiplos masters, falha de aluno não trava outros, estourado vai pro report |
| Smoke real | 1 script | `tests/smoke/run_real.py` em calendário Google de teste — não roda em CI |

CI: `uv run pytest tests/unit tests/integration` no GH Actions antes do build da imagem.

## 8. Cutover & operação

### 8.1 Pré-cutover (manual, Pedro)
1. Compartilhar planilha Controle 2026 com `geral-google@automacoes-n8n-491322.iam.gserviceaccount.com` como Editor.
2. Criar DNS `finalizer.skatedreams.com.br` → `178.156.235.107` (Cloudflare).
3. Criar GitHub Secret `PORTAINER_FINALIZER_WEBHOOK_URL` (será gerado durante setup).
4. Criar stack `finalizer` no Portainer com `stack.deploy.yml` (renderizado).
5. Subir as env vars no painel.

### 8.2 Cutover automatizado (pelo serviço/skill)
1. CI publica imagem `:sha` no GHCR.
2. Portainer webhook puxa `:latest`.
3. Container sobe, `/health` responde 200.
4. Operador roda `curl -X POST -H X-Finalizer-Token:... https://finalizer.skatedreams.com.br/run?force=true` — primeiro ciclo manual em DRY_RUN=true pra validar.
5. Compara report com snapshot do dia anterior do W2.
6. Switch `DRY_RUN=false` no Portainer + redeploy.
7. **Desliga o W2 do n8n** via MCP `n8n-skatedreams` (`Urgspel6dgvdAZ6n` set active=false).
8. Próximo cron tick (03:00 BRT) executa real.

### 8.3 Rollback
1. Reativar W2 do n8n via MCP.
2. Redeploy imagem `:sha-anterior` no Portainer (ou só `docker service update --image ... finalizer_app`).
3. Tempo: <2min.

### 8.4 Monitoramento contínuo (Pedro)
- `monitor-with-windows-notification` polling `/status` a cada 30min.
- Alerta quando `last_report.tem_pendencias=true` (grupo_b, grupo_c, w3_issues não-vazios).

## 9. Regras invioláveis (carregadas da memória)

1. **NUNCA estender UNTIL** — só encurtar. Se `UNTIL atual ≤ data_termino`, MANTER.
2. **NUNCA `events.patch({recurrence})` num master existente** — usar DELETE+INSERT. (Regenera o master, cancela todas as instâncias.)
3. **NUNCA deletar/cancelar aulas passadas** — instâncias antigas têm semântica (presença/falta/cancelamento legítimo).
4. **Cor da nova recorrência = cor do MASTER atual**, não de instância pontual recente.
5. **Preservar cores override** (Tomate=falta, Flamingo=substituição) ao recriar master via DELETE+INSERT — mapear antes, re-aplicar depois.
6. **Tratar TODOS os masters do aluno** — não só o último. Cada um pode ter UNTIL diferente.
7. **Idempotência** — rodar 2× dá mesmo resultado.
8. **`data_termino` vem da Calendario** (filtrada pelo Apps Script), não derivada do Google Calendar direto.
9. **Title preserva `id: N`** — quebra do `id:` desconecta o evento do pedido.
10. **Colunas ARRAYFORMULA NUNCA escritas**: A (contador), M (valor_aula), Q (aulas_realizadas_agenda), S (aulas_restantes).
11. **`appendSpreadsheetRows` em Controle**: sempre range `A:S` com 19 valores, primeiro `""`. `valueInputOption=USER_ENTERED`.
12. **`id_novo` just-in-time**: relê `max(Controle!B)+1` antes de cada criação.

## 10. Open items

- [ ] **Honest mode reverso para finalizados S=1** (memória `feedback_finalizado_s1_honest_reverso.md`) NÃO entra nesta iteração. Permanece como skill manual. Justificativa: é caso especial multi-id por aluno, exige decisão humana caso a caso; não é regressão do W2 atual (que também não fazia).
- [ ] **W1 (Automação ID)** continua no n8n. Nenhuma mudança.
- [ ] **Aplicar Grupo B e C** (estourados, intermediários) automaticamente — fora desta iteração. Report only.

## 11. Real-world impact esperado

- 16+ pedidos do Grupo A acumulados em 2026-05-24 viraram skill manual; com o serviço, isso volta pro automático e novos casos não acumulam.
- W3 inativo hoje → valida 100% das transições nos últimos 7d. Issues viram alertas no `monitor-with-windows-notification`.
- Cutover esperado: ~30min de trabalho do Pedro (DNS + share planilha + stack Portainer).
