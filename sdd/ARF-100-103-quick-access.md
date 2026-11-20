# SDD — ARF-100 a ARF-103: acesso rápido numerado (1-9)

## Contexto
Tema J. Até 9 sites fixos, acessíveis por tecla numérica, com variante "sem foco" via modificador, e tecla 0 abrindo todos.

## Escopo
Introduz o primeiro object store de **configuração** (`config`, key-value singleton) no IndexedDB — bump de versão v2→v3, pensado para já acomodar LAYOUT/THEME depois sem novos bumps. Lógica de resolução de tecla isolada e pura (testável sem DOM).

## Critérios de aceite
- [x] `AppConfig.quickAccess: QuickAccessItem[]` (até 9, por `slot`).
- [x] Tecla 1-9 (fora de inputs): abre o item daquele slot, com foco.
- [x] Cmd/Ctrl + tecla 1-9: abre sem foco; funciona encadeado (vários números em sequência com o modificador seguro).
- [x] Tecla 0: abre todos os itens configurados, sem foco.
- [x] Barra visual abaixo do relógio (preparada; relógio em si é THEME, card futuro) mostrando os itens configurados.

## Design técnico
- `src/newtab/lib/quickAccess.ts`: `resolveQuickAccessKey(code, modifierPressed) → QuickAccessAction` — função pura, testada isoladamente.
- Handler de teclado centralizado em `App.svelte` (um único listener global, ao lado do zen mode) para evitar múltiplos listeners concorrentes.
- Edição dos slots por ora via `prompt()` (mesmo padrão pragmático do CORE) — UI rica de configuração fica para quando houver uma tela de "Configurações" dedicada (não antecipar).

## Testes previstos
`resolveQuickAccessKey` cobrindo: dígito 1-9 com/sem modificador, dígito 0, teclas não-numéricas (ignoradas).
