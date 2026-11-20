<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { store } from "../lib/store.svelte";

  let now = $state(new Date());
  let intervalId: ReturnType<typeof setInterval> | undefined;

  onMount(() => {
    intervalId = setInterval(() => (now = new Date()), 1000);
  });

  onDestroy(() => {
    if (intervalId) clearInterval(intervalId);
  });

  let timeText = $derived(
    new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: !store.config.clock.format24h,
    }).format(now),
  );

  let dateText = $derived(
    new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(now),
  );

  function toggleFormat() {
    store.updateConfig({ clock: { format24h: !store.config.clock.format24h } });
  }
</script>

<button class="clock" onclick={toggleFormat} title="Alternar 24h/12h">
  <span class="time">{timeText}</span>
  <span class="date">{dateText}</span>
</button>

<style>
  .clock {
    display: block;
    width: 100%;
    background: none;
    border: none;
    color: inherit;
    text-align: center;
    cursor: pointer;
  }
  .time {
    display: block;
    font-size: 48px;
    font-weight: 300;
    letter-spacing: 2px;
  }
  .date {
    display: block;
    font-size: 14px;
    opacity: 0.6;
    text-transform: capitalize;
  }
</style>
