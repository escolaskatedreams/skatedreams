# Assets da SkateDreams — pendentes

## Status do download automático

Tentativas de download automático do Instagram (@escolaskatedreams) e Facebook (escolaskatedreams) falharam: **ambas as plataformas bloqueiam acesso anônimo desde 2024**. Ferramentas usadas: `instaloader`, `gallery-dl`. Resultado: 403 / "user not found" para qualquer query sem login válido.

**Alternativas possíveis:**
1. **Caio fornece os assets manualmente** (recomendado) — colocar nesta pasta organizada como abaixo.
2. **Login do Instagram via `instaloader`** — requer credenciais e tem risco de bloqueio da conta. Não recomendado.
3. **API oficial do Instagram Graph (Meta for Developers)** — exige conta business + app review, vale a pena apenas se quisermos integração contínua (ex.: exibir últimas fotos no site).

## O que precisamos do Caio

Coloque os arquivos nas subpastas correspondentes:

```
assets/
├── logo/                  # logos em PNG/SVG, versões claras/escuras, alta resolução
├── photos/aulas/          # fotos das aulas e da pista
├── photos/equipe/         # fotos dos professores
├── photos/identidade/     # qualquer arte promocional, banner, post template
├── videos/                # reels e vídeos institucionais
└── docs/                  # PDFs, briefings, qualquer material de marca pré-existente
```

### Checklist mínimo para o site institucional futuro

- [ ] Logo SkateDreams em SVG (vetor) — versão principal
- [ ] Logo monocromático (preto e branco) para fundos coloridos
- [ ] Paleta de cores oficial (HEX dos tons usados nas redes)
- [ ] Tipografia oficial (nomes das fontes usadas em posts)
- [ ] 5–10 fotos de alta resolução das aulas/pista
- [ ] 2–3 fotos do Caio e demais professores
- [ ] 2–3 vídeos curtos (15–30s) para usar como hero
- [ ] Slogan oficial ("Uma nova forma de ensinar skate — segura e divertida"?)

### Para a ferramenta interna (MVP atual)

Para a ferramenta de controle de aulas, **só precisamos do logo** (qualquer formato) — o resto fica para o site institucional.
