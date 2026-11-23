<script lang="ts">
  import type { LiveTab } from "@/shared/types";
  import { store } from "../lib/store.svelte";
  import { setDragPayload } from "../lib/dragdrop";
  import { liveSelectionState } from "../lib/liveSelectionState.svelte";
  import Icon from "./Icon.svelte";
  import ConfirmDialog from "./ConfirmDialog.svelte";

  interface Props {
    tab: LiveTab;
  }

  let { tab }: Props = $props();
  let selected = $derived(liveSelectionState.isSelected(tab.chromeTabId));
  let showCloseConfirm = $state(false);

  function toOmitKind(t: LiveTab) {
    return { chromeTabId: t.chromeTabId, windowId: t.windowId, url: t.url, title: t.title, faviconUrl: t.faviconUrl };
  }

  // Sem isto, o navegador usa como imagem de arraste um snapshot do proprio
  // elemento clicado — ao arrastar uma selecao de varias abas, visualmente
  // parecia que so UMA estava sendo arrastada (o drop em si ja aplicava as N
  // corretamente, so o feedback visual durante o arraste estava errado).
  // Pedido do usuario: nao um texto generico ("N abas selecionadas"), e sim
  // mostrar de fato as abas sendo levadas — igual ao que acontece ao arrastar
  // um unico item. Limita a MAX_ROWS linhas (+ "e mais N" depois disso) pra
  // nao criar um cartao gigante quando a selecao tem dezenas de abas.
  const MAX_GHOST_ROWS = 6;

  function setBatchDragImage(event: DragEvent, tabs: ReturnType<typeof toOmitKind>[]): void {
    const ghost = document.createElement("div");
    Object.assign(ghost.style, {
      position: "fixed",
      top: "-1000px",
      left: "-1000px",
      display: "flex",
      flexDirection: "column",
      gap: "2px",
      padding: "6px",
      background: "rgba(30, 30, 30, 0.95)",
      borderRadius: "8px",
      fontFamily: "inherit",
      pointerEvents: "none",
      width: "240px",
    });

    const visible = tabs.slice(0, MAX_GHOST_ROWS);
    for (const t of visible) {
      const row = document.createElement("div");
      Object.assign(row.style, { display: "flex", alignItems: "center", gap: "6px", minWidth: "0" });
      if (t.faviconUrl) {
        const img = document.createElement("img");
        img.src = t.faviconUrl;
        Object.assign(img.style, { width: "16px", height: "16px", flexShrink: "0" });
        row.appendChild(img);
      } else {
        const placeholder = document.createElement("span");
        Object.assign(placeholder.style, {
          width: "16px",
          height: "16px",
          flexShrink: "0",
          background: "rgba(255, 255, 255, 0.2)",
          borderRadius: "3px",
        });
        row.appendChild(placeholder);
      }
      const label = document.createElement("span");
      label.textContent = t.title;
      Object.assign(label.style, {
        color: "#eaeaea",
        fontSize: "12px",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        minWidth: "0",
      });
      row.appendChild(label);
      ghost.appendChild(row);
    }
    if (tabs.length > MAX_GHOST_ROWS) {
      const more = document.createElement("div");
      more.textContent = `e mais ${tabs.length - MAX_GHOST_ROWS}…`;
      Object.assign(more.style, { color: "#eaeaea", opacity: "0.6", fontSize: "11px", padding: "2px 22px" });
      ghost.appendChild(more);
    }

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
      setBatchDragImage(event, tabs);
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

  function doCloseTab() {
    chrome.tabs.remove(tab.chromeTabId);
  }

  function closeTab(event: MouseEvent) {
    event.stopPropagation();
    if (store.config.confirmTabClose) {
      showCloseConfirm = true;
      return;
    }
    doCloseTab();
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

{#if showCloseConfirm}
  <ConfirmDialog
    title="Fechar aba"
    message={`Fechar "${tab.title}"? Se não estiver salva num grupo, será perdida.`}
    confirmLabel="Fechar aba"
    onConfirm={doCloseTab}
    onClose={() => (showCloseConfirm = false)}
  />
{/if}

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
