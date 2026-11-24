/**
 * Durante o arraste de um grupo inteiro (reordenar), os GroupItems precisam
 * saber que esse e o tipo de drag em andamento para desligar o highlight de
 * "soltar aba aqui dentro" (senao parece que o grupo arrastado vai ser
 * adicionado dentro do outro, nao reordenado) e para os gaps entre grupos
 * saberem quando se tornar visiveis/reativos. `dataTransfer.getData` so pode
 * ser lido no evento `drop` (restricao do navegador) — por isso esse estado
 * precisa existir fora do DataTransfer, atualizado direto no dragstart/dragend.
 */
export const groupDragState = $state<{ draggingGroupId: string | null }>({ draggingGroupId: null });
