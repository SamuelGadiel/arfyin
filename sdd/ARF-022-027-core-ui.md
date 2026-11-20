# SDD — ARF-022 a ARF-027: UI completa de grupos e abas (CORE)

## Contexto
Núcleo do produto (Tema B/C/H do `feature_ideas.md`). Cobre de uma vez os 6 cards do epic CORE porque são uma única fatia vertical coesa: sem UI real não dá pra validar nenhum deles isoladamente.

## Escopo
**Entra**: renderização de grupos+abas com favicon/nome (B3), colapsar grupo (B2), drag-and-drop nativo (HTML5 DnD, sem lib externa — ADR de peso) para reordenar dentro do grupo e mover entre grupos/para fora (B4), botão "+ Novo grupo" (C4), modo de ordenação manual vs. alfabética (B4 simplificado — ver nota abaixo), clique com/sem foco (H1), botão "abrir grupo inteiro sem foco" (H2), cor/ícone de grupo (H3), pin de aba (H4).

**Simplificação consciente registrada aqui** (não é uma omissão silenciosa): o requisito B4 pede também um modo "misturado" onde abas soltas podem aparecer entre grupos. Isso exigiria um campo de ordem compartilhado entre duas entidades heterogêneas (grupo e aba solta) — modelagem nova, não coberta pelo schema atual. Implementado por ora: "Manual" (ordem definida por drag) vs. "Alfabética", com abas soltas sempre numa seção separada ao final. O modo misturado fica registrado como extensão futura, não implementado agora (YAGNI até ter sinal real de que falta).

## Critérios de aceite
- [x] Grupos renderizam nome, cor (borda lateral), ícone, contagem de abas, favicon de cada aba.
- [x] Colapsar/expandir grupo, estado persistido (`collapsed` no registro).
- [x] Criar grupo via botão.
- [x] Apagar grupo (com confirmação) e renomear (duplo clique no nome).
- [x] Pin de aba (aparece no topo, via `setTabPinned`).
- [x] Cor/ícone de grupo editáveis.
- [x] Drag de aba: reordenar dentro do grupo e mover entre grupos/para fora — ambos usando o mesmo protocolo de dataTransfer (`src/newtab/lib/dragdrop.ts`).
- [x] Clique simples abre com foco; Cmd/Ctrl+clique abre sem foco.
- [x] Botão "abrir tudo" do grupo abre todas as abas sem foco.
- [x] Validado no Chrome real (não só testes): criar grupo, adicionar aba, pin — tudo refletido no IndexedDB real via mensagens.

## Design técnico
- `src/newtab/lib/store.svelte.ts`: estado central (Svelte 5 runes, classe com `$state`). Estratégia **"refetch tudo após toda mutação"** — simples e correto para o volume real do usuário (centenas de itens, não milhares); evita bugs de patch otimista incremental. Revisitar só se perf realmente degradar (não antecipar).
- `src/newtab/lib/dragdrop.ts`: protocolo único de DnD (`application/x-arfyin-drag` + payload JSON tipado), reusável pelo card LIVE (arrastar aba/janela aberta pra dentro de um grupo).
- Componentes: `TabManager` (orquestra) → `GroupItem` → `TabItem`; `UngroupedSection` para abas soltas.
- UI de edição (renomear, cor/ícone) usa `prompt()`/`confirm()` nativos por ora — suficiente e sem custo de engenharia de modal próprio; pode evoluir depois se incomodar no uso real.

## Testes previstos
Lógica de mutação (reorder/move/pin/collapse/appearance) já coberta em `tests/shared/storage-reorder.test.ts` (ARF commit anterior). Componentes Svelte não ganharam testes de componente isolados nesta rodada (trade-off de tempo): a validação foi feita por teste manual real no Chrome (criar/adicionar/pin confirmados via mensagens reais). Risco aceito e registrado — card de QA (ARF-110, e2e) é o lugar certo para fechar essa lacuna com testes automatizados de UI.
