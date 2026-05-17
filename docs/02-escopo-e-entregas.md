# 02 — Escopo e entregas

## Funcionalidades do MVP

### F1 — Autenticação (mínima)

- Tela `/login` com email + senha.
- Login compartilhado, criado via seed: 1 linha em `users` com role `admin` e senha vinda de `SEED_PASSWORD`.
- Sessão em cookie HTTP-only.
- Logout em `/config`.

### F2 — Conexão com Google Calendar

- Tela `/config` com botão **"Conectar Google Calendar"**.
- Fluxo OAuth 2.0 com escopos `calendar.events` e `calendar.readonly`.
- Tokens armazenados criptografados em `google_connection` (singleton).
- Indicador visual do estado da conexão (conectada / desconectada / erro).
- Botão **"Reconectar"** para refazer o fluxo.
- Botão **"Forçar sincronização agora"**.

### F3 — Sincronização de eventos

- Sync incremental (`syncToken`) a cada 5 minutos via cron interno do container.
- Sync on-demand pelo botão em `/config` e ao recarregar `/agenda`.
- Janela inicial: `[hoje − 90d, hoje + 30d]`.
- Heurística para extrair `student_name` do título do evento (padrão `*— Nome —*` ou `*Aula <Nome>*`).
- Em caso de sync token expirado (HTTP 410): full sync transparente da janela.

### F4 — Visualização da agenda

- Página `/agenda` como rota principal.
- Calendário no estilo Google Agenda usando **FullCalendar** + tema customizado SkateDreams.
- Views: **dia**, **semana** (default), **mês**.
- Eventos renderizam com nome do aluno, hora, e **ícones das flags ativas** no rodapé.
- Indicador "Última sync: X min" no header.
- Responsivo: mobile usa dia/agenda list, desktop usa semana/mês.

### F5 — Edição de eventos

- Click num evento → modal (ou drawer no mobile) `/aula/[id]`.
- Campos editáveis: título, descrição, data/hora início, data/hora fim, status (confirmado/cancelado).
- Salvar dispara `PATCH /api/events/[id]` → `events.patch()` no Google → atualiza cache.
- Conflitos de edição (etag mismatch): exibe mensagem "este evento foi editado no Google; recarregue".

### F6 — Marcação de flags

- Dentro do mesmo modal, abaixo dos detalhes do evento.
- 5 **FlagChips** toggleáveis (❌ ⏱️ ⏱️⏱️ 😐 😭).
- Campo opcional de **observações** (texto livre, até 500 caracteres, atrelado à entidade aula).
- Salvar é otimista (UI atualiza imediatamente, rollback se POST falhar).
- Histórico de alterações: cada flag salva `created_by` e `created_at`. Edições futuras (toggling off + on novamente) geram novas linhas em vez de update — preserva trilha de auditoria.

### F7 — Relatórios

- Página `/relatorios`.
- Filtros: período (atalhos: 7d, 30d, 90d, customizado) e aluno opcional (autocomplete).
- 4 cards de resumo:
  - Total de aulas no período
  - % com pelo menos uma flag
  - Top 3 alunos com mais faltas
  - Top 3 horários/dias com mais problemas
- Tabela detalhada: linha por aluno, colunas por tipo de flag, totais.
- Botão **Exportar CSV** — download direto, encoding UTF-8, separador `,`.

### F8 — Configurações

- Página `/config` agrega:
  - Estado da conexão Google
  - Estado da sincronização
  - Dados da sessão atual (email logado)
  - Logout

## Não-funcionais

- **Performance:** ações comuns < 200ms; export CSV < 2s para 90 dias de dados.
- **Disponibilidade:** alvo informal — uptime "bom o suficiente" para uma escola; sem SLA formal.
- **Segurança:** tokens OAuth criptografados em repouso; senhas com bcrypt (cost ≥ 12); HTTPS obrigatório via Cloudflare; cookies `HttpOnly`, `Secure`, `SameSite=Lax`.
- **Backup:** dump diário do Postgres para volume separado no host Hetzner; retenção 7 dias.
- **Idioma:** todo o produto em pt-BR.
- **Acessibilidade:** contraste AA, foco visível, navegação por teclado em todos os controles.

## Entregáveis

Em ordem de execução (definidos com mais detalhe no plano de implementação que virá depois):

1. Scaffold Next.js + Drizzle + Postgres + Docker compose local
2. Schema do banco + migrations + seed
3. Auth simples (login/logout) + middleware de proteção
4. Conexão Google OAuth + tela `/config`
5. Sync inicial + cron de sync incremental
6. Página `/agenda` com FullCalendar lendo do DB
7. Modal de aula: visualização + edição (sem flags ainda)
8. FlagChips funcionais + persistência
9. Página `/relatorios` + export CSV
10. Tema SkateDreams aplicado nos tokens do design system v0
11. Dockerfile + manifesto Docker Swarm + integração com Portainer
12. Cloudflare DNS + certificado

## Definições de "pronto"

Cada entregável só é considerado pronto se:

- Build passa, lint passa, type-check passa.
- Funcionalidade testada manualmente em mobile (Chrome DevTools) e desktop.
- Sem erros no console.
- Documentação relevante atualizada (este `02-escopo` ou `03-arquitetura`).
- Nenhum segredo em commit.

Testes automatizados: ver decisão no [04-adrs](04-adrs.md#adr-005).
