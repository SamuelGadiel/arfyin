<script lang="ts">
  import { store } from "../lib/store.svelte";
  import type { QuickAccessItem } from "@/shared/types";

  let items = $derived([...store.config.quickAccess].sort((a, b) => a.slot - b.slot));

  function addItem() {
    const usedSlots = new Set(store.config.quickAccess.map((i) => i.slot));
    const nextSlot = Array.from({ length: 9 }, (_, i) => i + 1).find((s) => !usedSlots.has(s));
    if (!nextSlot) {
      alert("Todos os 9 slots de acesso rápido já estão em uso.");
      return;
    }
    const title = prompt("Nome do atalho:");
    if (!title) return;
    const url = prompt("URL:");
    if (!url) return;
    const next: QuickAccessItem = { slot: nextSlot, title, url };
    store.setQuickAccess([...store.config.quickAccess, next]);
  }

  function removeItem(slot: number) {
    store.setQuickAccess(store.config.quickAccess.filter((i) => i.slot !== slot));
  }
</script>

<div class="quick-access">
  {#each items as item (item.slot)}
    <div class="item">
      <span class="slot">{item.slot}</span>
      <a href={item.url}>{item.title}</a>
      <button class="remove" onclick={() => removeItem(item.slot)} title="Remover">✕</button>
    </div>
  {/each}
  {#if store.config.quickAccess.length < 9}
    <button class="add" onclick={addItem}>+ acesso rápido</button>
  {/if}
</div>

<style>
  .quick-access {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    margin: 8px 0 16px;
  }
  .item {
    display: flex;
    align-items: center;
    gap: 4px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    padding: 4px 8px;
    font-size: 12px;
  }
  .item a {
    color: inherit;
    text-decoration: none;
  }
  .slot {
    opacity: 0.5;
    font-size: 10px;
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
  .remove:hover,
  .add:hover {
    opacity: 1;
  }
</style>
