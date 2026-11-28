<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import type { LiveWindow } from "@/shared/types";
  import { store } from "../lib/store.svelte";
  import { liveSelectionState } from "../lib/liveSelectionState.svelte";
  import LiveWindowSection from "./LiveWindowSection.svelte";
  import ConfirmDialog from "./ConfirmDialog.svelte";
  import GroupDialog from "./GroupDialog.svelte";
  import Icon from "./Icon.svelte";

  const LIVE_WINDOWS_PORT_NAME = "live-windows";

  let windows: LiveWindow[] = $state([]);
  let port: chrome.runtime.Port | undefined;
  let showCloseSelectedConfirm = $state(false);
  let showCreateGroupDialog = $state(false);
  // Capturado no clique (event.altKey), guardado ate a confirmacao do
  // GroupDialog — mesma semantica ja usada no drag de lote pra GroupItem
  // (Alt decide se fecha as abas originais depois de adicionar ao grupo).
  let closeOriginalsOnCreate = $state(false);

  function toggleSelectionMode() {
    if (liveSelectionState.active) liveSelectionState.disable();
    else liveSelectionState.enable();
  }

  function closeSelected() {
    liveSelectionState.selected.forEach((tab) => chrome.tabs.remove(tab.chromeTabId));
    liveSelectionState.disable();
  }

  function requestCloseSelected() {
    if (store.config.confirmTabClose) {
      showCloseSelectedConfirm = true;
      return;
    }
    closeSelected();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && liveSelectionState.active) {
      liveSelectionState.disable();
    }
  }

  function openCreateGroupDialog(event: MouseEvent) {
    closeOriginalsOnCreate = event.altKey;
    showCreateGroupDialog = true;
  }

  // Captura a selecao ANTES de qualquer await — `store.addTabs` e sequencial
  // (um ADD_TAB por aba) e `liveSelectionState` pode ser desligado por fora
  // (Escape, outro clique) antes de terminar.
  async function createGroupFromSelection(name: string, color: string | null, icon: string | null) {
    const tabs = liveSelectionState.selected;
    const group = await store.createGroup(name);
    if (color !== null || icon !== null) await store.updateAppearance(group.id, color, icon);
    await store.addTabs(tabs.map((t) => ({ url: t.url, title: t.title, faviconUrl: t.faviconUrl, groupId: group.id })));
    if (closeOriginalsOnCreate) tabs.forEach((t) => chrome.tabs.remove(t.chromeTabId));
    liveSelectionState.disable();
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
        <button
          class="select-toggle"
          onclick={openCreateGroupDialog}
          title="Segure Option (⌥) ao clicar para fechar as abas originais depois de criar o grupo"
        >
          <Icon name="add" size={12} /> Criar grupo ({liveSelectionState.selected.length})
        </button>
        <button class="select-toggle danger" onclick={requestCloseSelected}>
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

{#if showCreateGroupDialog}
  <GroupDialog
    initialTabCount={liveSelectionState.selected.length}
    onSave={createGroupFromSelection}
    onClose={() => (showCreateGroupDialog = false)}
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
