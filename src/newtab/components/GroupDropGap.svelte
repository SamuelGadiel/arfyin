<script lang="ts">
  import { store } from "../lib/store.svelte";
  import { readDragPayload } from "../lib/dragdrop";
  import { groupDragState } from "../lib/groupDragState.svelte";

  interface Props {
    /** Posicao deste gap entre os grupos ordenados — 0 = antes do primeiro, length = depois do ultimo. */
    index: number;
  }

  let { index }: Props = $props();
  let isOver = $state(false);

  function handleDragEnter(event: DragEvent) {
    if (!groupDragState.draggingGroupId) return;
    event.preventDefault();
    isOver = true;
  }

  function handleDragOver(event: DragEvent) {
    if (!groupDragState.draggingGroupId) return;
    event.preventDefault();
    // Cursor de "mover" (seta), nao de "copiar" (+) — reordenar nao e uma
    // operacao de copia. Precisa ser setado aqui tambem (nao so no
    // dragstart): o navegador reavalia o dropEffect a cada dragover.
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  }

  function handleDragLeave() {
    isOver = false;
  }

  function handleDrop(event: DragEvent) {
    if (!groupDragState.draggingGroupId) return;
    event.preventDefault();
    isOver = false;
    const payload = readDragPayload(event);
    if (!payload || payload.kind !== "group") return;

    const sorted = [...store.groups].sort((a, b) => a.order - b.order);
    const draggedPos = sorted.findIndex((g) => g.id === payload.groupId);
    // `reorderGroup` recebe o indice na lista JA SEM o item arrastado. Se o
    // gap-alvo vem depois da posicao atual do grupo, remover o item desloca
    // tudo uma posicao pra tras.
    const targetIndex = draggedPos !== -1 && draggedPos < index ? index - 1 : index;
    store.reorderGroup(payload.groupId, targetIndex);
  }
</script>

<div
  class="group-gap"
  class:active={!!groupDragState.draggingGroupId}
  class:over={isOver}
  role="separator"
  aria-label="Soltar aqui para reordenar o grupo"
  ondragenter={handleDragEnter}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
></div>

<style>
  .group-gap {
    /* Agora e o unico responsavel pelo espacamento entre cards (os `.group`
       perderam o `margin-bottom` que tinham) — assim a linha de insercao
       abaixo fica centralizada no espaco visual real entre os dois cards
       vizinhos, nao descentralizada numa fracao dele. */
    height: 12px;
  }
  .group-gap.active {
    height: 24px;
    margin: -6px 0;
    position: relative;
    z-index: 1;
  }
  .group-gap.active.over::before {
    content: "";
    position: absolute;
    left: 4px;
    right: 4px;
    top: 50%;
    transform: translateY(-50%);
    height: 3px;
    border-radius: 2px;
    background: rgba(234, 234, 234, 0.9);
  }
</style>
