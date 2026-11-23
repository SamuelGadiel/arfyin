<script lang="ts">
  import type { LiveTab } from "@/shared/types";
  import { store } from "../lib/store.svelte";
  import { setDragPayload } from "../lib/dragdrop";
  import { liveSelectionState } from "../lib/liveSelectionState.svelte";
  import Icon from "./Icon.svelte";
  import ConfirmDialog from "./ConfirmDialog.svelte";

  interface Props {
    tab: LiveTab;
  }

  let { tab }: Props = $props();
  let selected = $derived(liveSelectionState.isSelected(tab.chromeTabId));
  let showCloseConfirm = $state(false);

  function toOmitKind(t: LiveTab) {
    return { chromeTabId: t.chromeTabId, windowId: t.windowId, url: t.url, title: t.title, faviconUrl: t.faviconUrl };
  }

  // O navegador, por padrao, usa como imagem de arraste um "print" real da
  // regiao do elemento — capturado uma unica vez no instante do dragstart, o
  // que inclui o que estiver atras dele (o papel de parede, por exemplo)
  // transparecendo por baixo do fundo quase-transparente do `.live-tab`.
  // Relatado ao vivo pelo usuario como indesejado tanto no item unico (via
  // esse comportamento nativo) quanto na selecao em lote (a 1a versao desta
  // funcao, que clonava os elementos reais mas sem um fundo opaco proprio —
  // o fundo "selecionado" sozinho, rgba(255,255,255,0.08), e claro demais
  // pra garantir contraste quando a prevbalidacao sobrepoe o texto do grupo
  // de destino). Correcao: SEMPRE um drag image customizado (nunca o nativo,
  // nem para um unico item), clonando o(s) elemento(s) `.live-tab` de
  // verdade — mesmo CSS, mesma largura — dentro de um cartao com fundo
  // opaco proprio (nao depende mais da transparencia do elemento de baixo
  // nem do que estiver atras dele).
  const MAX_GHOST_ROWS = 6;

  function setDragGhostImage(event: DragEvent, elements: HTMLElement[], totalCount: number): void {
    if (elements.length === 0) return;

    // Mesma largura da linha real — sem isto o clone (fora do layout flex que
    // normalmente estica cada `.live-tab`) encolheria pro tamanho do
    // conteudo, e o titulo (que normalmente corta com reticencias) apareceria
    // por inteiro, destoando da lista real.
    const width = elements[0]!.getBoundingClientRect().width;

    const wrapper = document.createElement("div");
    Object.assign(wrapper.style, {
      position: "fixed",
      top: "-2000px",
      left: "-2000px",
      display: "flex",
      flexDirection: "column",
      gap: "2px",
      width: `${width}px`,
      padding: "4px",
      // Fundo opaco proprio — garante contraste de leitura mesmo quando o
      // ghost fica sobreposto ao texto do grupo onde vai ser solto (pedido
      // explicito do usuario: "deixa um pouco mais escuro o container").
      background: "rgba(20, 20, 20, 0.97)",
      borderRadius: "8px",
      boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
      pointerEvents: "none",
    });

    for (const el of elements.slice(0, MAX_GHOST_ROWS)) {
      wrapper.appendChild(el.cloneNode(true) as HTMLElement);
    }
    if (totalCount > MAX_GHOST_ROWS) {
      const more = document.createElement("div");
      more.textContent = `e mais ${totalCount - MAX_GHOST_ROWS}…`;
      Object.assign(more.style, { color: "#eaeaea", opacity: "0.7", fontSize: "11px", padding: "4px 6px" });
      wrapper.appendChild(more);
    }

    document.body.appendChild(wrapper);
    event.dataTransfer?.setDragImage(wrapper, 10, 10);
    setTimeout(() => wrapper.remove(), 0);
  }

  function handleDragStart(event: DragEvent) {
    // No modo de selecao, arrastar uma aba que faz parte da selecao arrasta
    // TODAS as selecionadas de uma vez — e exatamente o pedido do usuario
    // ("seleciona todos que quer, depois arrasta tudo de uma vez").
    if (liveSelectionState.active && selected && liveSelectionState.selected.length > 1) {
      const tabs = liveSelectionState.selected.map(toOmitKind);
      setDragPayload(event, { kind: "live-tabs-batch", tabs });
      const selectedEls = Array.from(document.querySelectorAll<HTMLElement>(".live-tab.selected"));
      setDragGhostImage(event, selectedEls, tabs.length);
      return;
    }
    setDragPayload(event, { kind: "live-tab", ...toOmitKind(tab) });
    // Mesmo tratamento pro item unico — ver nota acima: sem isto o navegador
    // usaria o snapshot nativo (com o papel de parede transparecendo atras).
    setDragGhostImage(event, [event.currentTarget as HTMLElement], 1);
  }

  function handleClick() {
    if (liveSelectionState.active) {
      liveSelectionState.toggle(tab);
      return;
    }
    chrome.tabs.update(tab.chromeTabId, { active: true });
    chrome.windows.update(tab.windowId, { focused: true });
  }

  function doCloseTab() {
    chrome.tabs.remove(tab.chromeTabId);
  }

  function closeTab(event: MouseEvent) {
    event.stopPropagation();
    if (store.config.confirmTabClose) {
      showCloseConfirm = true;
      return;
    }
    doCloseTab();
  }
</script>

<div class="live-tab" class:selected draggable="true" ondragstart={handleDragStart} role="listitem">
  <button class="tab-link" onclick={handleClick} title={tab.url}>
    {#if liveSelectionState.active}
      <span class="checkbox"><Icon name={selected ? "square-check" : "square"} size={18} /></span>
    {/if}
    {#if tab.faviconUrl}
      <img src={tab.faviconUrl} alt="" class="favicon" />
    {:else}
      <span class="favicon favicon-placeholder"></span>
    {/if}
    <span class="title">{tab.title}</span>
  </button>
  {#if !liveSelectionState.active}
    <button class="icon-button remove-button" onclick={closeTab} title="Fechar aba" aria-label="Fechar aba">
      <Icon name="x" size={14} />
    </button>
  {/if}
</div>

{#if showCloseConfirm}
  <ConfirmDialog
    title="Fechar aba"
    message={`Fechar "${tab.title}"? Se não estiver salva num grupo, será perdida.`}
    confirmLabel="Fechar aba"
    onConfirm={doCloseTab}
    onClose={() => (showCloseConfirm = false)}
  />
{/if}

<style>
  .live-tab {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 24px;
    padding: 4px 6px;
    border-radius: 6px;
  }
  .live-tab:hover,
  .live-tab.selected {
    background: rgba(255, 255, 255, 0.08);
  }
  .tab-link {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    min-width: 0;
    background: none;
    border: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
    padding: 0;
  }
  .checkbox {
    display: flex;
    flex-shrink: 0;
    opacity: 0.85;
  }
  .icon-button {
    background: none;
    border: none;
    cursor: pointer;
    display: flex;
    padding: 4px;
    flex-shrink: 0;
  }
  .remove-button {
    opacity: 0;
  }
  .live-tab:hover .remove-button {
    opacity: 0.5;
  }
  .remove-button:hover {
    opacity: 1;
  }
  .favicon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }
  .favicon-placeholder {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }
  .title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
  }
</style>
