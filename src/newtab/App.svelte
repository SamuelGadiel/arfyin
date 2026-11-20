<script lang="ts">
  import { onMount } from "svelte";
  import TabManager from "./components/TabManager.svelte";
  import QuickAccessBar from "./components/QuickAccessBar.svelte";
  import Clock from "./components/Clock.svelte";
  import { store } from "./lib/store.svelte";
  import { resolveQuickAccessKey } from "./lib/quickAccess";

  let zen = $state(false);
  let tabsScreen: HTMLElement | undefined = $state();

  onMount(() => {
    store.loadAll();
  });

  function isEditable(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable
    );
  }

  function openQuickAccess(slot: number, focus: boolean) {
    const item = store.config.quickAccess.find((i) => i.slot === slot);
    if (item) chrome.tabs.create({ url: item.url, active: focus });
  }

  function openAllQuickAccess(focus: boolean) {
    for (const item of store.config.quickAccess) {
      chrome.tabs.create({ url: item.url, active: focus });
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (isEditable(event.target)) return;

    if (event.code === "Space") {
      event.preventDefault();
      zen = !zen;
      return;
    }

    if (store.config.layoutMode === "scroll-reveal" && event.code === "ArrowDown") {
      event.preventDefault();
      tabsScreen?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    const modifierPressed = event.metaKey || event.ctrlKey;
    const action = resolveQuickAccessKey(event.code, modifierPressed);
    if (action.type === "open-one") openQuickAccess(action.slot, action.focus);
    else if (action.type === "open-all") openAllQuickAccess(action.focus);
  }

  function handleWheel(event: WheelEvent) {
    if (store.config.layoutMode === "scroll-reveal" && event.deltaY > 0) {
      tabsScreen?.scrollIntoView({ behavior: "smooth" });
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<main>
  {#if !zen}
    {#if store.config.layoutMode === "no-clock"}
      <QuickAccessBar />
      <TabManager />
    {:else if store.config.layoutMode === "coexistent"}
      <div class="coexistent-clock">
        <Clock />
      </div>
      <QuickAccessBar />
      <TabManager />
    {:else}
      <section class="clock-screen" onwheel={handleWheel}>
        <Clock />
        <QuickAccessBar />
      </section>
      <section class="tabs-screen" bind:this={tabsScreen}>
        <TabManager />
      </section>
    {/if}
  {/if}
</main>

<style>
  .coexistent-clock {
    padding-top: 24px;
  }
  .clock-screen {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  .tabs-screen {
    min-height: 100vh;
  }
</style>
