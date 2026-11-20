<script lang="ts">
  import { store } from "../lib/store.svelte";
  import { readDragPayload } from "../lib/dragdrop";
  import TabItem from "./TabItem.svelte";

  let isDragOver = $state(false);

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
    if (!payload || payload.kind !== "saved-tab") return;
    if (payload.sourceGroupId === null) return;
    store.moveTab(payload.tabId, null);
  }
</script>

<section class="ungrouped">
  <h2>Abas soltas</h2>
  <div
    class="list"
    class:drag-over={isDragOver}
    ondragover={handleDragOver}
    ondragleave={handleDragLeave}
    ondrop={handleDrop}
    role="list"
  >
    {#each store.ungrouped as tab (tab.id)}
      <TabItem {tab} />
    {/each}
    {#if store.ungrouped.length === 0}
      <p class="empty">Nenhuma aba solta.</p>
    {/if}
  </div>
</section>

<style>
  .ungrouped h2 {
    font-size: 12px;
    text-transform: uppercase;
    opacity: 0.5;
    margin: 12px 0 4px;
  }
  .list {
    min-height: 8px;
    border-radius: 6px;
  }
  .list.drag-over {
    background: rgba(255, 255, 255, 0.06);
    outline: 1px dashed rgba(255, 255, 255, 0.3);
  }
  .empty {
    font-size: 12px;
    opacity: 0.4;
  }
</style>
