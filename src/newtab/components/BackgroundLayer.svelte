<script lang="ts">
  import { onDestroy } from "svelte";
  import { store } from "../lib/store.svelte";
  import { send } from "../lib/client";
  import { backgroundState } from "../lib/backgroundState.svelte";
  import { readQuickBackground, writeQuickBackground } from "../lib/backgroundQuickCache";
  import { base64ToBlob } from "@/shared/backgroundFetch";

  interface Props {
    zen?: boolean;
  }
  let { zen = false }: Props = $props();

  // Lido SINCRONAMENTE aqui (nao dentro de nenhum $effect), antes de
  // store.configLoaded resolver — ver backgroundQuickCache.ts. So serve de
  // palpite ate o valor REAL chegar, e SO quando a imagem e estavel (fonte
  // "solid" ou pausada numa unica imagem) — nunca no modo "per-tab" dinamico,
  // que usa a fila de pre-fetch abaixo (reaplicar a ultima imagem de outra
  // aba no modo dinamico foi reportado ao vivo como um flash de imagem
  // errada, exatamente o bug que a fila resolve).
  const quickBg = readQuickBackground();

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

  // Modo dinamico "per-tab" (cada aba mostra uma imagem diferente) com fonte
  // remota e sem imagem travada: usa a fila de pre-fetch (blob ja baixado,
  // sempre pronto) em vez do fluxo antigo. Nos demais casos (fonte sólida,
  // asset local, imagem pausada/travada, modo "timed" sincronizado por
  // tempo) a imagem e sempre a MESMA entre aberturas — o cache rapido de
  // localStorage e seguro e suficiente ali, sem precisar de fila nenhuma.
  let usesPrefetchQueue = $derived(
    store.configLoaded &&
      bg.pausedKey === null &&
      bg.rotationMode === "per-tab" &&
      (bg.source === "reddit" || bg.source === "unsplash"),
  );
  // Dependencia reduzida do effect de pre-fetch — so o que de fato muda QUAL
  // fila consultar (fonte/parametros/pause/modo). Deliberadamente nao inclui
  // darken/blur/frequencyMinutes/timedStartedAt, que mudam sem precisar de
  // um novo pop da fila.
  let prefetchKey = $derived(
    JSON.stringify([bg.source, bg.subreddits, bg.unsplashTopics, bg.pausedKey, bg.rotationMode]),
  );

  async function loadViaPrefetchQueue() {
    try {
      const dpr = window.devicePixelRatio || 1;
      const targetWidth = Math.round(window.screen.width * dpr);
      const targetHeight = Math.round(window.screen.height * dpr);
      const res = await send<"BACKGROUND_PREFETCH">({
        type: "POP_BACKGROUND_PREFETCH",
        source: bg.source as "reddit" | "unsplash",
        subreddits: bg.subreddits,
        unsplashTopics: bg.unsplashTopics,
        targetWidth,
        targetHeight,
      });
      if (res.type === "BACKGROUND_PREFETCH" && res.imageBase64 && res.sourceUrl) {
        const blob = base64ToBlob(res.imageBase64, res.mimeType ?? "image/jpeg");
        backgroundState.setPrefetched(blob, res.sourceUrl, res.attribution);
      }
    } catch (err) {
      // `chrome.runtime.sendMessage` pode REJEITAR a nivel de transporte (nao
      // so responder com imageBase64:null) — ex. mensagem grande demais
      // (imagem+base64 de uma tela grande pode passar de alguns MB). Sem
      // este catch, a excecao interrompia a funcao ANTES da linha de
      // fallback abaixo rodar, deixando a tela preta pra sempre (bug real
      // relatado ao vivo: "tela preta" / "aparece e some"). O fallback
      // (loadCandidates, pool normal via URL remota) sempre precisa rodar,
      // com ou sem sucesso do prefetch.
      console.error("[arfyin] loadViaPrefetchQueue falhou, caindo no fallback:", err);
    }
    // Sempre popula o pool normal tambem (usado por next()/prev() e como
    // fallback se a fila estava vazia OU o prefetch falhou) — nao bloqueia
    // a exibicao acima.
    backgroundState.loadCandidates(bgKey);
  }

  $effect(() => {
    if (usesPrefetchQueue) {
      // Leitura sincrona de `prefetchKey` estabelece a dependencia reativa.
      void prefetchKey;
      loadViaPrefetchQueue();
    } else {
      backgroundState.clearPrefetched();
      backgroundState.loadCandidates(bgKey);
    }
  });

  // Enquanto o config real ainda nao chegou, ou chegou mas os candidatos de
  // reddit/unsplash ainda nao resolveram, usa o palpite do cache rapido —
  // nunca quando o modo dinamico "per-tab" ja esta identificado. Usuario
  // testou a alternativa (cache como ultimo recurso tambem no modo dinamico,
  // ver REGISTRO.md v3) e rejeitou: aparecia uma imagem (a antiga) que
  // trocava pouco depois pela nova — pior do que aceitar um instante de tela
  // solida ("como era antes") ate a imagem definitiva (fila ou fallback)
  // resolver, sem nenhuma troca no meio.
  let waitingForReal = $derived(
    !usesPrefetchQueue &&
      (!store.configLoaded ||
        ((bg.source === "reddit" || bg.source === "unsplash") && backgroundState.currentUrl === null)),
  );
  let effectiveColor = $derived(
    store.configLoaded ? (bg.source === "solid" ? bg.solidColor : "#121212") : (quickBg?.solidColor ?? "#121212"),
  );
  let effectiveImageUrl = $derived(
    backgroundState.prefetchedUrl ??
      backgroundState.currentUrl ??
      (waitingForReal ? (quickBg?.imageUrl ?? null) : null),
  );
  let effectiveAttribution = $derived(backgroundState.prefetchedUrl ? backgroundState.prefetchedAttribution : backgroundState.current?.attribution);

  $effect(() => {
    // Grava o palpite para a PROXIMA aba so quando o estado e "estavel" E
    // nao-dinamico (fonte solid, sempre estavel; ou reddit/unsplash/local
    // pausado/travado numa unica imagem) — nunca no modo "per-tab" (ali cada
    // aba deve ver uma imagem DIFERENTE da anterior, entao reaplicar a
    // ultima seria o bug ja relatado, nao uma otimizacao).
    if (!store.configLoaded || usesPrefetchQueue) return;
    if (bg.source === "solid") {
      writeQuickBackground({ solidColor: bg.solidColor, imageUrl: null });
    } else if (backgroundState.currentUrl) {
      writeQuickBackground({ solidColor: "#121212", imageUrl: backgroundState.currentUrl });
    }
  });

  $effect(() => {
    // Guideline da Unsplash API: disparar o "trigger download" quando a foto
    // e efetivamente usada (exibida como background), uma vez por foto.
    const downloadLocation = effectiveAttribution?.downloadLocation;
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
    backgroundState.clearPrefetched();
  });
</script>

<div
  class="background-layer"
  style:background-color={effectiveColor}
  style:background-image={effectiveImageUrl ? `url(${effectiveImageUrl})` : "none"}
  style:filter={zen ? "none" : `blur(${bg.blur}px)`}
>
</div>
<div class="darken-overlay" style:background-color={zen ? "transparent" : `rgba(0,0,0,${bg.darken})`}></div>

{#if !zen && effectiveAttribution}
  {@const attribution = effectiveAttribution}
  <div class="attribution">
    {#if attribution.kind === "unsplash"}
      Photo by <a href={attribution.authorUrl} target="_blank" rel="noopener noreferrer">{attribution.authorName}</a>
      on <a href={attribution.sourceUrl} target="_blank" rel="noopener noreferrer">{attribution.sourceName}</a>
    {:else}
      Postado por <a href={attribution.authorUrl} target="_blank" rel="noopener noreferrer">{attribution.authorName}</a>
      em <a href={attribution.sourceUrl} target="_blank" rel="noopener noreferrer">{attribution.sourceName}</a>
    {/if}
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
