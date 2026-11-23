# SDD — ARF-060 a ARF-068: estética "cozy" (background + relógio)

## Contexto
Tema F. O pedido original citava explicitamente o Tabliss como referência.

## Escopo e decisão de fontes de imagem
- **Cor sólida** (ARF-065): implementado.
- **Imagens locais** (ARF-066): implementado — upload via `<input type="file">`, persistidas como `Blob` num novo object store `assets` (bump v3→v4), referenciadas por id no `AppConfig`.
- **Reddit** (ARF-064): implementado **sem precisar de API key** — a API pública JSON (`reddit.com/r/{sub}/top.json`) é acessível via `fetch` direto da extensão porque `host_permissions` para `reddit.com` foi declarado no manifest (extensões com host_permission não sofrem a restrição de CORS que um site comum sofreria).
- **Unsplash** (ARF-063): **implementado (2026-11-21)**, após o usuário criar a Access Key no Unsplash Developer Account. `api.unsplash.com/photos/random?query=<topico>&count=25` via `Authorization: Client-ID <access_key>` (host_permission adicionado no manifest). Atende ao checklist oficial de produção da Unsplash (help.unsplash.com/en/collections/1451694-api-guidelines):
  - **Hotlink**: usa `urls.regular` direto da resposta, nunca baixa/reencoda.
  - **Atribuição**: "Photo by **Nome** on **Unsplash**" visível na UI (canto inferior direito), com `?utm_source=arfyin&utm_medium=referral` nos dois links, formato exato do guideline oficial.
  - **Trigger download**: GET fire-and-forget em `links.download_location` quando a foto se torna o background ativo (uma vez por foto, dedupe por `downloadLocation`) — é o "momento de uso" equivalente a definir como wallpaper, conforme guideline de triggering.
  - **Secret Key**: nunca usada — só é necessária para fluxo OAuth de usuário, que esta extensão não implementa. Só a Access Key (`VITE_UNSPLASH_ACCESS_KEY`) vai pro `.env`/bundle.
  - **Chave client-side**: mesmo trade-off já aceito para a publishable key do Supabase — exposta no bundle da extensão, pior caso é abuso do rate-limit do app (1000/h em produção), não exposição de dado privado (só lê fotos públicas).
  - Parsing testado isoladamente (`extractUnsplashCandidates`), validado end-to-end no Chrome real (fetch 200, trigger download 200, atribuição renderizada).
- Navegação prev/next (ARF-062) e frequência/travar (ARF-067): implementados para qualquer fonte não-sólida.
- Darken/blur: sliders configuráveis, aplicados via CSS (`filter: blur()` + overlay `rgba`).
- Relógio (ARF-061 + parte de ARF-068): hora/data via `Intl.DateTimeFormat` (fuso do sistema, não configurável — decisão consciente, é o que o próprio usuário sugeriu como mais prático), toggle 24h/12h, tamanho/peso de fonte, cor e formato de data (longa/curta/numérica/ocultar) configuráveis — expandido no ARF-130, ver `sdd/ARF-130-settings-drawer.md`. Família tipográfica customizável (trocar a fonte em si, não só peso/tamanho) segue de fora por ora (YAGNI — sem sinal de que o padrão atual incomoda).

## Zen mode e background
`BackgroundLayer` recebe `zen` como prop: em modo zen, blur/darken/navegação somem, mostrando só a imagem/cor pura — exatamente o requisito do Tema G.

## Bug corrigido (2026-11-21) — loop infinito + imagem trocando ao ajustar darken/blur
Descoberto ao validar o Unsplash no Chrome real, em duas rodadas:

**Rodada 1 — loop infinito.** Console mostrava `effect_update_depth_exceeded` (Svelte), repetido a cada tick de qualquer `setInterval` do app (ex.: o relógio). Causa: `let bg = $derived(store.config.background)` é um proxy reativo que **troca de referência por inteiro toda vez que `store.config` é reatribuído** (o store sempre faz `this.config = configRes.config` — um objeto novo vindo do `loadAll()`, mesmo que o conteúdo não tenha mudado). Primeira tentativa de correção: uma chave primitiva memoizada (`bgKey = $derived(JSON.stringify([bg.source, ...]))`), supondo que comparação por valor (string) quebraria o ciclo.

**Rodada 2 — a correção da rodada 1 só reduziu, não eliminou.** Validação seguinte (usuário reportou: ajustar o slider de escurecer/desfoque trocava a foto de fundo sozinho) revelou a causa completa: o Svelte rastreia **qualquer leitura reativa que ocorra durante a execução síncrona de um `$effect`**, não só a variável citada explicitamente no topo. `loadCandidates()`, chamada de dentro do efeito, ainda lia `bg.source`/`bg.subreddits` etc. **diretamente** (a referência instável) antes do primeiro `await` — isso sozinho já prendia o efeito a `bg`, por trás do `bgKey` aparentemente estável. Confirmado com um log temporário: o mesmo `bgKey` (string idêntica), efeito disparando de novo mesmo assim.

**Correção definitiva**: nenhuma função chamada de dentro de um `$effect` pode ler `bg.*` (ou qualquer campo de um `$state` de classe reatribuído por inteiro) — só o primitivo memoizado. `loadCandidates(key: string)` e `fetchFreshCandidates(spec)` agora recebem tudo via `parseBgSpec(bgKey)` (`JSON.parse` de uma string já materializada, não do proxy), e o efeito de frequência lê `frequencyMinutes = $derived(bg.frequencyMinutes)` em vez de `bg.frequencyMinutes` inline. Regra geral a seguir daqui pra frente neste projeto: **todo `$effect` deve ler exclusivamente primitivos memoizados (`$derived` de string/number/boolean) nunca um objeto/array aninhado de um `$state` de classe reatribuído por inteiro** — nem mesmo indiretamente, dentro de uma função chamada por ele.

**Validado**: darken/blur alterados repetidas vezes, foto e atribuição permanecem as mesmas; nenhuma chamada nova a `photos/random`; console sem `effect_update_depth_exceeded`.

**Bug não relacionado, achado no mesmo teste**: `onMount(() => loadCandidates())` duplicava a primeira chamada já feita pelo próprio `$effect` (que roda uma vez na montagem) — removido, redundante.

## Cache de candidatos de background (2026-11-21)
Reportado pelo usuário: nova aba às vezes ficava "carregando" por um tempo (suspeita de rate-limit do Unsplash, já que cada reload buscava 25 fotos novas do zero). Hipótese provável real: o loop infinito acima travando o Svelte runtime no meio da montagem — mas, independente disso, buscar 25 fotos a cada new-tab aberta viola o requisito original do projeto (RNF de performance: new-tab instantânea, sem round-trip de rede) e, com o Unsplash em produção, desperdiça rate limit (1000 req/h) rapidamente.

**Implementação**: novo object store `background_cache` no IndexedDB (bump v4→v5), chave = `"<source>:<bgKey>"`, valor = `{ candidates, fetchedAt }`. `loadCandidates` passa a: (1) consultar o cache primeiro (mensagem `GET_BACKGROUND_CACHE`) — se existir, usa **imediatamente** (zero round-trip) e sorteia um índice; (2) se o cache estiver "stale" (> 1h), dispara um refresh em paralelo que só atualiza o cache para a **próxima** aba, sem perturbar a foto já exibida nesta sessão; (3) sem cache algum, busca fresh (como antes) e grava no cache (`SET_BACKGROUND_CACHE`). Cache guarda só metadados leves (URL + atribuição, nunca bytes de imagem — isso já é cacheado nativamente pelo HTTP cache do browser), então o tamanho fica desprezível (uma lista de ~25 URLs). Validado: segunda aba aberta não disparou novo `photos/random`, só o trigger de download (contagem de uso) da foto sorteada do cache.

## Testes previstos
`extractImageUrls`/`pickRandom` (funções puras de `backgroundSource.ts`) testadas isoladamente. Validação funcional feita no Chrome real: fonte Reddit trocada via mensagem, imagem real do r/EarthPorn carregada com darken aplicado, confirmada visualmente por screenshot.
