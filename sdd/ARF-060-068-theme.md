# SDD — ARF-060 a ARF-068: estética "cozy" (background + relógio)

## Contexto
Tema F. O pedido original citava explicitamente o Tabliss como referência.

## Escopo e decisão de fontes de imagem
- **Cor sólida** (ARF-065): implementado.
- **Imagens locais** (ARF-066): implementado — upload via `<input type="file">`, persistidas como `Blob` num novo object store `assets` (bump v3→v4), referenciadas por id no `AppConfig`.
- **Reddit** (ARF-064): implementado **sem precisar de API key** — a API pública JSON (`reddit.com/r/{sub}/top.json`) é acessível via `fetch` direto da extensão porque `host_permissions` para `reddit.com` foi declarado no manifest (extensões com host_permission não sofrem a restrição de CORS que um site comum sofreria).
- **Unsplash** (ARF-063): **não implementado nesta rodada, documentado como bloqueado**. Pesquisei: o antigo `source.unsplash.com` (que não precisava de key) está morto desde 2024 (retorna 503). A API oficial (`api.unsplash.com/photos/random`) exige uma API key de um Unsplash Developer Account — credencial externa que só o usuário pode criar, mesmo padrão do Supabase/Google OAuth. Fica registrado como card a reabrir quando ele tiver essa chave.
- Navegação prev/next (ARF-062) e frequência/travar (ARF-067): implementados para qualquer fonte não-sólida.
- Darken/blur: sliders configuráveis, aplicados via CSS (`filter: blur()` + overlay `rgba`).
- Relógio (ARF-061 + parte de ARF-068): hora/data via `Intl.DateTimeFormat` (fuso do sistema, não configurável — decisão consciente, é o que o próprio usuário sugeriu como mais prático), toggle 24h/12h, tamanho de fonte e cor configuráveis. Fonte tipográfica e formato de data customizáveis ficam de fora por ora (YAGNI — sem sinal de que o padrão atual incomoda).

## Zen mode e background
`BackgroundLayer` recebe `zen` como prop: em modo zen, blur/darken/navegação somem, mostrando só a imagem/cor pura — exatamente o requisito do Tema G.

## Testes previstos
`extractImageUrls`/`pickRandom` (funções puras de `backgroundSource.ts`) testadas isoladamente. Validação funcional feita no Chrome real: fonte Reddit trocada via mensagem, imagem real do r/EarthPorn carregada com darken aplicado, confirmada visualmente por screenshot.
