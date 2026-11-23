<script lang="ts">
  import Icon from "./Icon.svelte";

  interface Props {
    title: string;
    onClose: () => void;
    /** Modais com conteudo denso (ex.: grid de icones) pedem mais largura que o padrao de 340px. */
    wide?: boolean;
    children: import("svelte").Snippet;
  }
  let { title, onClose, wide = false, children }: Props = $props();

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") onClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<button class="backdrop" onclick={onClose} aria-label="Fechar"></button>
<div class="modal" class:wide role="dialog" aria-modal="true" aria-label={title}>
  <header class="modal-header">
    <h3>{title}</h3>
    <button class="close" onclick={onClose} aria-label="Fechar"><Icon name="x" size={16} /></button>
  </header>
  <div class="modal-body">
    {@render children()}
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 49;
    background: rgba(0, 0, 0, 0.5);
    border: none;
    cursor: default;
  }
  .modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 50;
    width: 340px;
    max-width: 90vw;
    max-height: 85vh;
    overflow-y: auto;
    background: rgba(24, 24, 24, 0.98);
    backdrop-filter: blur(16px);
    border-radius: 12px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
    color: #eaeaea;
  }
  .modal.wide {
    width: 480px;
  }
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
  .modal-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }
  .close {
    background: none;
    border: none;
    color: inherit;
    opacity: 0.6;
    display: flex;
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
  }
  .close:hover {
    opacity: 1;
    background: rgba(255, 255, 255, 0.08);
  }
  .modal-body {
    padding: 16px;
  }
</style>
