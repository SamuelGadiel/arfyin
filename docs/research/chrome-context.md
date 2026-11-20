# Contexto de pesquisa — estado atual do Chrome do Samuel

> Documento vivo. Coletado em 2026-11-20 via inspeção direta do Chrome real (perfil `Default`) usando o MCP `chrome-devtools` (Chrome DevTools Protocol, `--autoConnect`) e leitura direta de arquivos em disco. Objetivo: servir de contexto para qualquer sessão do Claude que continue o projeto **arfyin** (extensão Chrome para substituir Session Buddy + TabStack + Tab Group + Tabliss).

## Como os dados foram coletados

- **Abas abertas**: via `mcp__chrome-devtools__list_pages` (CDP), que lista todos os targets abertos no Chrome real do usuário (requer `chrome://inspect/#remote-debugging` ativado + Full Disk Access do VSCode no macOS).
- **Favoritos nativos**: lidos direto do arquivo `~/Library/Application Support/Google/Chrome/Default/Bookmarks` (JSON), processado com `jq`.
- **Extensões**: identificadas pelos IDs em `~/Library/Application Support/Google/Chrome/Default/Extensions/<id>/<versão>/manifest.json`. Conteúdo/estado de cada uma lido navegando até a página interna (`chrome-extension://<id>/...`) e tirando snapshot de acessibilidade (`take_snapshot`). Código-fonte (bundles JS) inspecionado com `grep` para identificar APIs `chrome.*` usadas e pistas de arquitetura (storage, backend).

## Janelas e abas abertas (snapshot de 2026-11-20)

3 janelas abertas, 62 abas no total:

**Janela 1 — "mix" (17 abas)**: trabalho/pessoal intercalado com curiosidades pontuais.
Fontshare, Kinyu (projeto Claude), Exercícios (Planilhas), Open Source Alternatives, ModernRelay/omnigraph (GitHub), selfh.st, Andrew Tsai's Tips (YouTube), unbaked.games, Portal do Emergencista, "ichiju sansai" (busca), "conserva tsukemono" (busca), "How Japan Stayed Thin..." (YouTube), "Best & Easiest Automated Media Server Guide 2027" (YouTube), "Best Jellyfin Plugins..." (YouTube), "I Spent 18 Years Becoming Tony Stark" (YouTube), OP/ED Sword Art Online (YouTube).

**Janela 2 — cluster "media server / anime / torrent" (40 abas)**: quase 100% dedicada ao hobby atual (self-hosted media server).
Homepage dashboard (Docker, YouTube), Taiyō, Strapi pricing, Bob Ross gallery, Tdarr (YouTube), "Pesquisa ecossistema Arr" (ChatGPT), Servarr Wiki, "How to Make Jellyfin Better..." (YouTube), Homepage (localhost:3000), qBittorrent WebUI (localhost:8080), Prowlarr (localhost:9696), Sonarr — série específica (localhost:8989), Radarr Missing (localhost:7878), Bazarr Movies (localhost:6767), Jellyfin (localhost:8096), Seerr (localhost:5055), buscas e threads de Reddit sobre indexadores de torrent/anime, DFlexy/dfindexer (GitHub), Legendas.net, AniDB (2 abas), fóruns Sonarr, "Best Torrent Sites for Anime 2026" (YouTube), ShaKaw tracker, pirataria.link/trackers, r/trackers.

**Janela 3 — residual**: aba do próprio `chrome://inspect` usada para habilitar o remote debugging (artefato da sessão de setup, não é dado relevante de uso).

## Favoritos nativos do Chrome (`Bookmarks` file)

Barra de favoritos com **12 pastas temáticas** + 4 favoritos soltos sem nome (só ícone) + 1 com nome direto na barra. Nenhuma pasta "other bookmarks" em uso.

Estrutura completa:

```
BARRA DE FAVORITOS
- (sem nome) → youtube.com
- (sem nome) → mail.google.com (Gmail)
- (sem nome) → github.com
- (sem nome) → linkedin.com/feed
[PASTA] Code — MEE6, Painel 2022-Samuca, Figma PCM, Figma Udilink, Figma PEC,
  Protótipo Via Star, Protótipo Farm MVP, Hacking with Swift, Solicitações de
  apps (Notion), Jenkins, Portainer, Zydon APKs (Drive), Protótipo Zydon B2B,
  Swagger Admin
[PASTA] Outros — Google Play Academy (x2), Photo Analyzer
[PASTA] APIs — RapidAPI free APIs, public-api-lists, n0shake/Public-APIs,
  public-apis/public-apis, DummyJSON, Dummy API
[PASTA] Música — 13 links, quase todos YouTube (piano anime covers, Harutya,
  DAOKO×Yonezu)
[PASTA] Flutter
  [PASTA] Icons — Bootstrap, BoxIcons, Eva, Font Awesome, HeroIcons, IonIcons,
    Line Awesome, Octicons, Pixelarticons, Iconify
  Mocky, IconKitchen, API Levels, App Icon Generator, App Store Screenshot
  Generator, JSON to Dart, Shadow Generator RN/Flutter
[PASTA] ROMS — GameCube ROMs (x2), Vimm's Lair, Mr. Sujano (YouTube),
  Retro Game Corps (YouTube), fmhy.net/gaming
[PASTA] MacApps — Haxmac, FileCR, Cmacked, AppKed, Mac Torrents, NMac Ked
[PASTA] Branef (cliente/projeto de trabalho)
  [PASTA] BR Scala — Figma, Swagger Teste
  [PASTA] Sivisa+ — Figma + 9 ambientes (teste/homolog/staging/prod/POC,
    cada um com link admin + swagger)
  [PASTA] Sisvisa — Figma + 6 ambientes
  [PASTA] PRODESP — Figma + 2 ambientes
  [PASTA] SERR — Protótipos Claude/Figma + 6 ambientes
  Projetos Visa (SharePoint)
[PASTA] yt — incompetech, Background Remover, WEBP→PNG, cobalt.tools,
  2 vídeos YouTube
[PASTA] Livros — Z-Library (x2), libgen, eLivros, dLivros, Polvo Livros
[PASTA] Agapech (outro projeto/cliente) — NFS-e, Nota fiscal Uberlândia,
  Questor Zen, Gerador de Orçamento
[PASTA] Steam — HubcapDB, Ryuu's Manifests, lua.tools/fixes, Online-Fix,
  AnkerGames Fixes
- (sem nome) → developers.google.com
- logo.com → app.logo.com dashboard
- (sem nome) → bjango.com (artigo menu bar extras)
- (sem nome) → blog.whidev.com (menu bar extra Flutter/macOS)
```

**Leitura**: os favoritos refletem projetos/clientes antigos e hobbies estabelecidos (Branef, Agapech, ROMS, Steam, Música). **Nenhuma pasta de media-server/Jellyfin existe ainda** — confirma que esse interesse é recente e nunca foi "oficializado", ficando só como bagunça de abas.

## As 4 extensões de organização instaladas

### 1. Session Buddy — "Tab & Bookmark Manager"
- **ID**: `edacconmaakjimmfgnblocblbcdcpbko` · **versão instalada**: 4.1.2
- **Manifest `permissions`**: `tabs`, `storage`, `unlimitedStorage`, `alarms` — **sem** `bookmarks` declarada estaticamente; usa `chrome.permissions.request/contains` para pedir acesso a bookmarks nativos **sob demanda** (ex.: ao importar/exportar), não na instalação.
- **Arquitetura observada no código**: persiste em **IndexedDB local** (bundle confirma `indexedDB`; `unlimitedStorage` existe exatamente pra isso). Monitora tabs/windows em tempo real com o conjunto completo de listeners (`onCreated/onRemoved/onUpdated/onAttached/onDetached/onMoved/onReplaced`, `windows.onCreated/onRemoved/onBoundsChanged`). Usa `chrome.alarms` (rotina periódica — provável autosave de sessão) e `chrome.commands` (atalhos de teclado). **100% local, sem backend de nuvem, sem `chrome.storage.sync`** → não sincroniza entre dispositivos nativamente.
- **Estado observado (dados reais do usuário)**:
  - 57 abas da sessão atual guardadas como snapshot "This browser"
  - 7 **Collections** manuais, todas de **julho/2025** (~1 ano sem uso), **210 links no total**:
    | Collection | Links | Tema |
    |---|---|---|
    | Design System Branef | 5 | Widgetbook/Flutter (cliente Branef) |
    | Interessante | 37 | mix: YouTube variado, Flutter, Mac, dev geral |
    | Projetinhos | 45 | 3 side-projects: Watcha (watchlist c/ Notion+TMDB API), RedWall (wallpaper Reddit em Flutter), Blog pessoal |
    | Youtube Canal | 33 | pesquisa para começar canal (edição, growth, OBS) + 2 tópicos avulsos (keychain iOS, Nativefier) |
    | API Client | 8 | alternativas ao Postman (Firecamp, Bruno, Scalar, Yaak...) |
    | HQs - Homem de Ferro | 10 | ordem de leitura dos quadrinhos |
    | Vim | 72 | aprendizado + configuração avançada de Neovim |

    Conteúdo completo (todas as URLs) em [`session-buddy-conteudo-completo.md`](session-buddy-conteudo-completo.md).
- **Modelo de UX**: busca + lista plana de "Collections", cada uma com subpastas internas; abrir = navegar manualmente até a lista. Requer acesso ativo e intencional — não há nudge/lembrete para revisitar.
- **Avaliação do usuário**: "73 abas salvas lá, mas acabo nunca usando. A usabilidade não é boa, tenho que ficar ativamente acessando e acabo não usando."

### 2. TabStack — "new tab replacement"
- **ID**: `amnedlnfojpbikejegoibnennmpnonnm` · **versão instalada**: 0.3.2
- **Manifest `permissions`**: `tabs`, `identity`. `content_scripts` injetado em `*://*.google.com/*` (motivo exato não confirmado — possivelmente extração de favicon/dados ligados a conta Google).
- **Arquitetura observada no código**: usa **Supabase como backend** (string `supabase` encontrada no bundle) + domínio próprio `https://tabstack.co`. Login via `chrome.identity.launchWebAuthFlow` (OAuth) → **dados sincronizados na nuvem**, não só local. Bundle moderno (Vite/chunks).
- **Estado observado (dados reais do usuário)**: new-tab substituída por página com seções fixas curadas manualmente — **Terminal** (Tmux, NeoVim, zsh), **Claude** (9 links sobre Claude Code/CLAUDE.md), **Interessante** (Fabio Akita, selfh.st, opensourcealternative.to, ferramentas de design), **Bullet Journal** (10 vídeos sobre journaling), **Projetinhos** (Coolify), **Financial App** (ChatGPT, Belvo, Pluggy — pesquisa de Open Finance). Além disso, uma seção **live** "Browser Windows & Tabs" que reflete as 3 janelas abertas em tempo real, com botão "Save all" por janela. Suporta múltiplas "Pages" (só "Default Page" em uso) e import/export (Toby JSON, HTML de bookmarks).
- **Modelo de UX**: seções curadas por tema (feitas à mão, como uma home page pessoal) + área dinâmica de abas abertas. É o mais completo dos três em termos de produto, mas a curadoria manual das seções é esforço contínuo.
- **Avaliação do usuário**: "muito boa, mas tenho minhas críticas, e acabo não usando muito."

### 3. Tab Group — "Save, Organize & Restore Your Tabs"
- **ID**: `gjgjkhbmehogehkdnoooeihkipifimme` · **versão instalada**: 1.4.2
- **Manifest `permissions`**: `tabs`, `storage`, `contextMenus`. `content_scripts` declarado para todo `http(s)://*/` mas o arquivo (`content_script/end.js`) está **vazio** — feature morta/vestigial.
- **Arquitetura observada no código**: usa `chrome.storage.sync` **com uma lib própria `chrome-Storage-largeSync.min.js`** que faz chunking para contornar o limite de ~8KB por item do sync storage nativo do Chrome → sincroniza entre dispositivos via **conta Google do Chrome**, sem backend próprio (sem Supabase/Firebase). UI feita com jQuery + Material Design (`material.min.js`) + `html5sortable.min.js` (drag-and-drop de itens). Única extensão das 4 com `contextMenus` (clique direito para ações).
- **Estado observado (dados reais do usuário)**: na verdade **19 grupos salvos** (contei 20 na primeira passada por engano), cada um com ações "Open in browser" / "Open in new window", **305 links no total**:

  | Grupo | Links | | Grupo | Links |
  |---|---|---|---|---|
  | Calendario Videos | 10 | | VSCode Extensions | 26 |
  | Alexa Development | 51 | | Casamento | 15 |
  | No Intro Roms | 13 | | UEFI macOS | 10 |
  | GitHub | 26 | | Fastlane | 24 |
  | GetIt/GoRoute | 14 | | Cartão Itau | 16 |
  | Leitura | 11 | | PS2 | 17 |
  | Flutter | 13 | | Obsidian | 8 |
  | AWS | 8 | | RPG | 13 |
  | Viajá | 17 | | TCC | 6 |
  | | | | TCC e Academico | 7 |

  Conteúdo completo (todas as URLs, extraídas via `chrome.storage.sync` + expansão de cada grupo na UI) em [`tab-group-conteudo-completo.md`](tab-group-conteudo-completo.md).
- **Modelo de UX**: popup pequeno (sem página cheia), lista de grupos nomeados, restauração em 1 clique.
- **Avaliação do usuário**: "até esquecido que tinha isso. Testei, mas não adaptei."

### 4. Tabliss — "A Beautiful New Tab"
- **ID**: `hipekcciheckooncpjeljhnekcoolahp` · **versão instalada**: 2.6.0
- **Manifest `permissions`**: **somente** `storage`. Sem `tabs`, sem `bookmarks`, sem `contextMenus`. `chrome_url_overrides.newtab` declarado, mas **perdeu o override para o TabStack** (instalado depois) — está instalada mas inativa como new-tab.
- **Arquitetura observada no código**: nenhuma API relevante de navegador usada (só `chrome.runtime.id`). Puramente visual — backgrounds/temas e widgets (relógio, clima etc.), preferências em `storage.local`.
- **Avaliação do usuário**: "não organiza nada. Era só uma forma de deixar o new tab mais bonito."

## Tabela-resumo de arquitetura

| Extensão | Permissions chave | Persistência | Sync entre dispositivos | Gestão real de abas/favoritos? |
|---|---|---|---|---|
| Session Buddy | tabs, storage, unlimitedStorage, alarms | IndexedDB local | Não | Sim (snapshot + collections manuais) |
| TabStack | tabs, identity | Supabase (cloud) via OAuth | Sim (conta própria) | Sim (seções curadas + live tabs) |
| Tab Group | tabs, storage, contextMenus | chrome.storage.sync (chunked) | Sim (conta Google) | Sim (grupos nomeados) |
| Tabliss | storage | storage.local | Não | Não (só estética) |

## Diagnóstico comportamental (padrão identificado)

O usuário instalou **3 ferramentas distintas de "salvar estado de abas"** com modelos de dados diferentes (snapshot passivo, grupos nomeados, página curada), todas tecnicamente competentes, e **nenhuma resolveu o problema real**. O gargalo não é a captura (salvar é fácil nas 3), é a **fricção de revisão/retorno**: nada notifica, nada ressurge no fluxo natural de navegação, tudo exige acesso ativo e intencional a uma UI separada — que o usuário para de abrir depois de pouco tempo (collections e grupos "1 ano atrás" / "esquecido que existia").

Interesses em paralelo observados nas abas/favoritos atuais, fora o hobby de media-server: organização pessoal (bullet journal, financas), projetos de trabalho (Branef, Agapech, Kinyu), pesquisa recorrente sobre Claude Code/IA.

## Próximos passos (a preencher)

- [ ] Requisitos funcionais que o usuário espera da extensão nova (pendente — ele vai detalhar na conversa)
- [ ] Decisão de arquitetura: local-only (IndexedDB, como Session Buddy) vs. sync (storage.sync, como Tab Group) vs. backend próprio (como TabStack)
- [ ] Decisão de UX: new-tab override, popup, side panel, ou notificações/nudges para resolver o problema de "fricção de revisão"
