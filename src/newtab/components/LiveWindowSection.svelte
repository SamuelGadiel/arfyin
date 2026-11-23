<script lang="ts">
  import { onMount } from "svelte";
  import type { LiveWindow } from "@/shared/types";
  import { store } from "../lib/store.svelte";
  import { setDragPayload } from "../lib/dragdrop";
  import { getWindowCollapsed, setWindowCollapsed } from "../lib/windowCollapseState";
  import LiveTabItem from "./LiveTabItem.svelte";
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

  onMount(() => {
    getWindowCollapsed(window.windowId).then((c) => (collapsed = c));
  });

  function toggleCollapsed() {
    collapsed = !collapsed;
    setWindowCollapsed(window.windowId, collapsed);
  }

  function handleDragStart(event: DragEvent) {
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
  }

  function closeWindow() {
    chrome.windows.remove(window.windowId);
  }
</script>

<section class="group" style:background={style.containerColor} style:border-radius="{style.containerRadius}px">
  <header class="group-header">
    <button
      class="collapse-toggle"
      onclick={toggleCollapsed}
      title={collapsed ? "Expandir" : "Colapsar"}
      aria-label={collapsed ? "Expandir janela" : "Colapsar janela"}
    >
      <Icon name={collapsed ? "chevron-down" : "chevron-up"} size={14} />
    </button>
    <h3
      class="name"
      draggable="true"
      ondragstart={handleDragStart}
      title="Arraste para salvar a janela inteira num grupo. Segure Command (⌘) ao soltar para fechar a janela original."
    >
      Janela {index + 1}
    </h3>
    <span class="count">{window.tabs.length}</span>
    <span class="spacer"></span>
    <button class="icon-button" onclick={() => (showCloseConfirm = true)} title="Fechar janela" aria-label="Fechar janela inteira">
      <Icon name="x" size={15} />
    </button>
  </header>

  {#if !collapsed}
    <div class="group-body" role="list">
      {#each window.tabs as tab (tab.chromeTabId)}
        <LiveTabItem {tab} />
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
  }
  .collapse-toggle {
    background: none;
    border: none;
    cursor: pointer;
    display: flex;
    opacity: 0.7;
  }
  .name {
    margin: 0;
    font: inherit;
    cursor: grab;
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
