<script lang="ts">
  import type { LiveTab } from "@/shared/types";
  import { setDragPayload } from "../lib/dragdrop";

  interface Props {
    tab: LiveTab;
  }

  let { tab }: Props = $props();

  function handleDragStart(event: DragEvent) {
    setDragPayload(event, {
      kind: "live-tab",
      chromeTabId: tab.chromeTabId,
      windowId: tab.windowId,
      url: tab.url,
      title: tab.title,
      faviconUrl: tab.faviconUrl,
    });
  }

  function focus() {
    chrome.tabs.update(tab.chromeTabId, { active: true });
    chrome.windows.update(tab.windowId, { focused: true });
  }
</script>

<div class="live-tab" draggable="true" ondragstart={handleDragStart} role="listitem">
  <button class="tab-link" onclick={focus} title={tab.url}>
    {#if tab.faviconUrl}
      <img src={tab.faviconUrl} alt="" class="favicon" />
    {:else}
      <span class="favicon favicon-placeholder"></span>
    {/if}
    <span class="title">{tab.title}</span>
  </button>
</div>

<style>
  .live-tab {
    padding: 2px 4px;
    border-radius: 6px;
  }
  .live-tab:hover {
    background: rgba(255, 255, 255, 0.08);
  }
  .tab-link {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    background: none;
    border: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
    padding: 0;
  }
  .favicon {
    width: 14px;
    height: 14px;
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
    font-size: 12px;
  }
</style>
