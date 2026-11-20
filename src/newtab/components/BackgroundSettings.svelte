<script lang="ts">
  import { store } from "../lib/store.svelte";
  import { send } from "../lib/client";
  import type { BackgroundSourceKind } from "@/shared/types";

  let bg = $derived(store.config.background);
  let subredditsText = $derived(bg.subreddits.join(", "));

  function setSource(source: BackgroundSourceKind) {
    store.updateConfig({ background: { ...bg, source } });
  }

  function setSolidColor(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    store.updateConfig({ background: { ...bg, solidColor: value } });
  }

  function setSubreddits(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    const list = value.split(",").map((s) => s.trim()).filter(Boolean);
    store.updateConfig({ background: { ...bg, subreddits: list } });
  }

  function setDarken(e: Event) {
    const value = Number((e.target as HTMLInputElement).value);
    store.updateConfig({ background: { ...bg, darken: value } });
  }

  function setBlur(e: Event) {
    const value = Number((e.target as HTMLInputElement).value);
    store.updateConfig({ background: { ...bg, blur: value } });
  }

  function setFrequency(e: Event) {
    const value = Number((e.target as HTMLInputElement).value);
    store.updateConfig({ background: { ...bg, frequencyMinutes: value } });
  }

  async function uploadLocalImages(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    const newIds: string[] = [];
    for (const file of files) {
      const res = await send<"ASSET_ADDED">({ type: "ADD_ASSET", blob: file });
      if (res.type === "ASSET_ADDED") newIds.push(res.id);
    }
    store.updateConfig({ background: { ...bg, localAssetIds: [...bg.localAssetIds, ...newIds] } });
    input.value = "";
  }

  function setClockFontSize(e: Event) {
    const value = Number((e.target as HTMLInputElement).value);
    store.updateConfig({ clock: { ...store.config.clock, fontSize: value } });
  }

  function setClockColor(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    store.updateConfig({ clock: { ...store.config.clock, color: value } });
  }
</script>

<details class="settings">
  <summary>Aparência</summary>

  <fieldset>
    <legend>Background</legend>
    <label>
      Fonte:
      <select value={bg.source} onchange={(e) => setSource(e.currentTarget.value as BackgroundSourceKind)}>
        <option value="solid">Cor sólida</option>
        <option value="local">Imagens do computador</option>
        <option value="reddit">Subreddits</option>
        <option value="unsplash" disabled>Unsplash (precisa de API key — não configurado)</option>
      </select>
    </label>

    {#if bg.source === "solid"}
      <label>Cor: <input type="color" value={bg.solidColor} onchange={setSolidColor} /></label>
    {:else if bg.source === "reddit"}
      <label>
        Subreddits (separados por vírgula):
        <input type="text" value={subredditsText} onchange={setSubreddits} />
      </label>
    {:else if bg.source === "local"}
      <label>
        Imagens: <input type="file" accept="image/*" multiple onchange={uploadLocalImages} />
      </label>
      <p class="hint">{bg.localAssetIds.length} imagem(ns) salva(s).</p>
    {/if}

    <label>Escurecer: <input type="range" min="0" max="1" step="0.05" value={bg.darken} onchange={setDarken} /></label>
    <label>Desfoque: <input type="range" min="0" max="20" step="1" value={bg.blur} onchange={setBlur} /></label>
    <label>
      Trocar a cada (min, 0 = travado):
      <input type="number" min="0" value={bg.frequencyMinutes} onchange={setFrequency} />
    </label>
  </fieldset>

  <fieldset>
    <legend>Relógio</legend>
    <label>Tamanho: <input type="range" min="24" max="96" step="4" value={store.config.clock.fontSize} onchange={setClockFontSize} /></label>
    <label>Cor: <input type="color" value={store.config.clock.color} onchange={setClockColor} /></label>
  </fieldset>
</details>

<style>
  .settings {
    font-size: 12px;
    margin-bottom: 8px;
  }
  summary {
    cursor: pointer;
    opacity: 0.7;
  }
  fieldset {
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    margin-top: 6px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  label {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .hint {
    opacity: 0.6;
    margin: 0;
  }
</style>
