<script lang="ts">
  import { PASTEL_PALETTE } from "../lib/palette";
  import Icon from "./Icon.svelte";

  interface Props {
    value: string | null;
    onChange: (color: string) => void;
    /** Mostra o botão "sem cor" (usado no GroupDialog). */
    allowNone?: boolean;
    onNone?: () => void;
  }
  let { value, onChange, allowNone = false, onNone }: Props = $props();

  // A cor customizada é uma escolha independente das predefinidas — clicar
  // numa predefinida nunca deve "contaminar" o que o seletor customizado
  // guarda. Semeado uma vez: se o valor atual já não é nenhuma predefinida,
  // assume que foi o próprio seletor customizado que o produziu.
  let customValue = $state(value && !PASTEL_PALETTE.includes(value) ? value : "#eaeaea");

  function pickCustom(e: Event) {
    const next = (e.target as HTMLInputElement).value;
    customValue = next;
    onChange(next);
  }
</script>

<div class="palette">
  {#if allowNone}
    <button class="swatch none" class:active={value === null} onclick={() => onNone?.()} aria-label="Sem cor" title="Sem cor">
      <Icon name="x" size={12} />
    </button>
  {/if}
  {#each PASTEL_PALETTE as swatch (swatch)}
    <button
      class="swatch"
      class:active={value === swatch}
      style:background={swatch}
      onclick={() => onChange(swatch)}
      aria-label={`Cor ${swatch}`}
    ></button>
  {/each}
  <label class="swatch custom" class:active={value === customValue} title="Cor customizada">
    <Icon name="droplet" size={14} />
    <input type="color" value={customValue} onchange={pickCustom} aria-label="Cor customizada" />
  </label>
</div>

<style>
  .palette {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  .swatch {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    padding: 0;
  }
  .swatch.active {
    border-color: #fff;
  }
  .swatch.none {
    background: rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.6;
  }
  .swatch.custom {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.1);
    color: inherit;
    opacity: 0.85;
    overflow: hidden;
  }
  .swatch.custom:hover {
    opacity: 1;
    background: rgba(255, 255, 255, 0.18);
  }
  .swatch.custom input[type="color"] {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
    border: none;
    padding: 0;
  }
</style>
