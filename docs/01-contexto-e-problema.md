# 01 — Contexto e problema

## A escola

A **SkateDreams** (CNPJ 50.882.111/0001-47, fundada em 2023) é uma escola de skate localizada em Chácara Santo Antônio, São Paulo. Atende crianças, adolescentes e adultos iniciantes. Posicionamento de marca: *"Uma nova forma de ensinar skate — segura e divertida."*

O dia-a-dia operacional gira em torno de **aulas individuais** (1 professor + 1 aluno por horário) agendadas pelo Google Agenda. Hoje cada aula é um evento isolado, com o nome do aluno no título (ex.: *"Aula — Joãozinho — 16h"*). O sócio-administrador Caio Andreucci é também professor e gestor.

## O problema

O Google Agenda dá ao professor uma visão do *quando* das aulas, mas **não captura o que acontece dentro delas**. Caio precisa, durante ou logo após cada aula, registrar rapidamente sinais que importam para a operação:

- **❌ Aluno não veio** — frequência/inadimplência
- **⏱️ Atraso professor** — qualidade do serviço
- **⏱️⏱️ Atraso grave** — indicador crítico
- **😐 Professor desanimado** — saúde da equipe
- **😭 Alunos não engajados** — risco de evasão

Hoje esses sinais não têm onde morar. O resultado prático:

1. **Padrões ficam invisíveis.** Não dá pra responder "o aluno X faltou quantas vezes nos últimos 30 dias?" sem revisar a agenda manualmente.
2. **Conversas com pais são reativas.** A escola só percebe um problema quando o pai liga reclamando — não antes.
3. **Não há prestação de contas estruturada** para o próprio Caio sobre a operação dele e dos demais professores.

## O que vamos resolver

Um sisteminha web onde o professor:

1. Vê a agenda da escola em uma visualização familiar (estilo Google Agenda).
2. Em um toque, marca os flags em cada aula durante ou logo depois dela.
3. Mais tarde, abre relatórios consolidados por aluno e por período, e exporta CSV para conversas com pais ou análise.

E onde o gestor (Caio):

4. Tem visibilidade agregada do que está acontecendo (faltas, atrasos, engajamento) sem precisar abrir aula por aula.

## Critérios de sucesso

- Um professor consegue marcar todos os flags de uma aula em **menos de 10 segundos** no celular.
- A agenda do app reflete o Google Calendar com no máximo **5 minutos de atraso** (sync incremental).
- Editar título/horário de uma aula no app **propaga para o Google Calendar** sem inconsistência visível ao usuário.
- O relatório consolidado de "faltas por aluno nos últimos 30 dias" é gerado em **menos de 1 segundo** sobre dados do Postgres.

## Fora de escopo deste spec

- Site institucional público da SkateDreams (vitrine, captação de alunos) — virá em spec próprio.
- Pagamentos, faturamento, gestão financeira.
- Cadastro de alunos como entidade rica (CRM). Por ora, "aluno" é apenas o nome extraído do título do evento.
- Multi-tenant / outras escolas. O app é dedicado à SkateDreams.
- Notificações automáticas (alertas por email/WhatsApp) — recurso considerado mas adiado.
- Login OAuth por professor / hierarquia de permissões — MVP usa login único compartilhado.

## Atores

| Ator | Acesso | Ações principais |
|---|---|---|
| **Caio (admin)** | Login compartilhado (MVP) | Conectar Google Calendar, marcar flags, editar eventos, ver relatórios, exportar CSV |
| **Professores** | Login compartilhado (MVP) | Marcar flags em qualquer aula, ver agenda |
| **Conta Google da escola** | OAuth singleton | Provedora dos eventos lidos e destino das edições |

A separação real entre Caio e professores fica para uma fase futura, junto da autenticação multi-usuário.
