<script lang="ts">
  import { store } from "../lib/store.svelte";
  import Icon from "./Icon.svelte";
  import QuickAccessDialog from "./QuickAccessDialog.svelte";

  let items = $derived([...store.config.quickAccess].sort((a, b) => a.slot - b.slot));
  let displayMode = $derived(store.config.quickAccessDisplayMode);
  let showSlot = $derived(store.config.quickAccessShowSlot);
  let itemRadius = $derived(store.config.quickAccessItemRadius);
  let showDialog = $state(false);

  function faviconUrl(url: string): string {
    return `https://www.google.com/s2/favicons?sz=32&domain_url=${encodeURIComponent(url)}`;
  }

  function addItem(title: string, url: string) {
    store.addQuickAccess(title, url);
  }

  function removeItem(slot: number) {
    store.setQuickAccess(store.config.quickAccess.filter((i) => i.slot !== slot));
  }
</script>

<div class="quick-access">
  {#each items as item (item.slot)}
    <div class="item" class:column={displayMode === "icon-text"} style:border-radius="{itemRadius}px">
      {#if showSlot}<span class="slot">{item.slot}</span>{/if}
      <a href={item.url} class="link" class:column={displayMode === "icon-text"} title={item.title}>
        {#if displayMode !== "text"}
          <img src={faviconUrl(item.url)} alt="" class="favicon" />
        {/if}
        {#if displayMode !== "icon"}
          <span class="title">{item.title}</span>
        {/if}
      </a>
      <button class="remove" onclick={() => removeItem(item.slot)} title="Remover" aria-label="Remover acesso rápido">
        <Icon name="x" size={12} />
      </button>
    </div>
  {/each}
  {#if store.config.quickAccess.length < 9}
    <button class="add" onclick={() => (showDialog = true)}>
      <Icon name="add" size={12} /> Novo atalho
    </button>
  {/if}
</div>

{#if showDialog}
  <QuickAccessDialog onSave={addItem} onClose={() => (showDialog = false)} />
{/if}

<style>
  .quick-access {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    margin: 8px 0 16px;
  }
  .item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(255, 255, 255, 0.08);
    padding: 6px 10px;
    font-size: 12px;
  }
  .item.column {
    flex-direction: column;
    padding: 10px 12px;
  }
  .link {
    display: flex;
    align-items: center;
    gap: 6px;
    color: inherit;
    text-decoration: none;
    min-width: 0;
  }
  .link.column {
    flex-direction: column;
    gap: 4px;
    text-align: center;
  }
  .favicon {
    width: 22px;
    height: 22px;
    flex-shrink: 0;
  }
  .title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .slot {
    position: absolute;
    top: -5px;
    left: -5px;
    background: rgba(0, 0, 0, 0.6);
    border-radius: 50%;
    width: 14px;
    height: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.7;
    font-size: 9px;
  }
  .remove,
  .add {
    background: none;
    border: none;
    color: inherit;
    opacity: 0.5;
    cursor: pointer;
    font-size: 12px;
  }
  .add {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .remove {
    display: flex;
    position: absolute;
    top: -5px;
    right: -5px;
    background: rgba(0, 0, 0, 0.6);
    border-radius: 50%;
    padding: 2px;
    opacity: 0;
  }
  .item:hover .remove {
    opacity: 0.8;
  }
  .remove:hover,
  .add:hover {
    opacity: 1;
  }
</style>
