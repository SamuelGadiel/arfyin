<script lang="ts">
  import { store } from "../lib/store.svelte";
  import { readDragPayload } from "../lib/dragdrop";
  import { liveSelectionState } from "../lib/liveSelectionState.svelte";
  import TabItem from "./TabItem.svelte";
  import Icon from "./Icon.svelte";

  let isDragOver = $state(false);
  // "Sem grupo" nao e um Group de verdade (groupId null, nao existe no banco)
  // — nao ha onde persistir um `collapsed` para ele. Estado local e aceitavel
  // aqui: reseta a cada reload, sem exigir um campo de persistencia so para
  // este pseudo-grupo.
  let collapsed = $state(false);
  // Mesmo motivo do contador em GroupItem: evita o flicker de dragover/
  // dragleave disparado ao mover o cursor entre os filhos (TabItems) da lista.
  let dragDepth = 0;

  let style = $derived(store.config.tabManagerStyle);

  function openAll() {
    for (const tab of store.ungrouped) {
      chrome.tabs.create({ url: tab.url, active: false });
    }
  }

  function handleDragEnter(event: DragEvent) {
    event.preventDefault();
    dragDepth++;
    isDragOver = true;
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
  }

  function handleDragLeave() {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) isDragOver = false;
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    dragDepth = 0;
    isDragOver = false;
    const payload = readDragPayload(event);
    if (!payload) return;
    const shouldCloseOriginal = event.altKey;

    if (payload.kind === "saved-tab") {
      if (payload.sourceGroupId === null) return;
      store.moveTab(payload.tabId, null);
      return;
    }

    if (payload.kind === "live-tab") {
      store
        .addTab({ url: payload.url, title: payload.title, faviconUrl: payload.faviconUrl, groupId: null })
        .then(() => {
          if (shouldCloseOriginal) chrome.tabs.remove(payload.chromeTabId);
        });
      return;
    }

    if (payload.kind === "live-window") {
      store
        .addTabs(
          payload.tabs.map((tab) => ({
            url: tab.url,
            title: tab.title,
            faviconUrl: tab.faviconUrl,
            groupId: null,
          })),
        )
        .then(() => {
          if (shouldCloseOriginal) chrome.windows.remove(payload.windowId);
        });
      return;
    }

    if (payload.kind === "live-tabs-batch") {
      store
        .addTabs(
          payload.tabs.map((tab) => ({
            url: tab.url,
            title: tab.title,
            faviconUrl: tab.faviconUrl,
            groupId: null,
          })),
        )
        .then(() => {
          if (shouldCloseOriginal) payload.tabs.forEach((tab) => chrome.tabs.remove(tab.chromeTabId));
          liveSelectionState.disable();
        });
    }
  }
</script>

<section
  class="group"
  class:drag-over={isDragOver}
  style:background={style.containerColor}
  style:border-radius="{style.containerRadius}px"
  ondragenter={handleDragEnter}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
  role="group"
  aria-label="Sem categoria"
  title="Arraste uma aba aqui para salvá-la. Segure Option (⌥) ao soltar para fechar a aba original."
>
  <header class="group-header">
    <button
      class="collapse-toggle"
      onclick={() => (collapsed = !collapsed)}
      title={collapsed ? "Expandir" : "Colapsar"}
      aria-label={collapsed ? "Expandir Sem categoria" : "Colapsar Sem categoria"}
    >
      <Icon name={collapsed ? "chevron-down" : "chevron-up"} size={14} />
    </button>
    <span class="name">Sem categoria</span>
    <span class="count">{store.ungrouped.length}</span>
    <span class="spacer"></span>
    <button class="icon-button" onclick={openAll} title="Abrir todas as abas (sem foco)" aria-label="Abrir todas as abas sem foco">
      <Icon name="external-link" size={15} />
    </button>
  </header>

  {#if !collapsed}
    <div class="group-body" role="list">
      {#each store.ungrouped as tab (tab.id)}
        <TabItem {tab} />
      {/each}
      {#if store.ungrouped.length === 0}
        <p class="empty">Nenhuma aba solta.</p>
      {/if}
    </div>
  {/if}
</section>

<style>
  .group {
    border-left: 3px solid transparent;
    padding: 4px 10px 8px;
    margin-bottom: 12px;
  }
  .group.drag-over {
    /* Relatado como discreto demais — contorno mais grosso/opaco + um tingimento
       leve do fundo (box-shadow inset em vez de `background`, que já é usado
       pelo `style:background` inline do container e seria sobrescrito). */
    outline: 2px dashed rgba(234, 234, 234, 0.9);
    outline-offset: -2px;
    box-shadow: inset 0 0 0 9999px rgba(255, 255, 255, 0.06);
  }
  .group-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 600;
    padding: 6px 0;
  }
  .collapse-toggle {
    background: none;
    border: none;
    cursor: pointer;
    display: flex;
    opacity: 0.7;
  }
  .name {
    font-weight: 600;
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
    padding: 4px 0;
    min-height: 8px;
  }
  .empty {
    font-size: 12px;
    opacity: 0.4;
    padding: 4px 0;
  }
</style>
