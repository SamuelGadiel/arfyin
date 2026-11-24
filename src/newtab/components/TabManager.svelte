<script lang="ts">
  import { store } from "../lib/store.svelte";
  import GroupItem from "./GroupItem.svelte";
  import GroupDropGap from "./GroupDropGap.svelte";
  import UngroupedSection from "./UngroupedSection.svelte";
  import SyncStatusBanner from "./SyncStatusBanner.svelte";
  import LiveWindows from "./LiveWindows.svelte";
  import GroupDialog from "./GroupDialog.svelte";
  import Icon from "./Icon.svelte";

  let sortedGroups = $derived([...store.groups].sort((a, b) => a.order - b.order));
  let showCreateDialog = $state(false);

  async function createGroup(name: string, color: string | null, icon: string | null) {
    const group = await store.createGroup(name);
    if (color !== null || icon !== null) await store.updateAppearance(group.id, color, icon);
  }
</script>

<div class="tab-manager">
  {#if !store.loaded}
    <p class="loading">Carregando…</p>
  {:else}
    <!--
      Duas colunas, cada uma com seu proprio scroll (max-height + overflow-y),
      para nao obrigar o usuario a rolar ate o fim de uma lista longa de abas
      abertas so para depois rolar de volta ate o grupo-alvo do outro lado. Os
      containers individuais (GroupItem/LiveWindowSection/UngroupedSection)
      nao tem scroll proprio — exibem todo o conteudo, e e a COLUNA que cresce
      e rola. Arrastar da esquerda (abas/janelas ao vivo) para a direita
      (grupos/Sem grupo) ja funciona sem nenhuma mudanca de logica —
      GroupItem/UngroupedSection ja tratam os payloads "live-tab"/
      "live-window" no handleDrop, drag-and-drop e baseado em dataTransfer,
      nao em proximidade no DOM.
    -->
    <div class="columns">
      <div class="column">
        <LiveWindows />
      </div>
      <div class="column">
        <h2 class="groups-heading">Grupos</h2>
        <!-- "Sem categoria" fica sempre primeiro na lista, se habilitado. -->
        {#if store.config.ungroupedEnabled}
          <UngroupedSection />
        {/if}
        <GroupDropGap index={0} />
        {#each sortedGroups as group, i (group.id)}
          <GroupItem {group} />
          <GroupDropGap index={i + 1} />
        {/each}
        <button class="create-group" onclick={() => (showCreateDialog = true)}>
          <Icon name="add" size={14} /> Novo grupo
        </button>
      </div>
    </div>
  {/if}

  <SyncStatusBanner />
</div>

{#if showCreateDialog}
  <GroupDialog onSave={createGroup} onClose={() => (showCreateDialog = false)} />
{/if}

<style>
  .tab-manager {
    max-width: 1600px;
    margin: 0 auto;
    padding: 32px 16px 16px;
    color: #eaeaea;
  }
  .create-group {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: inherit;
    padding: 8px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
  }
  .create-group:hover {
    background: rgba(255, 255, 255, 0.18);
  }
  .loading {
    opacity: 0.5;
    font-size: 13px;
  }
  .columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    align-items: start;
  }
  .column {
    max-height: calc(100vh - 80px);
    overflow-y: auto;
    padding: 4px;
  }
  .groups-heading {
    font-size: 12px;
    text-transform: uppercase;
    opacity: 0.5;
    margin: 0 0 8px;
    padding: 0 6px;
  }
  @media (max-width: 900px) {
    .columns {
      grid-template-columns: 1fr;
    }
    .column {
      max-height: 50vh;
    }
  }
</style>
