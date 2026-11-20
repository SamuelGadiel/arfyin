<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import type { LiveWindow } from "@/shared/types";
  import LiveWindowSection from "./LiveWindowSection.svelte";

  const LIVE_WINDOWS_PORT_NAME = "live-windows";

  let windows: LiveWindow[] = $state([]);
  let port: chrome.runtime.Port | undefined;

  onMount(() => {
    port = chrome.runtime.connect({ name: LIVE_WINDOWS_PORT_NAME });
    port.onMessage.addListener((message: { type: string; windows?: LiveWindow[] }) => {
      if (message.type === "LIVE_WINDOWS" && message.windows) {
        windows = message.windows;
      }
    });
  });

  onDestroy(() => {
    port?.disconnect();
  });
</script>

<section class="live-windows">
  <h2>Abas abertas</h2>
  {#each windows as window, index (window.windowId)}
    <LiveWindowSection {window} {index} />
  {/each}
  {#if windows.length === 0}
    <p class="empty">Nenhuma janela aberta.</p>
  {/if}
</section>

<style>
  .live-windows h2 {
    font-size: 12px;
    text-transform: uppercase;
    opacity: 0.5;
    margin: 16px 0 8px;
  }
  .empty {
    font-size: 12px;
    opacity: 0.4;
  }
</style>
