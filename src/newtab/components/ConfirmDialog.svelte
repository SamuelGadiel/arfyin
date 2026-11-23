<script lang="ts">
  import Modal from "./Modal.svelte";

  interface Props {
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
    onConfirm: () => void;
    onClose: () => void;
  }
  let { title, message, confirmLabel = "Confirmar", danger = true, onConfirm, onClose }: Props = $props();

  function confirmAndClose() {
    onConfirm();
    onClose();
  }
</script>

<Modal {title} {onClose}>
  <p class="message">{message}</p>
  <div class="actions">
    <button class="cancel" onclick={onClose}>Cancelar</button>
    <button class="confirm" class:danger onclick={confirmAndClose}>{confirmLabel}</button>
  </div>
</Modal>

<style>
  .message {
    margin: 0 0 16px;
    font-size: 13px;
    opacity: 0.85;
  }
  .actions {
    display: flex;
    gap: 8px;
  }
  .cancel,
  .confirm {
    flex: 1;
    border: none;
    color: inherit;
    padding: 10px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
  }
  .cancel {
    background: rgba(255, 255, 255, 0.08);
  }
  .cancel:hover {
    background: rgba(255, 255, 255, 0.15);
  }
  .confirm {
    background: rgba(255, 255, 255, 0.15);
  }
  .confirm:hover {
    background: rgba(255, 255, 255, 0.25);
  }
  .confirm.danger {
    background: rgba(220, 70, 70, 0.3);
  }
  .confirm.danger:hover {
    background: rgba(220, 70, 70, 0.45);
  }
</style>
