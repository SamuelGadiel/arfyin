<script lang="ts">
  import type { Group } from "@/shared/types";
  import { store } from "../lib/store.svelte";
  import { readDragPayload } from "../lib/dragdrop";
  import TabItem from "./TabItem.svelte";

  interface Props {
    group: Group;
  }

  let { group }: Props = $props();

  let tabs = $derived(store.tabsByGroup[group.id] ?? []);
  let isDragOver = $state(false);

  function toggleCollapsed() {
    store.setCollapsed(group.id, !group.collapsed);
  }

  function rename() {
    const name = prompt("Novo nome do grupo:", group.name);
    if (name && name.trim()) store.renameGroup(group.id, name.trim());
  }

  function editAppearance() {
    const color = prompt("Cor do grupo (ex: #ff6b6b, vazio para remover):", group.color ?? "");
    const icon = prompt("Ícone do grupo (um emoji, vazio para remover):", group.icon ?? "");
    store.updateAppearance(group.id, color?.trim() || null, icon?.trim() || null);
  }

  function remove() {
    if (confirm(`Apagar o grupo "${group.name}" e todas as suas abas salvas?`)) {
      store.deleteGroup(group.id);
    }
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

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    isDragOver = true;
  }

  function handleDragLeave() {
    isDragOver = false;
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    isDragOver = false;
    const payload = readDragPayload(event);
    if (!payload) return;

    const index = indexForDrop(event);
    const shouldCloseOriginal = event.altKey;

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
    }
  }
</script>

<section class="group" style:border-left-color={group.color ?? "transparent"}>
  <header class="group-header">
    <button class="collapse-toggle" onclick={toggleCollapsed} title={group.collapsed ? "Expandir" : "Colapsar"}>
      {group.collapsed ? "▶" : "▼"}
    </button>
    {#if group.icon}<span class="icon">{group.icon}</span>{/if}
    <button class="name" ondblclick={rename}>{group.name}</button>
    <span class="count">{tabs.length}</span>
    <span class="spacer"></span>
    <button class="icon-button" onclick={openAll} title="Abrir todas as abas (sem foco)">⇱</button>
    <button class="icon-button" onclick={editAppearance} title="Cor/ícone">🎨</button>
    <button class="icon-button" onclick={remove} title="Apagar grupo">🗑</button>
  </header>

  {#if !group.collapsed}
    <div
      class="group-body"
      class:drag-over={isDragOver}
      ondragover={handleDragOver}
      ondragleave={handleDragLeave}
      ondrop={handleDrop}
      role="list"
    >
      {#each tabs as tab (tab.id)}
        <TabItem {tab} />
      {/each}
      {#if tabs.length === 0}
        <p class="empty">Arraste abas para cá.</p>
      {/if}
    </div>
  {/if}
</section>

<style>
  .group {
    border-left: 3px solid transparent;
    padding-left: 8px;
    margin-bottom: 8px;
  }
  .group-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 600;
  }
  .collapse-toggle {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 10px;
    opacity: 0.7;
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
    font-size: 13px;
  }
  .icon-button:hover {
    opacity: 1;
  }
  .group-body {
    padding: 4px 0 4px 18px;
    min-height: 8px;
    border-radius: 6px;
  }
  .group-body.drag-over {
    background: rgba(255, 255, 255, 0.06);
    outline: 1px dashed rgba(255, 255, 255, 0.3);
  }
  .empty {
    font-size: 12px;
    opacity: 0.4;
    padding: 4px 0;
  }
</style>
