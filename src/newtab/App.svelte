<script lang="ts">
  import { onMount, tick } from "svelte";
  import TabManager from "./components/TabManager.svelte";
  import QuickAccessBar from "./components/QuickAccessBar.svelte";
  import Clock from "./components/Clock.svelte";
  import BackgroundLayer from "./components/BackgroundLayer.svelte";
  import BackgroundNavControls from "./components/BackgroundNavControls.svelte";
  import SettingsDrawer from "./components/SettingsDrawer.svelte";
  import { store } from "./lib/store.svelte";
  import { uiState } from "./lib/uiState.svelte";
  import { resolveQuickAccessKey } from "./lib/quickAccess";

  let zen = $state(false);
  let tabsScreen: HTMLElement | undefined = $state();
  let clockScreen: HTMLElement | undefined = $state();
  let savedScrollTop = 0;

  /**
   * Bug real reportado: sair do zen mode sempre jogava de volta pra secao do
   * relogio no layout scroll-reveal. Causa: o conteudo de `<main>` e
   * desmontado inteiro enquanto `zen` e true (`{#if !zen}`), entao quando
   * remonta o scroll comeca do zero. Captura a posicao ANTES do conteudo
   * sumir (sincrono, no clique/tecla que ativa o zen) e restaura DEPOIS do
   * conteudo remontar (por isso o `tick()` — precisa esperar o DOM atualizar
   * antes de setar scrollTop, senao o elemento nem existe ainda ou ainda esta
   * com altura zero). Captura tanto `main.scrollTop` (scroll-reveal, onde
   * `main` e o container de scroll) quanto `window.scrollY` (coexistent/
   * no-clock, onde quem rola e o documento) — cobre os 3 layouts.
   */
  async function toggleZen() {
    const mainEl = document.querySelector("main");
    if (!zen) {
      savedScrollTop = mainEl?.scrollTop || window.scrollY;
      zen = true;
    } else {
      zen = false;
      await tick();
      if (mainEl && mainEl.scrollHeight > mainEl.clientHeight) {
        mainEl.scrollTop = savedScrollTop;
      } else {
        window.scrollTo(0, savedScrollTop);
      }
    }
  }

  onMount(() => {
    store.loadAll();
    // Chrome costuma autofocar a omnibox ao abrir a new-tab — nesse caso o
    // keydown de teclas numericas (acesso rapido) nunca chega a este document.
    // Disputamos o foco inicial pelo documento assim que montamos.
    document.body.tabIndex = -1;
    document.body.focus();
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

  // ponytail: ArrowUp/ArrowDown ainda disparam o salto manual (scroll-snap nao
  // reage a teclado por si so); a rolagem com mouse/trackpad agora e 100%
  // nativa (ver <style>), sem nenhum handler de wheel/getBoundingClientRect.

  function handleKeydown(event: KeyboardEvent) {
    if (isEditable(event.target)) return;
    // Com o drawer de configuracoes aberto, nenhum atalho global deve roubar
    // Space/setas/numeros de botoes/sliders focados dentro dele — bug real
    // confirmado: Space ativava zen mode (desmontando o drawer inteiro) mesmo
    // com o foco num botao de dentro das configuracoes.
    if (uiState.settingsOpen) return;

    if (event.code === "Space") {
      event.preventDefault();
      // Segurar a barra repete o keydown (event.repeat) — sem este guard, o
      // zen mode ficava entrando/saindo em flicker enquanto a tecla estava
      // pressionada, em vez de alternar uma unica vez por toque real.
      if (event.repeat) return;
      toggleZen();
      return;
    }

    if (store.config.layoutMode === "scroll-reveal" && event.code === "ArrowDown") {
      event.preventDefault();
      tabsScreen?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    if (store.config.layoutMode === "scroll-reveal" && event.code === "ArrowUp") {
      event.preventDefault();
      clockScreen?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    const modifierPressed = event.metaKey || event.ctrlKey;
    const action = resolveQuickAccessKey(event.code, modifierPressed);
    if (action.type === "open-one") {
      event.preventDefault();
      openQuickAccess(action.slot, action.focus);
    } else if (action.type === "open-all") {
      event.preventDefault();
      openAllQuickAccess(action.focus);
    }
  }

</script>

<svelte:window onkeydown={handleKeydown} />

<BackgroundLayer {zen} />
{#if !zen}
  <SettingsDrawer />
{/if}

<main class:scroll-reveal={store.config.layoutMode === "scroll-reveal"}>
  {#if !zen && store.configLoaded}
    {#if store.config.layoutMode === "no-clock"}
      <div class="no-clock-quick-access">
        <QuickAccessBar />
      </div>
      <TabManager />
    {:else if store.config.layoutMode === "coexistent"}
      <div class="coexistent-clock">
        <Clock />
      </div>
      <QuickAccessBar />
      <TabManager />
    {:else}
      <section class="clock-screen" bind:this={clockScreen}>
        <Clock />
        <QuickAccessBar />
        <BackgroundNavControls fixed={false} />
      </section>
      <section class="tabs-screen" bind:this={tabsScreen}>
        <TabManager />
      </section>
    {/if}
  {/if}
</main>

{#if !zen && store.configLoaded && store.config.layoutMode !== "scroll-reveal"}
  <BackgroundNavControls />
{/if}

<style>
  .coexistent-clock {
    padding-top: 24px;
  }
  .no-clock-quick-access {
    padding-top: 24px;
  }

  /*
   * scroll-reveal: `main` vira o proprio container de scroll (equivalente web
   * do PageView/PageController do Flutter), com `scroll-snap`. Isto substitui
   * por completo a heuristica anterior em JS (wheel handlers +
   * getBoundingClientRect contando "estamos na borda?") — que so acertava a
   * borda que tinha sido testada por ultimo e quebrava de novo em cenarios
   * novos (ex.: rolar no meio/fim de uma lista longa). `scroll-snap-stop`
   * default ("normal") deixa a rolagem DENTRO de uma secao mais alta que a
   * tela totalmente livre, pixel a pixel; o navegador so "gruda" na proxima
   * secao quando o usuario cruza a borda entre elas — exatamente o
   * comportamento pedido, e zero codigo JS de deteccao de posicao.
   */
  main.scroll-reveal {
    height: 100vh;
    overflow-y: auto;
    scroll-snap-type: y mandatory;
  }
  .clock-screen {
    position: relative;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    scroll-snap-align: start;
  }
  .tabs-screen {
    min-height: 100vh;
    scroll-snap-align: start;
  }
</style>
