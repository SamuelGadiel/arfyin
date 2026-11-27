<script lang="ts">
  import type { LiveTab } from "@/shared/types";
  import { readDragPayload } from "../lib/dragdrop";
  import { liveTabDragState } from "../lib/liveTabDragState.svelte";
  import { liveSelectionState } from "../lib/liveSelectionState.svelte";
  import { computeLiveDropIndex } from "../lib/liveTabDrop";

  interface Props {
    /** Janela de destino (a desta LiveWindowSection). */
    windowId: number;
    /** Posicao deste gap entre as abas ordenadas — 0 = antes da primeira, length = depois da ultima. */
    index: number;
    /** `window.tabs` desta janela, para o calculo de indice. */
    tabs: LiveTab[];
  }

  let { windowId, index, tabs }: Props = $props();
  let isOver = $state(false);

  function handleDragEnter(event: DragEvent) {
    if (!liveTabDragState.draggingTabIds) return;
    event.preventDefault();
    isOver = true;
  }

  function handleDragOver(event: DragEvent) {
    if (!liveTabDragState.draggingTabIds) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  }

  function handleDragLeave() {
    isOver = false;
  }

  function handleDrop(event: DragEvent) {
    if (!liveTabDragState.draggingTabIds) return;
    event.preventDefault();
    // Impede o fallback de "drop sem gap especifico insere no fim" (na
    // `<section>` de LiveWindowSection) de tambem disparar para este MESMO
    // drop — `drop` borbulha por padrao, e sem isto a mensagem seria enviada
    // duas vezes (uma com o indice certo, outra com index=tabs.length).
    event.stopPropagation();
    isOver = false;
    const payload = readDragPayload(event);
    if (!payload) return;
    if (payload.kind !== "live-tab" && payload.kind !== "live-tabs-batch") return;

    const tabIds =
      payload.kind === "live-tab" ? [payload.chromeTabId] : payload.tabs.map((t) => t.chromeTabId);
    const targetIndex = computeLiveDropIndex(tabs, index, tabIds);
    // Fire-and-forget, mas o erro precisa ficar visivel no console (criterio
    // de aceite explicito do SDD) -- sendResponse sempre RESOLVE (nunca
    // rejeita), entao sem este .then nada seria logado, mesmo numa falha real
    // (ex.: aba fechada entre o dragstart e o drop).
    chrome.runtime.sendMessage({ type: "MOVE_LIVE_TAB", tabIds, windowId, index: targetIndex }).then((res) => {
      if (res?.type === "LIVE_TAB_MOVE_FAILED") console.error("[arfyin] MOVE_LIVE_TAB falhou:", res.error);
    });
    if (payload.kind === "live-tabs-batch") liveSelectionState.disable();
  }
</script>

<div
  class="tab-gap"
  class:active={!!liveTabDragState.draggingTabIds}
  class:over={isOver}
  role="separator"
  aria-label="Soltar aqui para mover a aba"
  ondragenter={handleDragEnter}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
></div>

<style>
  .tab-gap {
    height: 12px;
  }
  .tab-gap.active {
    height: 24px;
    margin: -6px 0;
    position: relative;
    z-index: 1;
  }
  .tab-gap.active.over::before {
    content: "";
    position: absolute;
    left: 4px;
    right: 4px;
    top: 50%;
    transform: translateY(-50%);
    height: 3px;
    border-radius: 2px;
    background: rgba(234, 234, 234, 0.9);
  }
</style>
