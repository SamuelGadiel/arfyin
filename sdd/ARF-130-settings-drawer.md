# SDD — ARF-130: Drawer de configurações + relógio expandido

## Contexto
Pedido do usuário em uso real: as configurações estavam espalhadas (um `<details>` dentro do `TabManager`, toolbar com selects soltos) e o relógio tinha poucas opções (sem controle de peso de fonte, tamanho limitado a 96px, sem formato de data, sem opção de ocultar data) — além de um comportamento indesejado (clicar no relógio alternava 24h/12h, quando isso devia ser só configuração).

## Escopo
1. **Relógio deixa de alternar formato por clique** — `format24h` só muda via configuração.
2. **`ClockConfig` expandido**: `fontWeight` (100–900), `dateFormat` (`"long" | "short" | "numeric" | "hidden"`), `fontSize` com teto elevado (24–180px, antes 24–96px).
3. **Drawer de configurações** (`SettingsDrawer.svelte`): hamburguer fixo no canto superior esquerdo (visível em qualquer layout, oculto em zen mode), abre um painel lateral com backdrop, organizado em seções: Layout, Relógio, Aparência, Conta, Dados. Fecha com X, clique no backdrop ou `Escape`.
4. **Reorganização de componentes**: `BackgroundSettings` perde a seção de relógio (vira `ClockSettings.svelte`, própria); `TabManager` perde Layout/Auth/Background/Backup (migram pro drawer), mantém só "Novo grupo" + "Ordenar" (ações diretas sobre a lista visível, não "configurações").

## Bugs corrigidos no mesmo ciclo

### 1. Flash de layout errado ao abrir nova aba
Reportado pelo usuário: com layout `scroll-reveal`, por um instante a new-tab mostrava o layout `coexistent` (relógio+abas juntos) antes de trocar para o correto. Causa: `store.config` começa como `defaultAppConfig()` (`layoutMode: "coexistent"`) e só é substituído pelo valor real ao fim de `loadAll()` — que buscava `config` **por último**, depois de groups/tabs (sequência de várias mensagens `send()`). Corrigido: `loadAll()` agora busca `GET_CONFIG` **primeiro**, e `App.svelte` só renderiza o layout quando `store.configLoaded` é `true` (novo flag, resolve antes do `loaded` geral que ainda espera groups/tabs). Validado: new-tab com `scroll-reveal` abre direto na tela cheia do relógio, sem flash.

### 2. "Ocultar data" não funcionava
`dateFormat: "hidden"` era mapeado para `null` num dicionário, e o código fazia `DATE_FORMAT_OPTIONS[dateFormat] ?? DATE_FORMAT_OPTIONS.long` — `null ?? x` sempre retorna `x`, então o fallback "long" vencia mesmo com "hidden" selecionado (confirmado: o botão "Ocultar" ficava marcado como ativo, mas a data continuava visível). Corrigido checando a chave `"hidden"` explicitamente antes de consultar o dicionário, em vez de depender de nullish coalescing sobre um valor `null` legítimo.

### 3. Merge defensivo de `AppConfig` era raso
`getAppConfig` fazia `{...defaultAppConfig(), ...config}` — um spread raso substitui o objeto `clock`/`background` inteiro pelo salvo, então um registro real do usuário gravado **antes** de `fontWeight`/`dateFormat` existirem ficaria com esses campos `undefined` (não com o default). Corrigido com merge aninhado: `{...defaults, ...config, clock: {...defaults.clock, ...config?.clock}, background: {...defaults.background, ...config?.background}}`. Testado (`getAppConfig merge defensivo` em `storage.test.ts`): config parcial preenche os campos novos sem resetar os já customizados.

## Design técnico
- `SettingsDrawer.svelte` mantém `open` como estado local (não precisa ir pro `AppConfig` — é estado de UI efêmero, não preferência persistida).
- Z-index: hamburguer (20) < backdrop (29) < drawer (30), acima do `BackgroundLayer` (-2/-1) e do conteúdo principal.
- Visual: fundo escuro translúcido com `backdrop-filter: blur()`, seções com cabeçalho uppercase discreto, controles em estilo "segmented control" (ao invés de `<select>` nativo) para as escolhas curtas (fonte do relógio, formato de data, fonte do background, layout) — mais alinhado ao visual "cozy" do Tabliss do que combobox do SO.

## Testes previstos
Lógica pura nova (merge defensivo de config) coberta em `storage.test.ts`. Componentes Svelte (drawer, segmented controls) validados manualmente no Chrome real, como os demais componentes de UI desta sessão — incluindo o teste específico que pegou o bug do `??`/`null` (só visível interagindo de verdade, não em teste unitário).
