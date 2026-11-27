# SDD — ARF-165/166/167: mover aba(s) viva(s) entre janelas + reorder dentro da janela

## Contexto
Tema C do `feature_ideas.md` (abas ao vivo), epic LIVE. Pedido direto do usuário (2026-11-27): fluxo manual real dele hoje é desmaximizar uma janela pra ver a outra por baixo e arrastar a aba entre elas, pra não perder estado de formulário/edição em andamento. Toda a análise técnica e as decisões de produto já estão fechadas em `docs/research/live-tab-move-cross-window.md` — este SDD não reabre nenhuma delas, só detalha a implementação:
- Posição no drop é **exata** (índice calculado pela posição entre duas abas), não "sempre no final".
- Aba sai do tab group nativo do Chrome ao mudar de janela — comportamento padrão do Chrome, sem lógica extra.
- Última aba de uma janela: movê-la fecha a janela de origem (comportamento nativo), sem confirmação.
- API: `chrome.tabs.move(tabIds, {windowId, index})` — já cobre aba única, lote selecionado e reorder dentro da mesma janela com a mesma chamada.

## Escopo

**Entra:**
1. Mover uma aba viva única para outra janela, soltando numa posição exata entre duas abas existentes (ou no início/fim).
2. Mover um lote selecionado (multi-seleção já existente via `liveSelectionState`) de abas vivas — de uma ou mais janelas de origem — para outra janela, numa posição exata.
3. Reorder de aba(s) viva(s) dentro da mesma janela (mesmo mecanismo, `windowId` de destino igual ao de origem).
4. Indicador visual de linha de inserção entre abas vivas, mesmo padrão de `GroupDropGap.svelte` (ARF-022/027) — componente novo `LiveTabDropGap.svelte`, pois hoje não existe equivalente a nível de aba (o `GroupDropGap` existente só reordena **grupos** entre si; o reorder de abas *salvas* dentro de um grupo usa outro mecanismo, sem linha de inserção — ver nota em "Design técnico").
5. Novo tipo de mensagem no protocolo (`MOVE_LIVE_TAB`) e handler no processo de background.

**NÃO entra (fora de escopo, YAGNI):**
- Reorder de **janelas** entre si (decisão já registrada: "janelas não têm posição entre si pra trocar").
- Qualquer lógica especial para tab groups nativos do Chrome (cor, nome) — comportamento 100% delegado ao Chrome.
- Modificador Alt/Option para "copiar em vez de mover" — não aplicável aqui. Esse modificador existe hoje em `GroupItem`/`UngroupedSection` porque ali a operação é "salvar no storage interno, opcionalmente fechando a aba original" (duplicação). Mover entre janelas **nunca** é uma duplicação — é a mesma aba, sempre. `event.altKey` é ignorado neste fluxo.
- Drop de `live-tab`/`live-tabs-batch` vindo de uma janela incógnito para uma normal (ou vice-versa) — ver "Casos de borda".
- Qualquer alteração em `GroupItem.svelte`/`UngroupedSection.svelte` (eles continuam tratando `live-tab`/`live-tabs-batch` exatamente como hoje, para "salvar num grupo").

## Critérios de aceite
- [x] Arrastar uma aba viva única de uma janela para outra e soltar entre duas abas existentes: a aba some da janela de origem e aparece exatamente naquela posição na janela de destino, **sem** fechar/reabrir (mesmo `chromeTabId`, mesmo processo/DOM/formulário em andamento).
- [x] Arrastar um lote selecionado (`liveSelectionState.active`) de abas vivas — podendo vir de janelas diferentes entre si — para uma janela de destino: todas chegam na posição de drop, na ordem em que estavam selecionadas; seleção é desativada (`liveSelectionState.disable()`) ao final, mesmo padrão já usado ao soltar um lote num grupo.
- [x] Arrastar uma aba viva (ou lote) para uma posição diferente **dentro da mesma janela**: reordena sem round-trip de fechar/reabrir. *(Validação ao vivo encontrou bug real: `onMoved` não estava escutado em `liveTabsBroadcast.ts`, UI não re-renderizava sozinha após reorder same-window apesar do move funcionar. Corrigido — ver REGISTRO.md 2026-11-27/QA.)*
- [x] Soltar exatamente na posição atual (no-op visual): nenhuma mudança perceptível, sem erro.
- [x] Mover a única aba de uma janela: a janela de origem fecha sozinha (comportamento nativo do Chrome), sem confirmação da extensão; a UI re-renderiza via o broadcast de `chrome.windows.onRemoved` já existente, sem código novo de refresh.
- [x] Aba que pertencia a um tab group nativo colorido: ao mudar de janela, sai do grupo (verificado ao vivo, comportamento padrão do Chrome).
- [x] Indicador de linha de inserção aparece só durante um drag de `live-tab`/`live-tabs-batch` (nunca durante drag de `group`/`saved-tab`/`live-window`), em qualquer `LiveWindowSection` da tela — inclusive na própria janela de origem (reorder) e em janelas diferentes.
- [x] `Alt`/`Option` no momento do drop não tem nenhum efeito neste fluxo (sempre move, nunca duplica).
- [x] Falha do `chrome.tabs.move` (ex.: tentativa entre incógnito/normal) não quebra a UI — erro logado no console, sem exceção não tratada. *(Validação ao vivo encontrou que nada era logado de fato — fire-and-forget sem `.then`. Corrigido — ver REGISTRO.md.)*
- [x] Validado no Chrome real: drag entre as 2 janelas reais do usuário, abas únicas e em lote, posição exata confirmada. *(Validado via Playwright + extensão carregada de verdade contra janelas/abas reais do Chrome, não mock — ambiente sem acesso a `chrome-devtools-mcp`/Full Disk Access do Chrome pessoal do usuário nesta sessão. Ver REGISTRO.md 2026-11-27/QA para o detalhe de cada critério.)*

## Design técnico

### 1. Protocolo de mensagens (`src/shared/messaging.ts`)
Novo tipo distinto do `MOVE_TAB` existente (que é sobre `SavedTab` no storage interno — não toca `chrome.tabs`):

```ts
export interface MoveLiveTabMessage {
  type: "MOVE_LIVE_TAB";
  tabIds: number[];   // chromeTabId(s) — 1 para aba única, N para lote
  windowId: number;   // janela de destino
  index: number;       // índice de destino dentro da janela, pós-remoção dos tabIds (ver função de cálculo abaixo)
}
```
Respostas novas na união `ArfyinResponse`:
```ts
| { type: "LIVE_TAB_MOVED" }
| { type: "LIVE_TAB_MOVE_FAILED"; error: string }
```
Adicionar `MOVE_LIVE_TAB: true` ao `MESSAGE_TYPES` (trava de compilação já existente).

### 2. Handler — por que **não** entra em `routeMessage` (`src/background/router.ts`)
`routeMessage(db, message)` é documentado e testado como **puro, sem `chrome.*`** (`tests/background/router.test.ts` roda com `fake-indexeddb`, zero mock de `chrome`). `MOVE_LIVE_TAB` não toca `db` nenhuma — é 100% `chrome.tabs.move`. Colocar a chamada dentro de `routeMessage` quebraria essa garantia de pureza/testabilidade documentada no próprio arquivo.

Decisão: tratar `MOVE_LIVE_TAB` como caso especial direto em `src/background/index.ts` (a "casca" que já é, por definição própria do arquivo, o único lugar que liga o protocolo ao `chrome.runtime` real) — **antes** de cair em `routeMessage`/`dbPromise`:

```ts
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isArfyinMessage(message)) return false;

  if (message.type === "MOVE_LIVE_TAB") {
    chrome.tabs
      .move(message.tabIds, { windowId: message.windowId, index: message.index })
      .then(() => sendResponse({ type: "LIVE_TAB_MOVED" }))
      .catch((err) =>
        sendResponse({ type: "LIVE_TAB_MOVE_FAILED", error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  }

  dbPromise.then((db) => routeMessage(db, message)).then(sendResponse);
  return true;
});
```
Sem enqueue de sync, sem `kickSync` — abas vivas nunca são dado sincronizado (só `SavedTab`/`Group`/`AppConfig` são). O refresh da UI acontece pelo canal já existente: `chrome.tabs.move` dispara `onAttached`/`onDetached`/`onMoved`, já escutados em `liveTabsBroadcast.ts`, que já faz `chrome.windows.getAll({populate:true})` e rebroadcast pra todas as `Port`s conectadas — **nenhuma mudança necessária em `liveTabsBroadcast.ts`**.

**Premissa assumida e registrada aqui** (não é ambígua o bastante pra travar a implementação, mas vale o registro): tecnicamente `chrome.tabs.move` poderia ser chamado direto da new-tab, sem mensagem nenhuma — é exatamente o padrão já usado por `LiveTabItem.svelte` hoje para `chrome.tabs.remove`/`chrome.tabs.update`/`chrome.windows.update`, e por `LiveWindowSection.svelte` para `chrome.windows.remove` (nenhum desses passa por `messaging.ts`). Este SDD segue a decisão já registrada em `docs/research/live-tab-move-cross-window.md` ("novo tipo de mensagem... roteado no background") em vez desse padrão mais simples, por ser a decisão documentada como já tomada. Caso vire fricção real (ex.: necessidade de testar a chamada sem Chrome real), considerar migrar para chamada direta — não bloqueia esta entrega.

### 3. Cálculo de índice de destino (função pura, testável)
Novo módulo `src/newtab/lib/liveTabDrop.ts`:
```ts
/**
 * `destWindowTabs`: lista atual (chrome.tabs real order) das abas da janela de
 * destino, ANTES da remoção. `gapIndex`: posição do gap onde foi solto (0 =
 * antes da 1a aba, length = depois da ultima). `draggedChromeTabIds`: os
 * chromeTabId(s) sendo movidos (1 ou N, podem ou nao pertencer a esta janela).
 *
 * Generaliza o ajuste de indice ja usado em GroupDropGap (`draggedPos < index
 * ? index - 1 : index`) para N abas e para o caso em que nenhuma delas esta
 * nesta janela (cross-window puro): cada aba arrastada que JA ESTA nesta
 * janela e aparece ANTES do gap sera removida antes da reinsercao, entao o
 * indice final cai em 1 pra cada uma. Abas que nao pertencem a esta janela
 * nao afetam a conta.
 */
export function computeLiveDropIndex(
  destWindowTabs: Pick<LiveTab, "chromeTabId">[],
  gapIndex: number,
  draggedChromeTabIds: readonly number[],
): number {
  const dragged = new Set(draggedChromeTabIds);
  let removedBefore = 0;
  for (let i = 0; i < gapIndex; i++) {
    if (dragged.has(destWindowTabs[i].chromeTabId)) removedBefore++;
  }
  return gapIndex - removedBefore;
}
```
Cobre os 3 casos do escopo com a mesma fórmula: cross-window puro (nenhum match, retorna `gapIndex` intacto), reorder same-window de 1 aba (igual à fórmula do `GroupDropGap`), e lote misto (soma só quem efetivamente está na janela de destino).

### 4. Estado de drag compartilhado (`src/newtab/lib/liveTabDragState.svelte.ts`, novo)
Necessário pelo mesmo motivo que `groupDragState` existe: `dataTransfer.getData()` não é legível durante `dragenter`/`dragover` no Chrome (só no `drop`), então o gap não pode decidir "devo iluminar?" lendo o payload — precisa de um estado auxiliar setado no `dragstart` de quem inicia o arraste.
```ts
class LiveTabDragState {
  draggingTabIds: number[] | null = $state(null);
}
export const liveTabDragState = new LiveTabDragState();
```
`LiveTabItem.svelte` passa a setar `liveTabDragState.draggingTabIds = [...]` no `handleDragStart` (tanto no branch de aba única quanto no de lote) e limpar (`= null`) num `ondragend` novo (hoje `LiveTabItem.svelte` **não tem** `ondragend` — precisa ser adicionado só para isto, mesmo padrão de `LiveWindowSection`/`GroupItem`).

### 5. `LiveTabDropGap.svelte` (novo componente)
Mesma estrutura/CSS de `GroupDropGap.svelte` (gap de 12px em repouso, 24px + linha de inserção de 3px quando ativo), adaptado:
```ts
interface Props {
  windowId: number;        // janela de destino (a desta LiveWindowSection)
  index: number;           // posição do gap (0..tabs.length)
  tabs: LiveTab[];         // window.tabs desta janela, para o calculo de indice
}
```
- `handleDragEnter`/`handleDragOver`: só reagem (`event.preventDefault()`, liga `isOver`) se `liveTabDragState.draggingTabIds` não for `null` — replicando o guard de `groupDragState.draggingGroupId` em `GroupDropGap`, garantindo que a linha nunca aparece durante drag de `group`/`saved-tab`/`live-window`.
- `handleDrop`: lê o payload de verdade (`readDragPayload`); aceita só `kind === "live-tab"` ou `kind === "live-tabs-batch"` (demais kinds: `return` sem efeito — inclusive `saved-tab`/`group`/`live-window`, que não fazem sentido soltos aqui). Monta `tabIds` (1 ou N, a partir do payload) e chama `computeLiveDropIndex(tabs, index, tabIds)`. Envia a mensagem:
```ts
chrome.runtime.sendMessage({ type: "MOVE_LIVE_TAB", tabIds, windowId, index: targetIndex });
if (payload.kind === "live-tabs-batch") liveSelectionState.disable();
```
`event.altKey` **não é lido** neste handler (diferente de `GroupItem`/`UngroupedSection`) — ver "Escopo", nunca há cópia aqui.

### 6. `LiveWindowSection.svelte`
No `.group-body`, intercalar um `LiveTabDropGap` antes do primeiro tab, entre cada par e depois do último (mesmo padrão de `TabManager.svelte` com `GroupDropGap`):
```svelte
<div class="group-body" role="list">
  <LiveTabDropGap windowId={window.windowId} index={0} tabs={window.tabs} />
  {#each window.tabs as tab, i (tab.chromeTabId)}
    <LiveTabItem {tab} />
    <LiveTabDropGap windowId={window.windowId} index={i + 1} tabs={window.tabs} />
  {/each}
</div>
```
Com `window.tabs.length === 0` (janela vazia, teoricamente impossível no Chrome real mas coberto por segurança), sobra só o gap `index={0}` — ainda assim um alvo de drop válido.

Fallback de robustez (mesmo espírito do fix do ARF-154 "drop sem item específico sob o cursor insere no fim"): o próprio `<section class="group">` ganha `ondragover`/`ondrop` que, se o drop não foi capturado por nenhum gap (bubbling chegou até a section), insere no fim (`index: window.tabs.length`). Evita "drop morto" se o usuário soltar exatamente sobre o corpo de um `LiveTabItem` (que não tem drop handler próprio) em vez de sobre um gap de 12px estreito.

### 7. Diagrama de fluxo
```
LiveTabItem.dragstart (seta liveTabDragState + setDragPayload live-tab|live-tabs-batch)
  → LiveTabDropGap (de QUALQUER LiveWindowSection, inclusive a de origem).dragenter/dragover
      (highlight só se liveTabDragState.draggingTabIds != null)
  → drop: readDragPayload → tabIds + computeLiveDropIndex(window.tabs, gapIndex, tabIds)
  → chrome.runtime.sendMessage({ type: "MOVE_LIVE_TAB", tabIds, windowId, index })
  → background/index.ts: chrome.tabs.move(tabIds, {windowId, index})
  → chrome dispara onAttached/onDetached/onMoved (e onRemoved se a janela de origem fechou)
  → liveTabsBroadcast.ts já escuta tudo isso → re-consulta chrome.windows.getAll({populate:true}) → Port.postMessage
  → todas as new-tabs abertas (inclusive a que iniciou o drag) re-renderizam via o $state existente
```

## Casos de borda
- **Soltar na mesma posição (no-op)**: `chrome.tabs.move` com `windowId`/`index` idênticos ao atual é tratado pelo próprio Chrome como no-op (sem erro, sem reordenação visível). Nenhum guard extra necessário no cliente — simplicidade sobre uma micro-otimização de evitar um broadcast redundante.
- **Última aba de uma janela**: ao mover, Chrome fecha a janela de origem sozinho — aceito como está (decisão já registrada). `onRemoved` já cobre o refresh da UI.
- **Aba pinned**: `LiveTab`/`toLiveWindows` não expõe `pinned` hoje — o índice calculado reflete a ordem real do `chrome.tabs` array (que já inclui pinned primeiro). Risco não eliminável sem validação ao vivo: se o usuário soltar uma aba não-pinned num índice que cairia "dentro" da faixa de abas pinned do destino, o comportamento exato de ajuste automático do Chrome não está 100% documentado publicamente — **validar ao vivo no Chrome real antes de considerar fechado**; se o Chrome ajustar sozinho para depois das pinned, nenhum código extra é necessário (comportamento nativo aceito, mesma lógica das demais exceções desta spec).
- **Aba em tab group nativo do Chrome**: ao mudar de janela, sai do grupo nativo (decisão já fechada, comportamento 100% do Chrome). Ao reordenar DENTRO da mesma janela para fora da faixa contígua do grupo nativo, o mesmo tipo de ejeção pode ocorrer — mesma categoria de comportamento nativo aceito, sem lógica extra.
- **Janela incógnito**: `chrome.tabs.move` não permite mover abas entre uma janela normal e uma incógnito (restrição de isolamento do próprio Chrome, não documentada com texto literal uniforme em todas as versões, mas é restrição conhecida e estável da API). Nesta extensão, o cenário só é alcançável se o usuário tiver habilitado manualmente "Permitir em modo anônimo" em `chrome://extensions` (não é o padrão). Tratamento: deixar o `.catch` do handler em `background/index.ts` capturar o erro nativo e responder `LIVE_TAB_MOVE_FAILED` — sem bloqueio preventivo de UI (YAGNI: cenário raro, a própria API já impede e o erro é só logado no console, sem crash).
- **Lote (`live-tabs-batch`) com abas de janelas de origem diferentes entre si**: suportado pela mesma chamada (`chrome.tabs.move` aceita `tabIds` de janelas distintas); `computeLiveDropIndex` só desconta da conta as que já pertenciam à janela de destino — as demais entram sem ajuste.
- **Drop de `saved-tab`/`group`/`live-window` num `LiveTabDropGap`**: ignorado silenciosamente (`return` sem side-effect) — esses kinds continuam só fazendo sentido nos destinos que já tratam (`GroupItem`, `UngroupedSection`, nada para `live-window` solto sobre outra janela).
- **Falha genérica do `chrome.tabs.move`** (tabId inexistente — aba fechada entre o dragstart e o drop, por exemplo): `.catch` responde `LIVE_TAB_MOVE_FAILED`; UI não trata essa resposta de forma especial (sem toast nesta rodada — YAGNI, mesma postura adotada noutros pontos do projeto para erros raros de borda), mas o erro fica visível no console via log do `sendResponse`/promise rejeitada se o chamador quiser investigar.

## Testes previstos
- **Unit (puro, sem `chrome.*`)**: `tests/newtab/liveTabDrop.test.ts` cobrindo `computeLiveDropIndex` — cross-window puro (nenhum ajuste), reorder same-window de 1 aba antes/depois da posição original, lote de N abas com posições intercaladas, lote misto (parte na janela de destino, parte de fora).
- **Unit**: `isArfyinMessage` reconhece `MOVE_LIVE_TAB` (extensão do teste existente em `tests/shared/messaging.test.ts`).
- **Sem teste automatizado de componente Svelte** para `LiveTabDropGap`/`LiveWindowSection` — mesmo trade-off já registrado no projeto (ARF-022/027, ARF-158/159): cobertura via validação manual ao vivo no Chrome real, não via testes de componente.
- **Validação ao vivo obrigatória** (consistente com o padrão de todo o epic LIVE): usando as janelas reais do usuário, mover 1 aba entre as duas janelas reais soltando numa posição específica (confirmar índice exato via `chrome.tabs.query` antes/depois); mover um lote de 2+ abas selecionadas; reordenar dentro da mesma janela; mover a única aba de uma janela de teste e confirmar que ela fecha sozinha; confirmar que uma aba de um tab group nativo sai do grupo ao mudar de janela; **confirmar explicitamente o comportamento do caso de borda "aba pinned"** (sinalizado em "Casos de borda") — soltar uma aba não-pinned num índice que caia dentro da faixa de abas pinned do destino, e documentar aqui/no `docs/research/live-tab-move-cross-window.md` o que o Chrome realmente faz, antes de mover o card para Done.

### Resultado da validação ao vivo (QA, 2026-11-27)

Executada via Playwright + extensão carregada de verdade contra janelas/abas reais do Chrome (não mock) — sem acesso a `chrome-devtools-mcp`/Full Disk Access do Chrome pessoal do usuário nesta sessão, ver REGISTRO.md para a justificativa completa do ambiente. Resultado: **2 bugs reais encontrados e corrigidos** (ver REGISTRO.md 2026-11-27/QA):
1. `liveTabsBroadcast.ts` não escutava `chrome.tabs.onMoved` — reorder same-window não re-renderizava sozinho.
2. Falha do `chrome.tabs.move` não logava nada no console (fire-and-forget sem `.then`).

**Aba pinned**: confirmado que o Chrome ajusta sozinho o índice de uma aba não-pinned solta dentro da faixa de pinned do destino, posicionando-a logo depois do bloco pinned — nenhum código extra necessário. Documentado em `docs/research/live-tab-move-cross-window.md`.

Cobertura e2e permanente adicionada em `tests/e2e/live-tab-move.spec.ts` (expansão do ARF-110), reexecutando todos os cenários acima com `chrome.tabs`/`chrome.windows` reais.
