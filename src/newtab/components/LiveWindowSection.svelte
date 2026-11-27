<script lang="ts">
  import { onMount } from "svelte";
  import type { LiveWindow } from "@/shared/types";
  import { store } from "../lib/store.svelte";
  import { setDragPayload, readDragPayload } from "../lib/dragdrop";
  import { getWindowCollapsed, setWindowCollapsed } from "../lib/windowCollapseState";
  import { liveTabDragState } from "../lib/liveTabDragState.svelte";
  import { liveSelectionState } from "../lib/liveSelectionState.svelte";
  import { computeLiveDropIndex } from "../lib/liveTabDrop";
  import LiveTabItem from "./LiveTabItem.svelte";
  import LiveTabDropGap from "./LiveTabDropGap.svelte";
  import Icon from "./Icon.svelte";
  import ConfirmDialog from "./ConfirmDialog.svelte";

  interface Props {
    window: LiveWindow;
    index: number;
  }

  let { window, index }: Props = $props();
  let style = $derived(store.config.tabManagerStyle);
  let collapsed = $state(false);
  let showCloseConfirm = $state(false);
  // So controla o cursor (grabbing) deste proprio header durante o arraste —
  // diferente do reorder de grupos, janelas nao tem gap entre si nem outros
  // headers precisam saber disso, entao nao precisa de estado compartilhado.
  let isDragging = $state(false);

  onMount(() => {
    getWindowCollapsed(window.windowId).then((c) => (collapsed = c));
  });

  function toggleCollapsed() {
    collapsed = !collapsed;
    setWindowCollapsed(window.windowId, collapsed);
  }

  // Mesmo padrao do GroupItem: clona a section inteira pra um ghost fiel
  // (borda arredondada, cor, tamanho), em vez do snapshot nativo que so
  // capturaria a area do header.
  function setWindowDragGhostImage(event: DragEvent, sectionEl: HTMLElement) {
    const rect = sectionEl.getBoundingClientRect();
    const clone = sectionEl.cloneNode(true) as HTMLElement;
    Object.assign(clone.style, {
      position: "fixed",
      top: "-2000px",
      left: "-2000px",
      width: `${rect.width}px`,
      margin: "0",
      pointerEvents: "none",
      boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
    });
    document.body.appendChild(clone);

    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    event.dataTransfer?.setDragImage(clone, offsetX, offsetY);
    setTimeout(() => clone.remove(), 0);
  }

  function handleDragStart(event: DragEvent) {
    isDragging = true;
    setDragPayload(event, {
      kind: "live-window",
      windowId: window.windowId,
      tabs: window.tabs.map(({ chromeTabId, windowId, url, title, faviconUrl }) => ({
        chromeTabId,
        windowId,
        url,
        title,
        faviconUrl,
      })),
    });
    // Sem override de effectAllowed aqui (fica "all", o generico de
    // setDragPayload): diferente do reorder de grupo, aqui o Option (⌥)
    // precisa continuar funcionando de verdade pra fechar a janela original
    // ao salvar — restringir pra "move" quebraria esse fluxo de novo.

    const sectionEl = (event.currentTarget as HTMLElement).closest(".group") as HTMLElement;
    setWindowDragGhostImage(event, sectionEl);
  }

  function handleDragEnd() {
    isDragging = false;
  }

  function closeWindow() {
    chrome.windows.remove(window.windowId);
  }

  // Fallback de robustez (mesmo espirito do fix do ARF-154 "drop sem item
  // especifico sob o cursor insere no fim"): se o drop nao foi capturado por
  // nenhum LiveTabDropGap (bubbling chegou ate a section — ex. solto sobre o
  // corpo de um LiveTabItem, que nao tem drop handler proprio), insere no fim.
  function handleSectionDragOver(event: DragEvent) {
    if (!liveTabDragState.draggingTabIds) return;
    event.preventDefault();
  }

  function handleSectionDrop(event: DragEvent) {
    if (!liveTabDragState.draggingTabIds) return;
    event.preventDefault();
    const payload = readDragPayload(event);
    if (!payload) return;
    if (payload.kind !== "live-tab" && payload.kind !== "live-tabs-batch") return;

    const tabIds =
      payload.kind === "live-tab" ? [payload.chromeTabId] : payload.tabs.map((t) => t.chromeTabId);
    const targetIndex = computeLiveDropIndex(window.tabs, window.tabs.length, tabIds);
    // Mesmo motivo do LiveTabDropGap: sendResponse sempre resolve (nunca
    // rejeita), sem este .then uma falha real nunca apareceria no console.
    chrome.runtime
      .sendMessage({ type: "MOVE_LIVE_TAB", tabIds, windowId: window.windowId, index: targetIndex })
      .then((res) => {
        if (res?.type === "LIVE_TAB_MOVE_FAILED") console.error("[arfyin] MOVE_LIVE_TAB falhou:", res.error);
      });
    if (payload.kind === "live-tabs-batch") liveSelectionState.disable();
  }
</script>

<section
  class="group"
  style:background={style.containerColor}
  style:border-radius="{style.containerRadius}px"
  ondragover={handleSectionDragOver}
  ondrop={handleSectionDrop}
  role="group"
  aria-label={`Janela ${index + 1}`}
>
  <header
    class="group-header"
    class:dragging={isDragging}
    draggable="true"
    ondragstart={handleDragStart}
    ondragend={handleDragEnd}
    onclick={toggleCollapsed}
    onkeydown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleCollapsed();
      }
    }}
    tabindex="0"
    role="button"
    title="Clique para colapsar/expandir. Arraste para salvar a janela inteira num grupo. Segure Option (⌥) ao soltar para fechar a janela original."
    aria-label={`Janela ${index + 1} — clique para colapsar ou expandir, arraste para salvar num grupo`}
  >
    <span class="collapse-toggle">
      <Icon name={collapsed ? "chevron-down" : "chevron-up"} size={14} />
    </span>
    <h3 class="name">
      Janela {index + 1}
    </h3>
    <span class="count">{window.tabs.length}</span>
    <span class="spacer"></span>
    <button
      class="icon-button"
      onclick={(e) => {
        e.stopPropagation();
        showCloseConfirm = true;
      }}
      title="Fechar janela"
      aria-label="Fechar janela inteira"
    >
      <Icon name="x" size={15} />
    </button>
  </header>

  {#if !collapsed}
    <div class="group-body" role="list">
      <LiveTabDropGap windowId={window.windowId} index={0} tabs={window.tabs} />
      {#each window.tabs as tab, i (tab.chromeTabId)}
        <LiveTabItem {tab} />
        <LiveTabDropGap windowId={window.windowId} index={i + 1} tabs={window.tabs} />
      {/each}
    </div>
  {/if}
</section>

{#if showCloseConfirm}
  <ConfirmDialog
    title="Fechar janela"
    message={`Fechar a Janela ${index + 1} com ${window.tabs.length} aba(s)? As abas não salvas num grupo serão perdidas.`}
    confirmLabel="Fechar janela"
    onConfirm={closeWindow}
    onClose={() => (showCloseConfirm = false)}
  />
{/if}

<style>
  .group {
    border-left: 3px solid transparent;
    padding: 4px 10px 8px;
    margin-bottom: 12px;
  }
  .group-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 600;
    padding: 6px 0;
    cursor: auto;
  }
  .group-header.dragging {
    cursor: grabbing;
  }
  .collapse-toggle {
    display: flex;
    opacity: 0.7;
    cursor: pointer;
  }
  .name {
    margin: 0;
    font: inherit;
    cursor: inherit;
  }
  .count {
    font-size: 11px;
    opacity: 0.5;
    font-weight: 400;
  }
  .spacer {
    flex: 1;
  }
  .icon-button {
    background: none;
    border: none;
    cursor: pointer;
    opacity: 0.5;
    display: flex;
    padding: 4px;
  }
  .icon-button:hover {
    opacity: 1;
  }
  .group-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 4px 0;
    min-height: 8px;
  }
</style>
