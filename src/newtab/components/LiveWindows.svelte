<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import type { LiveWindow } from "@/shared/types";
  import { liveSelectionState } from "../lib/liveSelectionState.svelte";
  import LiveWindowSection from "./LiveWindowSection.svelte";
  import ConfirmDialog from "./ConfirmDialog.svelte";
  import Icon from "./Icon.svelte";

  const LIVE_WINDOWS_PORT_NAME = "live-windows";

  let windows: LiveWindow[] = $state([]);
  let port: chrome.runtime.Port | undefined;
  let showCloseSelectedConfirm = $state(false);

  function toggleSelectionMode() {
    if (liveSelectionState.active) liveSelectionState.disable();
    else liveSelectionState.enable();
  }

  function closeSelected() {
    liveSelectionState.selected.forEach((tab) => chrome.tabs.remove(tab.chromeTabId));
    liveSelectionState.disable();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && liveSelectionState.active) {
      liveSelectionState.disable();
    }
  }

  onMount(() => {
    port = chrome.runtime.connect({ name: LIVE_WINDOWS_PORT_NAME });
    port.onMessage.addListener((message: { type: string; windows?: LiveWindow[] }) => {
      if (message.type === "LIVE_WINDOWS" && message.windows) {
        windows = message.windows;
      }
    });
  });

  onDestroy(() => {
    port?.disconnect();
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<section class="live-windows">
  <div class="heading-row">
    <h2>Abas abertas</h2>
    <div class="heading-actions">
      {#if liveSelectionState.active && liveSelectionState.selected.length > 0}
        <button class="select-toggle danger" onclick={() => (showCloseSelectedConfirm = true)}>
          <Icon name="x" size={12} /> Fechar selecionadas ({liveSelectionState.selected.length})
        </button>
      {/if}
      <button class="select-toggle" onclick={toggleSelectionMode}>
        {liveSelectionState.active ? "Cancelar seleção" : "Selecionar"}
      </button>
    </div>
  </div>
  {#each windows as window, index (window.windowId)}
    <LiveWindowSection {window} {index} />
  {/each}
  {#if windows.length === 0}
    <p class="empty">Nenhuma janela aberta.</p>
  {/if}
</section>

{#if showCloseSelectedConfirm}
  <ConfirmDialog
    title="Fechar abas selecionadas"
    message={`Fechar ${liveSelectionState.selected.length} aba(s) selecionada(s)? As que não estiverem salvas num grupo serão perdidas.`}
    confirmLabel="Fechar abas"
    onConfirm={closeSelected}
    onClose={() => (showCloseSelectedConfirm = false)}
  />
{/if}

<style>
  .heading-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 0 0 8px;
    padding: 0 6px;
  }
  .live-windows h2 {
    font-size: 12px;
    text-transform: uppercase;
    opacity: 0.5;
    margin: 0;
  }
  .heading-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .select-toggle {
    display: flex;
    align-items: center;
    gap: 4px;
    background: none;
    border: none;
    color: inherit;
    opacity: 0.6;
    cursor: pointer;
    font-size: 11px;
    padding: 2px 4px;
  }
  .select-toggle:hover {
    opacity: 1;
  }
  .select-toggle.danger {
    color: #ff8a8a;
    opacity: 0.85;
  }
  .select-toggle.danger:hover {
    opacity: 1;
  }
  .empty {
    font-size: 12px;
    opacity: 0.4;
  }
</style>
