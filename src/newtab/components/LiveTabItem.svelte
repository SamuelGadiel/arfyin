<script lang="ts">
  import type { LiveTab } from "@/shared/types";
  import { setDragPayload } from "../lib/dragdrop";
  import { liveSelectionState } from "../lib/liveSelectionState.svelte";
  import Icon from "./Icon.svelte";

  interface Props {
    tab: LiveTab;
  }

  let { tab }: Props = $props();
  let selected = $derived(liveSelectionState.isSelected(tab.chromeTabId));

  function toOmitKind(t: LiveTab) {
    return { chromeTabId: t.chromeTabId, windowId: t.windowId, url: t.url, title: t.title, faviconUrl: t.faviconUrl };
  }

  // Sem isto, o navegador usa como imagem de arraste um snapshot do proprio
  // elemento clicado — ao arrastar uma selecao de varias abas, visualmente
  // parecia que so UMA estava sendo arrastada (o drop em si ja aplicava as N
  // corretamente, so o feedback visual durante o arraste estava errado).
  function setBatchDragImage(event: DragEvent, count: number): void {
    const ghost = document.createElement("div");
    ghost.textContent = `${count} abas selecionadas`;
    Object.assign(ghost.style, {
      position: "fixed",
      top: "-1000px",
      left: "-1000px",
      padding: "6px 12px",
      background: "rgba(30, 30, 30, 0.95)",
      color: "#eaeaea",
      borderRadius: "6px",
      fontSize: "12px",
      fontFamily: "inherit",
      whiteSpace: "nowrap",
      pointerEvents: "none",
    });
    document.body.appendChild(ghost);
    event.dataTransfer?.setDragImage(ghost, 10, 10);
    setTimeout(() => ghost.remove(), 0);
  }

  function handleDragStart(event: DragEvent) {
    // No modo de selecao, arrastar uma aba que faz parte da selecao arrasta
    // TODAS as selecionadas de uma vez — e exatamente o pedido do usuario
    // ("seleciona todos que quer, depois arrasta tudo de uma vez").
    if (liveSelectionState.active && selected && liveSelectionState.selected.length > 1) {
      const tabs = liveSelectionState.selected.map(toOmitKind);
      setDragPayload(event, { kind: "live-tabs-batch", tabs });
      setBatchDragImage(event, tabs.length);
      return;
    }
    setDragPayload(event, { kind: "live-tab", ...toOmitKind(tab) });
  }

  function handleClick() {
    if (liveSelectionState.active) {
      liveSelectionState.toggle(tab);
      return;
    }
    chrome.tabs.update(tab.chromeTabId, { active: true });
    chrome.windows.update(tab.windowId, { focused: true });
  }

  function closeTab(event: MouseEvent) {
    event.stopPropagation();
    chrome.tabs.remove(tab.chromeTabId);
  }
</script>

<div class="live-tab" class:selected draggable="true" ondragstart={handleDragStart} role="listitem">
  <button class="tab-link" onclick={handleClick} title={tab.url}>
    {#if liveSelectionState.active}
      <span class="checkbox"><Icon name={selected ? "square-check" : "square"} size={18} /></span>
    {/if}
    {#if tab.faviconUrl}
      <img src={tab.faviconUrl} alt="" class="favicon" />
    {:else}
      <span class="favicon favicon-placeholder"></span>
    {/if}
    <span class="title">{tab.title}</span>
  </button>
  {#if !liveSelectionState.active}
    <button class="icon-button remove-button" onclick={closeTab} title="Fechar aba" aria-label="Fechar aba">
      <Icon name="x" size={14} />
    </button>
  {/if}
</div>

<style>
  .live-tab {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 24px;
    padding: 4px 6px;
    border-radius: 6px;
  }
  .live-tab:hover,
  .live-tab.selected {
    background: rgba(255, 255, 255, 0.08);
  }
  .tab-link {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    min-width: 0;
    background: none;
    border: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
    padding: 0;
  }
  .checkbox {
    display: flex;
    flex-shrink: 0;
    opacity: 0.85;
  }
  .icon-button {
    background: none;
    border: none;
    cursor: pointer;
    display: flex;
    padding: 4px;
    flex-shrink: 0;
  }
  .remove-button {
    opacity: 0;
  }
  .live-tab:hover .remove-button {
    opacity: 0.5;
  }
  .remove-button:hover {
    opacity: 1;
  }
  .favicon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }
  .favicon-placeholder {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }
  .title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
  }
</style>
