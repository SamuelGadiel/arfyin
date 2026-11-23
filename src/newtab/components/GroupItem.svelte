<script lang="ts">
  import type { Group } from "@/shared/types";
  import { store } from "../lib/store.svelte";
  import { readDragPayload } from "../lib/dragdrop";
  import { liveSelectionState } from "../lib/liveSelectionState.svelte";
  import TabItem from "./TabItem.svelte";
  import Icon from "./Icon.svelte";
  import GroupDialog from "./GroupDialog.svelte";
  import ConfirmDialog from "./ConfirmDialog.svelte";

  interface Props {
    group: Group;
  }

  let { group }: Props = $props();

  let tabs = $derived(store.tabsByGroup[group.id] ?? []);
  let isDragOver = $state(false);
  let showEditDialog = $state(false);
  let showDeleteConfirm = $state(false);
  // Contador de profundidade em vez de um boolean setado a cada dragover: o
  // navegador dispara dragleave no pai sempre que o cursor entra num filho
  // (ex.: cada TabItem), seguido de um novo dragenter — sem isso a area de
  // drop pisca (liga/desliga) a cada pixel de movimento sobre os itens dentro
  // dela. So volta a `false` quando a profundidade chega a zero (saiu de
  // verdade do container, nao so trocou de filho por dentro).
  let dragDepth = 0;
  let style = $derived(store.config.tabManagerStyle);

  function toggleCollapsed() {
    store.setCollapsed(group.id, !group.collapsed);
  }

  async function saveEdit(name: string, color: string | null, icon: string | null) {
    if (name !== group.name) await store.renameGroup(group.id, name);
    if (color !== group.color || icon !== group.icon) await store.updateAppearance(group.id, color, icon);
  }

  function remove() {
    showDeleteConfirm = true;
  }

  function openAll() {
    for (const tab of tabs) {
      chrome.tabs.create({ url: tab.url, active: false });
    }
  }

  function indexForDrop(event: DragEvent): number {
    const target = (event.target as HTMLElement).closest("[data-tab-id]") as HTMLElement | null;
    if (!target) return tabs.length;
    const droppedTabId = target.dataset.tabId;
    const idx = tabs.findIndex((t) => t.id === droppedTabId);
    return idx === -1 ? tabs.length : idx;
  }

  function handleDragEnter(event: DragEvent) {
    event.preventDefault();
    dragDepth++;
    isDragOver = true;
  }

  function handleDragOver(event: DragEvent) {
    // Necessario para permitir o drop (sem isto o navegador recusa), mas nao
    // mexe no estado — so dragenter/dragleave controlam `isDragOver`.
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

    const index = indexForDrop(event);
    const shouldCloseOriginal = event.metaKey || event.ctrlKey;

    if (payload.kind === "saved-tab") {
      if (payload.sourceGroupId === group.id) {
        store.reorderTab(payload.tabId, index);
      } else {
        store.moveTab(payload.tabId, group.id, index);
      }
      return;
    }

    if (payload.kind === "live-tab") {
      store
        .addTab({ url: payload.url, title: payload.title, faviconUrl: payload.faviconUrl, groupId: group.id })
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
            groupId: group.id,
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
            groupId: group.id,
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
  style:border-left-color={group.color ?? "transparent"}
  ondragenter={handleDragEnter}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
  role="group"
  aria-label={group.name}
  title="Arraste uma aba aqui para salvá-la. Segure Command (⌘) ao soltar para fechar a aba original."
>
  <header class="group-header">
    <button
      class="collapse-toggle"
      onclick={toggleCollapsed}
      title={group.collapsed ? "Expandir" : "Colapsar"}
      aria-label={group.collapsed ? "Expandir grupo" : "Colapsar grupo"}
    >
      <Icon name={group.collapsed ? "chevron-down" : "chevron-up"} size={14} />
    </button>
    {#if group.icon}<span class="icon"><Icon name={group.icon} size={15} /></span>{/if}
    <button class="name" ondblclick={() => (showEditDialog = true)}>{group.name}</button>
    <span class="count">{tabs.length}</span>
    <span class="spacer"></span>
    <button class="icon-button" onclick={openAll} title="Abrir todas as abas (sem foco)" aria-label="Abrir todas as abas sem foco">
      <Icon name="external-link" size={15} />
    </button>
    <button class="icon-button" onclick={() => (showEditDialog = true)} title="Editar grupo" aria-label="Editar nome, cor e ícone do grupo">
      <Icon name="pencil" size={15} />
    </button>
    <button class="icon-button" onclick={remove} title="Apagar grupo" aria-label="Apagar grupo">
      <Icon name="trash" size={15} />
    </button>
  </header>

  {#if !group.collapsed}
    <div class="group-body" role="list">
      {#each tabs as tab (tab.id)}
        <TabItem {tab} />
      {/each}
      {#if tabs.length === 0}
        <p class="empty">Arraste abas para cá.</p>
      {/if}
    </div>
  {/if}
</section>

{#if showEditDialog}
  <GroupDialog
    initial={{ name: group.name, color: group.color, icon: group.icon }}
    onSave={saveEdit}
    onClose={() => (showEditDialog = false)}
  />
{/if}

{#if showDeleteConfirm}
  <ConfirmDialog
    title="Apagar grupo"
    message={`Apagar o grupo "${group.name}" e todas as suas abas salvas? Essa ação não pode ser desfeita.`}
    confirmLabel="Apagar"
    onConfirm={() => store.deleteGroup(group.id)}
    onClose={() => (showDeleteConfirm = false)}
  />
{/if}

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
  .icon {
    display: flex;
    opacity: 0.8;
  }
  .name {
    background: none;
    border: none;
    color: inherit;
    font: inherit;
    font-weight: 600;
    cursor: default;
    padding: 0;
    text-align: left;
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
