<script lang="ts">
  import { onDestroy } from "svelte";
  import { store } from "../lib/store.svelte";
  import { backgroundState } from "../lib/backgroundState.svelte";

  interface Props {
    zen?: boolean;
  }
  let { zen = false }: Props = $props();

  let bg = $derived(store.config.background);
  // Chave primitiva estavel (string): usada como UNICA leitura reativa dos
  // efeitos abaixo. `bg` e um proxy que troca de referencia a cada mudanca de
  // QUALQUER campo do config (mesmo darken/blur), porque `store.config` e
  // reatribuido por inteiro a cada `loadAll()` — ler `bg.*` diretamente de
  // dentro de um `$effect` (mesmo so para montar esta string) prende o efeito
  // a essa referencia instavel. Por isso `backgroundState.loadCandidates`
  // abaixo NUNCA le `bg.*`: recebe tudo via a STRING ja materializada.
  let bgKey = $derived(
    JSON.stringify([
      bg.source,
      bg.subreddits,
      bg.unsplashTopics,
      bg.localAssetIds,
      bg.pausedKey,
      bg.rotationMode,
      bg.frequencyMinutes,
      bg.timedStartedAt,
    ]),
  );
  let rotationMode = $derived(bg.rotationMode);
  let paused = $derived(bg.pausedKey !== null);

  let intervalId: ReturnType<typeof setInterval> | undefined;

  $effect(() => {
    // re-carrega candidatos quando a fonte/parametros relevantes (pause, modo
    // de rotacao, frequencia) mudam
    backgroundState.loadCandidates(bgKey);
  });

  $effect(() => {
    // Guideline da Unsplash API: disparar o "trigger download" quando a foto
    // e efetivamente usada (exibida como background), uma vez por foto.
    const downloadLocation = backgroundState.current?.attribution?.downloadLocation;
    if (downloadLocation && backgroundState.downloadTriggeredFor !== downloadLocation) {
      backgroundState.downloadTriggeredFor = downloadLocation;
      const accessKey = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;
      fetch(downloadLocation, { headers: { Authorization: `Client-ID ${accessKey}` } }).catch(() => {});
    }
  });

  // Checagem periodica (nao o intervalo de troca em si): o indice "timed" e
  // calculado por tempo decorrido (ver backgroundState.applyIndex), entao so
  // precisa ser reconsultado de vez em quando para refletir na tela — uma aba
  // deixada aberta por N minutos muda sozinha sem precisar de um novo
  // carregamento completo. 30s e granular o suficiente sem ser custoso.
  const TIMED_RECHECK_MS = 30_000;

  $effect(() => {
    // Leitura sincrona de `bgKey` (string primitiva, segura) estabelece a
    // dependencia — sem isto, trocar frequencia/fonte enquanto o timer ja
    // esta rodando deixaria o `setInterval` com uma closure desatualizada ate
    // rotationMode/paused mudarem por algum outro motivo.
    const key = bgKey;
    if (intervalId) clearInterval(intervalId);
    if (rotationMode === "timed" && !paused) {
      intervalId = setInterval(() => backgroundState.recompute(key), TIMED_RECHECK_MS);
    }
  });

  onDestroy(() => {
    if (intervalId) clearInterval(intervalId);
    backgroundState.objectUrlsToRevoke.forEach((url) => URL.revokeObjectURL(url));
  });
</script>

<div
  class="background-layer"
  style:background-color={bg.source === "solid" ? bg.solidColor : "#121212"}
  style:background-image={backgroundState.currentUrl ? `url(${backgroundState.currentUrl})` : "none"}
  style:filter={zen ? "none" : `blur(${bg.blur}px)`}
>
</div>
<div class="darken-overlay" style:background-color={zen ? "transparent" : `rgba(0,0,0,${bg.darken})`}></div>

{#if !zen && backgroundState.current?.attribution}
  <div class="attribution">
    Photo by <a href={backgroundState.current.attribution.photographerUrl} target="_blank" rel="noopener noreferrer">{backgroundState.current.attribution.photographerName}</a>
    on <a href={backgroundState.current.attribution.unsplashUrl} target="_blank" rel="noopener noreferrer">Unsplash</a>
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
  .attribution {
    position: fixed;
    bottom: 12px;
    right: 12px;
    z-index: 10;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.7);
    background: rgba(0, 0, 0, 0.4);
    padding: 2px 8px;
    border-radius: 4px;
  }
  .attribution a {
    color: inherit;
    text-decoration: underline;
  }
</style>
