# SkateDreams Design System — v0 (provisório)

> Este é um design system **provisório**, criado antes de termos acesso aos assets oficiais da marca. Todos os valores aqui são guesses informados baseados em (a) o posicionamento conhecido da escola ("uma nova forma de ensinar skate — segura e divertida") e (b) convenções da cultura skate urbana. **Vai ser revisado** assim que o Caio fornecer logo, paleta e fotografia oficiais.

## Princípios de marca

1. **Seguro e divertido** — tagline oficial; o sistema visual deve transmitir segurança/profissionalismo sem perder energia.
2. **Urbano e jovem** — público inclui crianças, adolescentes e adultos iniciantes; estética skate culture sem ser hostil/excludente.
3. **Pais como decisores** — alunos menores chegam pelos responsáveis; visual precisa funcionar para os dois públicos.

## Paleta provisória

Valores **placeholder** a serem substituídos. Codinome aspiracional baseado em cultura skate + identidade brasileira.

| Token             | HEX        | Uso                                            |
|-------------------|------------|------------------------------------------------|
| `--brand-primary` | `#FF5A1F`  | Laranja energético (CTAs, destaques)           |
| `--brand-dark`    | `#0F1115`  | Quase-preto (texto, fundos escuros)            |
| `--brand-light`   | `#FAFAF7`  | Off-white (fundo claro)                        |
| `--brand-accent`  | `#3DDC84`  | Verde ação (sucesso, presença)                 |
| `--brand-warn`    | `#FFC93C`  | Amarelo (atrasos leves)                        |
| `--brand-danger`  | `#E63946`  | Vermelho (atrasos graves, faltas)              |
| `--brand-muted`   | `#6B7280`  | Cinza (texto secundário)                       |

## Tokens para flags do professor (semântica direta)

| Flag                    | Emoji | Cor token         |
|-------------------------|-------|-------------------|
| Aluno não veio          | ❌    | `--brand-danger`  |
| Atraso professor        | ⏱️   | `--brand-warn`    |
| Atraso grave            | ⏱️⏱️ | `--brand-danger`  |
| Professor desanimado    | 😐    | `--brand-muted`   |
| Alunos não engajados    | 😭    | `--brand-warn`    |

## Tipografia provisória

| Token            | Valor                                  | Uso                  |
|------------------|----------------------------------------|----------------------|
| `--font-display` | `'Archivo', 'Inter', sans-serif`       | Títulos, hero        |
| `--font-body`    | `'Inter', system-ui, sans-serif`       | Texto corrido, UI    |
| `--font-mono`    | `ui-monospace, 'JetBrains Mono'`       | Horários, dados      |

Justificativa: fontes geométricas com personalidade (Archivo) + neutra confiável (Inter). Trocáveis quando soubermos as oficiais.

## Espaçamento / radius

Sistema base-4: `4, 8, 12, 16, 24, 32, 48, 64px`.
Border radius padrão: `8px`. Cards de aula: `12px`. Avatares: `pill`.

## Componentes-chave (a ser detalhado na fase de UI)

- `Calendar` (visualização semana/dia tipo Google Agenda)
- `LessonCard` (evento de aula com slots para flags)
- `FlagChip` (botão/badge para cada flag de aula)
- `TeacherAvatar`
- `StudentList` (dentro de LessonCard)

## O que vai mudar quando os assets oficiais chegarem

- Substituir paleta pelas cores reais da marca
- Substituir fontes provisórias pelas oficiais
- Adicionar logo em todas as variantes (claro/escuro/mono)
- Definir grid e proporções fotográficas
- Criar guidelines de uso do logo

## Referência

- Princípios e tokens devem ser implementados como CSS variables ou tokens (TailwindCSS theme / shadcn) no app.
- Quando o cliente fornecer brand book oficial, este arquivo deve ser atualizado e versionado.
