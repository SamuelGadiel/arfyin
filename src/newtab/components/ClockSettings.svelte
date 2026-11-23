<script lang="ts">
  import { store } from "../lib/store.svelte";
  import type { ClockDateFormat } from "@/shared/types";
  import ColorPicker from "./ColorPicker.svelte";

  let clock = $derived(store.config.clock);

  function setFontSize(e: Event) {
    const value = Number((e.target as HTMLInputElement).value);
    store.updateConfig({ clock: { ...clock, fontSize: value } });
  }

  function setFontWeight(e: Event) {
    const value = Number((e.target as HTMLInputElement).value);
    store.updateConfig({ clock: { ...clock, fontWeight: value } });
  }

  function setColor(value: string) {
    store.updateConfig({ clock: { ...clock, color: value } });
  }

  function setDateFormat(value: ClockDateFormat) {
    store.updateConfig({ clock: { ...clock, dateFormat: value } });
  }

  function setCustomDateFormat(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    store.updateConfig({ clock: { ...clock, customDateFormat: value } });
  }
</script>

<div class="field">
  <span class="field-label">Tamanho <span class="field-value">{clock.fontSize}px</span></span>
  <input type="range" min="24" max="180" step="4" value={clock.fontSize} oninput={setFontSize} />
</div>

<div class="field">
  <span class="field-label">Peso <span class="field-value">{clock.fontWeight}</span></span>
  <input type="range" min="100" max="900" step="100" value={clock.fontWeight} oninput={setFontWeight} />
</div>

<div class="field">
  <span class="field-label">Data</span>
  <div class="segmented wrap">
    <button class:active={clock.dateFormat === "long"} onclick={() => setDateFormat("long")}>Longa</button>
    <button class:active={clock.dateFormat === "short"} onclick={() => setDateFormat("short")}>Curta</button>
    <button class:active={clock.dateFormat === "numeric"} onclick={() => setDateFormat("numeric")}>Numérica</button>
    <button class:active={clock.dateFormat === "custom"} onclick={() => setDateFormat("custom")}>Customizada</button>
    <button class:active={clock.dateFormat === "hidden"} onclick={() => setDateFormat("hidden")}>Ocultar</button>
  </div>
  {#if clock.dateFormat === "custom"}
    <input
      class="text-input"
      type="text"
      value={clock.customDateFormat}
      onchange={setCustomDateFormat}
      placeholder="dddd, D 'de' MMMM"
    />
    <p class="hint">
      Tokens: <code>dddd</code>/<code>ddd</code> dia da semana, <code>MMMM</code>/<code>MMM</code>/<code>MM</code>/<code>M</code>
      mês, <code>DD</code>/<code>D</code> dia, <code>YYYY</code>/<code>YY</code> ano. Texto entre aspas simples (ex.: <code>'de'</code>)
      aparece literalmente, sem virar token.
    </p>
  {/if}
</div>

<div class="field">
  <span class="field-label">Cor</span>
  <ColorPicker value={clock.color} onChange={setColor} />
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
  .hint {
    font-size: 11px;
    opacity: 0.55;
    margin: 0;
  }
  .hint code {
    opacity: 0.85;
  }
  input[type="range"] {
    width: 100%;
    accent-color: #eaeaea;
  }
  .text-input {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: inherit;
    padding: 6px 8px;
    border-radius: 6px;
    font-size: 12px;
  }
  .segmented {
    display: flex;
    gap: 4px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 3px;
  }
  .segmented.wrap {
    flex-wrap: wrap;
  }
  .segmented button {
    flex: 1;
    background: none;
    border: none;
    color: inherit;
    opacity: 0.6;
    padding: 6px 10px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    white-space: nowrap;
  }
  .segmented button.active {
    background: rgba(255, 255, 255, 0.12);
    opacity: 1;
  }
  .segmented button:hover {
    opacity: 0.9;
  }
</style>
