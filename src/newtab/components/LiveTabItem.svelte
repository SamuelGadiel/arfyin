<script lang="ts">
  import type { LiveTab } from "@/shared/types";
  import { store } from "../lib/store.svelte";
  import { setDragPayload } from "../lib/dragdrop";
  import { liveSelectionState } from "../lib/liveSelectionState.svelte";
  import Icon from "./Icon.svelte";
  import ConfirmDialog from "./ConfirmDialog.svelte";
  import QuickAccessDialog from "./QuickAccessDialog.svelte";

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

  const GHOST_PADDING = 4;
  const GHOST_GAP = 2;

  function setDragGhostImage(event: DragEvent, elements: HTMLElement[], totalCount: number, draggedElement: HTMLElement): void {
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
      gap: `${GHOST_GAP}px`,
      width: `${width}px`,
      padding: `${GHOST_PADDING}px`,
      // Fundo opaco proprio — garante contraste de leitura mesmo quando o
      // ghost fica sobreposto ao texto do grupo onde vai ser solto (pedido
      // explicito do usuario: "deixa um pouco mais escuro o container").
      background: "rgba(20, 20, 20, 0.97)",
      borderRadius: "8px",
      boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
      pointerEvents: "none",
    });

    const visible = elements.slice(0, MAX_GHOST_ROWS);
    for (const el of visible) {
      wrapper.appendChild(el.cloneNode(true) as HTMLElement);
    }
    if (totalCount > MAX_GHOST_ROWS) {
      const more = document.createElement("div");
      more.textContent = `e mais ${totalCount - MAX_GHOST_ROWS}…`;
      Object.assign(more.style, { color: "#eaeaea", opacity: "0.7", fontSize: "11px", padding: "4px 6px" });
      wrapper.appendChild(more);
    }

    document.body.appendChild(wrapper);

    // Posiciona o ghost de forma que o cursor fique exatamente onde o usuario
    // pegou a aba (relatado ao vivo: estava sempre usando um offset fixo,
    // entao segurar o item pelo meio fazia a pre-visualizacao "pular" pro
    // canto superior esquerdo ficar embaixo do cursor, em vez de manter o
    // ponto onde o usuario realmente clicou). offset = onde o cursor estava
    // DENTRO do elemento arrastado + o deslocamento desse elemento dentro do
    // cartao empilhado (padding + altura das linhas anteriores, quando a aba
    // arrastada nao e a primeira da selecao).
    const draggedRect = draggedElement.getBoundingClientRect();
    const offsetXWithinRow = event.clientX - draggedRect.left;
    const offsetYWithinRow = event.clientY - draggedRect.top;

    let rowIndex = visible.indexOf(draggedElement);
    if (rowIndex === -1) rowIndex = visible.length - 1; // fora da faixa visivel (truncada pelo "+N")

    let offsetY = GHOST_PADDING + offsetYWithinRow;
    for (let i = 0; i < rowIndex; i++) {
      offsetY += visible[i]!.getBoundingClientRect().height + GHOST_GAP;
    }
    const offsetX = GHOST_PADDING + offsetXWithinRow;

    event.dataTransfer?.setDragImage(wrapper, offsetX, offsetY);
    setTimeout(() => wrapper.remove(), 0);
  }

  function handleDragStart(event: DragEvent) {
    const draggedElement = event.currentTarget as HTMLElement;
    // No modo de selecao, arrastar uma aba que faz parte da selecao arrasta
    // TODAS as selecionadas de uma vez — e exatamente o pedido do usuario
    // ("seleciona todos que quer, depois arrasta tudo de uma vez").
    if (liveSelectionState.active && selected && liveSelectionState.selected.length > 1) {
      const tabs = liveSelectionState.selected.map(toOmitKind);
      setDragPayload(event, { kind: "live-tabs-batch", tabs });
      const selectedEls = Array.from(document.querySelectorAll<HTMLElement>(".live-tab.selected"));
      setDragGhostImage(event, selectedEls, tabs.length, draggedElement);
      return;
    }
    setDragPayload(event, { kind: "live-tab", ...toOmitKind(tab) });
    // Mesmo tratamento pro item unico — ver nota acima: sem isto o navegador
    // usaria o snapshot nativo (com o papel de parede transparecendo atras).
    setDragGhostImage(event, [draggedElement], 1, draggedElement);
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

  let isQuickAccess = $derived(store.isQuickAccess(tab.url));
  let showQuickAccessDialog = $state(false);

  // Adicionar abre o popup de "Novo acesso rapido" ja preenchido (o usuario
  // pediu pra poder revisar/editar titulo e URL antes de confirmar, em vez de
  // adicionar direto) — remover, por outro lado, nao precisa de nenhum dado
  // novo, entao continua direto.
  function handleQuickAccessClick(event: MouseEvent) {
    event.stopPropagation();
    if (isQuickAccess) {
      store.removeQuickAccessByUrl(tab.url);
    } else {
      showQuickAccessDialog = true;
    }
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
    <button
      class="icon-button quick-access-button"
      class:active={isQuickAccess}
      onclick={handleQuickAccessClick}
      title={isQuickAccess ? "Remover do acesso rápido" : "Adicionar ao acesso rápido"}
      aria-label={isQuickAccess ? "Remover do acesso rápido" : "Adicionar ao acesso rápido"}
    >
      <Icon name="quick-access" size={14} />
    </button>
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

{#if showQuickAccessDialog}
  <QuickAccessDialog
    initial={{ title: tab.title, url: tab.url }}
    onSave={(title, url) => store.addQuickAccess(title, url)}
    onClose={() => (showQuickAccessDialog = false)}
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
  .quick-access-button {
    opacity: 0;
  }
  .live-tab:hover .quick-access-button {
    opacity: 0.5;
  }
  .quick-access-button:hover {
    opacity: 1;
  }
  .quick-access-button.active {
    /* So tinge de verde — visibilidade continua so-no-hover, igual ao
       remove-button (pedido do usuario: nao deixar o raio sempre visivel). */
    color: #7fd1a3;
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
