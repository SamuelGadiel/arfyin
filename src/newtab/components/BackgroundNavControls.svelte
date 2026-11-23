<script lang="ts">
  import { store } from "../lib/store.svelte";
  import { backgroundState } from "../lib/backgroundState.svelte";
  import Icon from "./Icon.svelte";

  interface Props {
    /**
     * `true` (default) posiciona os controles fixos na tela inteira — usado
     * nos layouts `coexistent`/`no-clock`, onde nao ha uma secao dedicada ao
     * relogio para hospeda-los. No layout `scroll-reveal`, o proprio App.svelte
     * renderiza este componente SEM `fixed` dentro de `.clock-screen`: ao
     * rolar para a secao de abas (scroll-snap ocupando 100% da tela), os
     * controles saem de vista junto com o resto do relogio, sem nenhuma
     * logica de deteccao de scroll.
     */
    fixed?: boolean;
  }
  let { fixed = true }: Props = $props();

  let bg = $derived(store.config.background);
  let isStatic = $derived(bg.rotationMode === "static");
  // No modo estatico o papel de parede ja fica sempre "travado" por
  // definicao (ver backgroundState.applyIndex) — prev/next continuam livres
  // (servem para ESCOLHER qual imagem fixa usar), so o botao de pausar
  // deixa de fazer sentido e some.
  let paused = $derived(!isStatic && bg.pausedKey !== null);

  function goPrev() {
    backgroundState.prev();
    if (isStatic) backgroundState.pause();
  }

  function goNext() {
    backgroundState.next();
    if (isStatic) backgroundState.pause();
  }
</script>

{#if bg.source !== "solid" && backgroundState.candidates.length > 0}
  <div class="nav" class:fixed class:anchored={!fixed}>
    <button onclick={goPrev} title="Imagem anterior" aria-label="Imagem anterior" disabled={paused}>
      <Icon name="chevron-left" size={16} />
    </button>
    {#if !isStatic}
      <button
        onclick={() => (paused ? backgroundState.resume() : backgroundState.pause())}
        title={paused ? "Retomar rotação" : "Pausar nesta imagem"}
        aria-label={paused ? "Retomar rotação do papel de parede" : "Pausar papel de parede nesta imagem"}
        class:active={paused}
      >
        <Icon name={paused ? "play" : "pause"} size={14} />
      </button>
    {/if}
    <button onclick={goNext} title="Próxima imagem" aria-label="Próxima imagem" disabled={paused}>
      <Icon name="chevron-right" size={16} />
    </button>
  </div>
{/if}

<style>
  .nav {
    display: flex;
    gap: 8px;
    z-index: 10;
  }
  /* `fixed`: ancorado na viewport inteira (layouts coexistent/no-clock).
     `anchored` (fixed=false, usado no scroll-reveal): ancorado no fundo da
     propria secao do relogio (`.clock-screen`, que tem position:relative) —
     fica perto da base da tela, longe do relogio, e some ao rolar pra secao
     de abas junto com o resto do conteudo da secao. */
  .nav.fixed,
  .nav.anchored {
    position: absolute;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
  }
  .nav.fixed {
    position: fixed;
  }
  .nav button {
    background: rgba(0, 0, 0, 0.5);
    color: #fff;
    border: none;
    border-radius: 50%;
    width: 28px;
    height: 28px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .nav button.active {
    background: rgba(255, 255, 255, 0.85);
    color: #121212;
  }
  .nav button:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
</style>
