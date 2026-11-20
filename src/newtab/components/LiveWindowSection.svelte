<script lang="ts">
  import type { LiveWindow } from "@/shared/types";
  import { setDragPayload } from "../lib/dragdrop";
  import LiveTabItem from "./LiveTabItem.svelte";

  interface Props {
    window: LiveWindow;
    index: number;
  }

  let { window, index }: Props = $props();

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
</script>

<div class="live-window">
  <h3 draggable="true" ondragstart={handleDragStart} title="Arraste para salvar a janela inteira num grupo">
    Janela {index + 1} <span class="count">{window.tabs.length}</span>
  </h3>
  <div class="tabs" role="list">
    {#each window.tabs as tab (tab.chromeTabId)}
      <LiveTabItem {tab} />
    {/each}
  </div>
</div>

<style>
  .live-window {
    margin-bottom: 10px;
  }
  h3 {
    font-size: 11px;
    text-transform: uppercase;
    opacity: 0.5;
    margin: 0 0 4px;
    cursor: grab;
  }
  .count {
    opacity: 0.6;
  }
</style>
