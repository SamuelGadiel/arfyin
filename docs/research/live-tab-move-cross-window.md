# Mover aba(s) viva(s) entre janelas preservando estado

> Origem: pedido direto do usuário (2026-11-27). Fluxo real que ele faz manualmente hoje: desmaximizar uma janela pra ver a outra por baixo e arrastar a aba entre elas, pra não perder estado de formulário/edição em andamento na página. Pergunta: a extensão pode resolver isso sem passar por close+reopen?

## Viabilidade técnica

Sim. `chrome.tabs.move(tabIds, {windowId, index})` é a API nativa do Chrome — move a aba (processo, DOM, histórico, formulário em andamento) para outra janela sem destruir/recriar nada. É a mesma operação que o Chrome executa internamente quando o usuário arrasta a aba manualmente entre janelas. Aceita array de `tabIds`, cobrindo também o caso de mover um lote selecionado. A mesma chamada resolve reorder dentro da mesma janela (mesmo `windowId`, `index` diferente).

Permissão: já coberta por `"tabs"` no manifest (já usado por `chrome.tabs.remove`).

## Estado atual do código (levantado antes de decidir)

- `chrome.tabs.move` **não é usado em nenhum lugar** do código hoje.
- DnD de abas vivas é HTML5 nativo custom (`src/newtab/lib/dragdrop.ts`, payloads `live-tab`/`live-window`/`live-tabs-batch`).
- `LiveWindowSection.svelte` e `LiveTabItem.svelte` só implementam `dragstart` — **não têm `ondrop`**. Quem trata drop de aba viva hoje é `GroupItem.svelte`/`UngroupedSection.svelte`, e só para "salvar num grupo" (grava no storage; com Alt fecha a aba original via `chrome.tabs.remove`).
- `src/shared/messaging.ts` já tem um `moveTab` no protocolo, mas é sobre abas **salvas** no storage interno — não sobre abas vivas do Chrome. Precisa de um tipo de mensagem novo e distinto.
- Canal de live update: `chrome.runtime.Port` (`LIVE_WINDOWS_PORT_NAME`), broadcast em `src/background/liveTabsBroadcast.ts` a cada evento `chrome.tabs.*`/`chrome.windows.*`. `chrome.tabs.move` dispara `onAttached`/`onDetached`/`onMoved`, que já fariam o broadcast re-renderizar a UI automaticamente — não precisa de lógica extra de refresh.

## O que falta implementar

1. Novo tipo de mensagem (ex. `MOVE_LIVE_TAB`) no protocolo `ArfyinMessage`, roteado no background para `chrome.tabs.move`.
2. Handler de `ondrop`/`ondragover` em `LiveWindowSection.svelte` aceitando payload `live-tab`/`live-tabs-batch` **de outra janela** (hoje só existe `dragstart`).
3. Cálculo de índice de destino a partir da posição exata do drop entre duas abas (indicador de linha de inserção, mesmo padrão visual já usado no reorder de grupos — ver ARF-022/027 e o commit `4c7b9f8`).
4. Reorder dentro da mesma janela: mesmo handler, mesma chamada, `windowId` igual ao de origem.

## Decisões de produto já tomadas (2026-11-27)

- **Posição no drop**: exata (soltar entre a aba X e Y define o índice), não "sempre no final". Reaproveita o padrão de linha de inserção já usado no reorder de grupos.
- **Tab Groups nativos do Chrome**: se a aba movida pertence a um grupo colorido nativo, ela sai do grupo ao mudar de janela — comportamento padrão do Chrome, sem lógica extra.
- **Última aba da janela**: mover a última aba de uma janela fecha a janela de origem (comportamento nativo do Chrome) — aceito como está, sem confirmação extra.

## Próximo passo

Virar SDD (`sdd/ARF-165-167-live-tab-move.md`) antes de implementar — ver card `ARF-165/166/167` no `kanban.md`.

## Validação ao vivo (QA, 2026-11-27) — correções e achados

- **Correção à afirmação da linha 17 acima**: `chrome.tabs.onMoved` (reorder PURO dentro da mesma janela, sem mudar de `windowId`) **não estava** entre os listeners de `liveTabsBroadcast.ts` — só `onAttached`/`onDetached` (cross-window) estavam cobertos. Bug real encontrado na validação ao vivo: reordenar uma aba dentro da mesma janela movia de fato (`chrome.tabs.move` funcionava), mas a UI não se atualizava sozinha (exigia reload manual). Corrigido adicionando `chrome.tabs.onMoved.addListener(...)` em `src/background/liveTabsBroadcast.ts`. Revalidado ao vivo após a correção: reorder dentro da mesma janela agora re-renderiza sozinho.
- **Aba pinned, confirmado ao vivo**: soltar uma aba não-pinned num índice que cairia dentro da faixa de abas pinned do destino (ex. índice 0 numa janela com 2 pinned) — o Chrome ajusta sozinho o índice final para logo **depois** do bloco de pinned (não lança erro, não torna a aba pinned, não fica intercalada entre pinned). Nenhum código extra necessário — comportamento nativo aceito, confirmado via `chrome.tabs.query` antes/depois num Chrome real (Playwright + extensão carregada via `--load-extension`).
- Cobertura e2e permanente adicionada em `tests/e2e/live-tab-move.spec.ts` (expansão do ARF-110), reproduzindo via `chrome.tabs.*` reais (não mock) todos os cenários do SDD, incluindo os dois achados acima.
