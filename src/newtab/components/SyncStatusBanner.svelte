<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { send } from "../lib/client";
  import type { SyncState } from "@/shared/storage";

  const POLL_INTERVAL_MS = 30_000;

  let state: SyncState = $state("idle");
  let lastError: string | null = $state(null);

  async function refresh() {
    const response = await send<"SYNC_STATUS">({ type: "GET_SYNC_STATUS" });
    if (response?.type === "SYNC_STATUS") {
      state = response.status.state;
      lastError = response.status.lastError;
    }
  }

  let intervalId: ReturnType<typeof setInterval> | undefined;

  onMount(() => {
    refresh();
    intervalId = setInterval(refresh, POLL_INTERVAL_MS);
  });

  onDestroy(() => {
    if (intervalId) clearInterval(intervalId);
  });
</script>

{#if state === "unreachable"}
  <div class="sync-banner" role="status" title={lastError ?? undefined}>
    Sincronização com a nuvem indisponível — seus dados continuam salvos localmente.
    Verifique se o projeto não está pausado no painel do Supabase.
  </div>
{/if}

<style>
  .sync-banner {
    position: fixed;
    bottom: 12px;
    right: 12px;
    max-width: 320px;
    padding: 8px 12px;
    font-size: 12px;
    line-height: 1.4;
    background: rgba(0, 0, 0, 0.75);
    color: #f5c451;
    border: 1px solid rgba(245, 196, 81, 0.4);
    border-radius: 8px;
    z-index: 1000;
  }
</style>
