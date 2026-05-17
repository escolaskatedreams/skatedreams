# SkateDreams Design System — v1 (derivado da logo)

> Design system **v1**, derivado diretamente da logo oficial (`docs/brand/assets/logo/skatedreams-logo-1.jpg`). A paleta, o espírito e as proporções tipográficas foram extraídos da imagem real da marca — não é mais um placeholder.

## Princípios de marca

1. **Dreamy** — a forma de nuvem da logo é leitura dupla: skate visto de cima + nuvem. O sistema visual deve evocar leveza, possibilidade e sonho.
2. **Bold** — azul cobalto profundo, fontes geométricas pesadas, contraste alto. Não é delicado demais.
3. **Youthful** — público jovem (crianças, adolescentes, adultos iniciantes) e seus responsáveis. Energia sem ser caótico.

## Logo

Asset disponível: `docs/brand/assets/logo/skatedreams-logo-1.jpg` (318 × 318 px, JPG).

- Forma: nuvem cobalto profundo sobre fundo azul-céu pastel.
- Highlights brancos no topo simulam reflexo de luz / nuvem.
- Dupla leitura: skate visto de cima + nuvem = "dreams".
- Servida estaticamente em `/public/skatedreams-logo.jpg` (asset Next.js).

## Paleta de cores

Extraída da logo. Tokens implementados no `tailwind.config.ts` sob `colors.brand`.

| Token                  | HEX        | Uso                                              |
|------------------------|------------|--------------------------------------------------|
| `brand-primary`        | `#1F4FB0`  | Azul cobalto — cor principal da marca, CTAs, links |
| `brand-primary-strong` | `#143A8A`  | Hover/active do primary                          |
| `brand-sky`            | `#C9E0EA`  | Fundo institucional pastel                       |
| `brand-sky-soft`       | `#E8F2F7`  | Background mais sutil (cards, painéis)           |
| `brand-cloud`          | `#FFFFFF`  | Branco-nuvem — contraste em superfícies azuis    |
| `brand-ink`            | `#0F1B3D`  | Navy escuro — texto pesado, headings             |
| `brand-muted`          | `#6B7A99`  | Texto secundário (cinza com tom azul)            |
| `brand-success`        | `#3DBE7A`  | Verde — presença, positivo                       |
| `brand-warn`           | `#F5B935`  | Amarelo-mostarda — atrasos leves, alertas        |
| `brand-danger`         | `#E14B5A`  | Vermelho-coral — faltas, atrasos graves, erros   |

## Tokens para flags de aula

| Flag                     | Tipo                   | Cor token                                           |
|--------------------------|------------------------|-----------------------------------------------------|
| Aluno não veio           | `student_absent`       | `brand-danger`                                      |
| Atraso professor (leve)  | `teacher_late`         | `brand-warn` + texto `brand-ink`                    |
| Atraso grave             | `teacher_very_late`    | `brand-danger`                                      |
| Professor desanimado     | `teacher_unmotivated`  | `brand-muted`                                       |
| Alunos não engajados     | `students_disengaged`  | `brand-warn` + texto `brand-ink`                    |

## Tipografia

| Token            | Valor                            | Uso                       |
|------------------|----------------------------------|---------------------------|
| `font-display`   | `Archivo, Inter, sans-serif`     | Títulos, hero, nome da marca |
| `font-body`      | `Inter, system-ui, sans-serif`   | Texto corrido, UI, labels |
| `font-mono`      | `ui-monospace, JetBrains Mono`   | Horários, dados numéricos |

Justificativa: Archivo tem forma geométrica arredondada que combina com a bolha/nuvem da logo. Inter é neutra e legível em qualquer tamanho. Trocáveis se o cliente fornecer fontes oficiais diferentes.

## Espaçamento e border-radius

- Sistema base-4: `4, 8, 12, 16, 24, 32, 48, 64 px`.
- Border radius padrão: `8px`.
- Cards de aula: `12px`.
- Avatares: `pill` (border-radius: 9999px).

## Componentes-chave

- `Calendar` (visualização semana/dia, eventos em `brand-primary`)
- `LessonCard` (evento de aula com slots para flags)
- `FlagChip` (botão/badge para cada flag de aula, cores semânticas acima)
- `TeacherAvatar`
- `StudentList` (dentro de LessonCard)

## Próximos passos

- Logo SVG vetorial (para escala sem perda em retina/impressão).
- Fontes oficiais da marca — se forem diferentes de Archivo/Inter, substituir tokens.
- Fotografia institucional — guidelines de proporção, paleta de temperatura, composição.
