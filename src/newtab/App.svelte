<script lang="ts">
  import { onMount } from "svelte";
  import TabManager from "./components/TabManager.svelte";
  import QuickAccessBar from "./components/QuickAccessBar.svelte";
  import { store } from "./lib/store.svelte";
  import { resolveQuickAccessKey } from "./lib/quickAccess";

  let zen = $state(false);

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

    const modifierPressed = event.metaKey || event.ctrlKey;
    const action = resolveQuickAccessKey(event.code, modifierPressed);
    if (action.type === "open-one") openQuickAccess(action.slot, action.focus);
    else if (action.type === "open-all") openAllQuickAccess(action.focus);
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<main>
  {#if !zen}
    <QuickAccessBar />
    <TabManager />
  {/if}
</main>
