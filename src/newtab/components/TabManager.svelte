<script lang="ts">
  import { store } from "../lib/store.svelte";
  import type { LayoutMode } from "@/shared/types";
  import GroupItem from "./GroupItem.svelte";
  import UngroupedSection from "./UngroupedSection.svelte";
  import SyncStatusBanner from "./SyncStatusBanner.svelte";
  import LiveWindows from "./LiveWindows.svelte";
  import BackupControls from "./BackupControls.svelte";
  import BackgroundSettings from "./BackgroundSettings.svelte";
  import AuthControls from "./AuthControls.svelte";

  type SortMode = "manual" | "alphabetical";
  let sortMode: SortMode = $state("manual");

  let sortedGroups = $derived(
    sortMode === "alphabetical"
      ? [...store.groups].sort((a, b) => a.name.localeCompare(b.name))
      : [...store.groups].sort((a, b) => a.order - b.order),
  );

  async function createGroup() {
    const name = prompt("Nome do novo grupo:");
    if (name && name.trim()) await store.createGroup(name.trim());
  }
</script>

<div class="tab-manager">
  <div class="toolbar">
    <button class="create-group" onclick={createGroup}>+ Novo grupo</button>
    <label class="sort-toggle">
      Ordenar:
      <select bind:value={sortMode}>
        <option value="manual">Manual</option>
        <option value="alphabetical">Alfabética</option>
      </select>
    </label>
    <label class="sort-toggle">
      Layout:
      <select
        value={store.config.layoutMode}
        onchange={(e) => store.updateConfig({ layoutMode: e.currentTarget.value as LayoutMode })}
      >
        <option value="coexistent">Relógio + abas juntos</option>
        <option value="scroll-reveal">Relógio em tela cheia (scroll revela abas)</option>
        <option value="no-clock">Sem relógio</option>
      </select>
    </label>
  </div>

  <AuthControls />
  <BackgroundSettings />
  <BackupControls />

  {#if !store.loaded}
    <p class="loading">Carregando…</p>
  {:else}
    {#each sortedGroups as group (group.id)}
      <GroupItem {group} />
    {/each}
    <UngroupedSection />
    <LiveWindows />
  {/if}

  <SyncStatusBanner />
</div>

<style>
  .tab-manager {
    max-width: 480px;
    margin: 0 auto;
    padding: 16px;
    color: #eaeaea;
  }
  .toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }
  .create-group {
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: inherit;
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
  }
  .create-group:hover {
    background: rgba(255, 255, 255, 0.18);
  }
  .sort-toggle {
    font-size: 12px;
    opacity: 0.7;
  }
  .loading {
    opacity: 0.5;
    font-size: 13px;
  }
</style>
