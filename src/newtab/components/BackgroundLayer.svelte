<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { store } from "../lib/store.svelte";
  import { send } from "../lib/client";
  import { extractImageUrls, pickRandom, type MinimalRedditPost } from "@/shared/backgroundSource";

  interface Props {
    zen?: boolean;
  }
  let { zen = false }: Props = $props();

  let candidateUrls: string[] = $state([]);
  let currentIndex = $state(0);
  let objectUrlsToRevoke: string[] = [];
  let intervalId: ReturnType<typeof setInterval> | undefined;

  let bg = $derived(store.config.background);
  let currentUrl = $derived(candidateUrls[currentIndex] ?? null);

  async function loadCandidates() {
    objectUrlsToRevoke.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsToRevoke = [];

    if (bg.source === "local") {
      const urls: string[] = [];
      for (const id of bg.localAssetIds) {
        const res = await send<"ASSET">({ type: "GET_ASSET", id });
        if (res.type === "ASSET" && res.blob) {
          const url = URL.createObjectURL(res.blob);
          urls.push(url);
          objectUrlsToRevoke.push(url);
        }
      }
      candidateUrls = urls;
    } else if (bg.source === "reddit" && bg.subreddits.length > 0) {
      const subreddit = pickRandom(bg.subreddits) ?? bg.subreddits[0];
      try {
        const res = await fetch(`https://www.reddit.com/r/${subreddit}/top.json?limit=25&t=week`);
        const json = await res.json();
        const posts = (json?.data?.children ?? []) as MinimalRedditPost[];
        candidateUrls = extractImageUrls(posts);
      } catch {
        candidateUrls = [];
      }
    } else {
      candidateUrls = [];
    }
    currentIndex = candidateUrls.length > 0 ? Math.floor(Math.random() * candidateUrls.length) : 0;
  }

  function next() {
    if (candidateUrls.length === 0) return;
    currentIndex = (currentIndex + 1) % candidateUrls.length;
  }

  function prev() {
    if (candidateUrls.length === 0) return;
    currentIndex = (currentIndex - 1 + candidateUrls.length) % candidateUrls.length;
  }

  onMount(() => {
    loadCandidates();
  });

  $effect(() => {
    // re-carrega candidatos quando a fonte/parametros relevantes mudam
    void bg.source;
    void bg.subreddits;
    void bg.localAssetIds;
    loadCandidates();
  });

  $effect(() => {
    if (intervalId) clearInterval(intervalId);
    if (bg.frequencyMinutes > 0) {
      intervalId = setInterval(next, bg.frequencyMinutes * 60_000);
    }
  });

  onDestroy(() => {
    if (intervalId) clearInterval(intervalId);
    objectUrlsToRevoke.forEach((url) => URL.revokeObjectURL(url));
  });
</script>

<div
  class="background-layer"
  style:background-color={bg.source === "solid" ? bg.solidColor : "#121212"}
  style:background-image={currentUrl ? `url(${currentUrl})` : "none"}
  style:filter={zen ? "none" : `blur(${bg.blur}px)`}
>
</div>
<div class="darken-overlay" style:background-color={zen ? "transparent" : `rgba(0,0,0,${bg.darken})`}></div>

{#if !zen && bg.source !== "solid" && candidateUrls.length > 1}
  <div class="nav">
    <button onclick={prev} title="Imagem anterior">‹</button>
    <button onclick={next} title="Próxima imagem">›</button>
  </div>
{/if}

<style>
  .background-layer {
    position: fixed;
    inset: 0;
    background-size: cover;
    background-position: center;
    z-index: -2;
  }
  .darken-overlay {
    position: fixed;
    inset: 0;
    z-index: -1;
    pointer-events: none;
  }
  .nav {
    position: fixed;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 8px;
    z-index: 10;
  }
  .nav button {
    background: rgba(0, 0, 0, 0.5);
    color: #fff;
    border: none;
    border-radius: 50%;
    width: 28px;
    height: 28px;
    cursor: pointer;
    font-size: 16px;
  }
</style>
