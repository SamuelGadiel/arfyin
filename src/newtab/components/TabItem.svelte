<script lang="ts">
  import type { SavedTab } from "@/shared/types";
  import { store } from "../lib/store.svelte";
  import { setDragPayload } from "../lib/dragdrop";

  interface Props {
    tab: SavedTab;
  }

  let { tab }: Props = $props();

  function open(event: MouseEvent) {
    event.preventDefault();
    chrome.tabs.create({ url: tab.url, active: !event.metaKey && !event.ctrlKey });
  }

  function handleDragStart(event: DragEvent) {
    setDragPayload(event, { kind: "saved-tab", tabId: tab.id, sourceGroupId: tab.groupId });
  }

  function togglePin(event: MouseEvent) {
    event.stopPropagation();
    store.setPinned(tab.id, !tab.pinned);
  }

  function remove(event: MouseEvent) {
    event.stopPropagation();
    store.removeTab(tab.id);
  }
</script>

<div
  class="tab-item"
  draggable="true"
  ondragstart={handleDragStart}
  data-tab-id={tab.id}
  role="listitem"
>
  <a href={tab.url} onclick={open} class="tab-link" title={tab.url}>
    {#if tab.faviconUrl}
      <img src={tab.faviconUrl} alt="" class="favicon" />
    {:else}
      <span class="favicon favicon-placeholder"></span>
    {/if}
    <span class="title">{tab.title}</span>
  </a>
  <button class="icon-button" class:active={tab.pinned} onclick={togglePin} title="Fixar aba">
    📌
  </button>
  <button class="icon-button" onclick={remove} title="Remover">✕</button>
</div>

<style>
  .tab-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 6px;
    border-radius: 6px;
  }
  .tab-item:hover {
    background: rgba(255, 255, 255, 0.08);
  }
  .tab-link {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    min-width: 0;
    color: inherit;
    text-decoration: none;
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
  .icon-button {
    background: none;
    border: none;
    cursor: pointer;
    opacity: 0.5;
    font-size: 12px;
  }
  .icon-button:hover,
  .icon-button.active {
    opacity: 1;
  }
</style>
