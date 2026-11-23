<script lang="ts">
  import { store } from "../lib/store.svelte";
  import Switch from "./Switch.svelte";

  let style = $derived(store.config.tabManagerStyle);

  function setColor(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    store.updateConfig({ tabManagerStyle: { ...style, containerColor: value } });
  }

  function setRadius(e: Event) {
    const value = Number((e.target as HTMLInputElement).value);
    store.updateConfig({ tabManagerStyle: { ...style, containerRadius: value } });
  }

  function setUngrouped(value: boolean) {
    store.setUngroupedEnabled(value);
  }

  function setConfirmTabClose(value: boolean) {
    store.updateConfig({ confirmTabClose: value });
  }
</script>

<div class="field">
  <span class="field-label">Cor do fundo dos painéis</span>
  <input class="text-input" type="text" value={style.containerColor} onchange={setColor} placeholder="rgba(18, 18, 18, 0.55)" />
</div>

<div class="field">
  <span class="field-label">Arredondamento <span class="field-value">{style.containerRadius}px</span></span>
  <input type="range" min="0" max="32" step="1" value={style.containerRadius} oninput={setRadius} />
</div>

<div class="field">
  <Switch checked={store.config.ungroupedEnabled} onChange={setUngrouped} label='Mostrar "Sem categoria" (abas fora de qualquer grupo)' />
  {#if store.config.ungroupedEnabled}
    <p class="hint">Desativar apaga permanentemente todas as abas que estiverem soltas agora.</p>
  {/if}
</div>

<div class="field">
  <Switch
    checked={store.config.confirmTabClose}
    onChange={setConfirmTabClose}
    label="Confirmar antes de fechar/remover abas"
  />
  <p class="hint">Vale para fechar uma aba viva (ou várias selecionadas) e para remover uma aba salva de um grupo. Apagar grupo e fechar janela inteira sempre confirmam.</p>
</div>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 16px;
  }
  .field-label {
    font-size: 12px;
    opacity: 0.75;
    display: flex;
    justify-content: space-between;
  }
  .field-value {
    opacity: 0.6;
    font-variant-numeric: tabular-nums;
  }
  .text-input {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: inherit;
    padding: 6px 8px;
    border-radius: 6px;
    font-size: 12px;
  }
  input[type="range"] {
    width: 100%;
    accent-color: #eaeaea;
  }
  .hint {
    font-size: 11px;
    opacity: 0.55;
    margin: 4px 0 0;
  }
</style>
