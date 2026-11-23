<script lang="ts">
  import { store } from "../lib/store.svelte";
  import { send } from "../lib/client";
  import type { BackgroundConfig, BackgroundRotationMode, BackgroundSourceKind } from "@/shared/types";
  import Icon from "./Icon.svelte";
  import ColorPicker from "./ColorPicker.svelte";
  import TagInput from "./TagInput.svelte";
  import { searchSubreddits, searchUnsplashTopics } from "../lib/backgroundSuggestions";

  let bg = $derived(store.config.background);
  let unsplashConfigured = Boolean(import.meta.env.VITE_UNSPLASH_ACCESS_KEY);

  const SOURCES: { value: BackgroundSourceKind; label: string; disabled?: boolean }[] = [
    { value: "solid", label: "Cor sólida" },
    { value: "local", label: "Imagens" },
    { value: "reddit", label: "Reddit" },
    { value: "unsplash", label: "Unsplash", disabled: !unsplashConfigured },
  ];

  const ROTATION_MODES: { value: BackgroundRotationMode; label: string; hint: string }[] = [
    { value: "static", label: "Estático", hint: "Uma única imagem fixa — navegue com ‹/› para escolher qual." },
    { value: "per-tab", label: "Nova aba", hint: "Cada nova aba sorteia uma imagem diferente." },
    { value: "timed", label: "Cíclico por tempo", hint: "Troca sozinho a cada N minutos, mesmo na mesma aba." },
  ];

  function updateBackground(patch: Partial<BackgroundConfig>) {
    store.updateConfig({ background: { ...bg, ...patch } });
  }

  // Mudar fonte/parametros/modo invalida o candidato travado anterior (pode
  // nem existir mais no novo pool) — sempre reseta `pausedKey` nessas trocas
  // para nao deixar um "fantasma" apontando pra nada.
  function setSource(source: BackgroundSourceKind) {
    updateBackground({ source, pausedKey: null });
  }

  function setRotationMode(rotationMode: BackgroundRotationMode) {
    // `timedStartedAt` reinicia sempre que o modo muda — um timestamp antigo
    // geraria um indice "no meio do ciclo" em vez de comecar do primeiro.
    // `frequencyMinutes` pode ter sobrevivido como `0` de uma config salva
    // antes do ARF-153 (onde 0 significava "travado") — sem sentido como
    // minutos agora, corrige para um default razoavel ao entrar em "timed".
    const frequencyMinutes = rotationMode === "timed" && bg.frequencyMinutes < 1 ? 30 : bg.frequencyMinutes;
    updateBackground({ rotationMode, pausedKey: null, timedStartedAt: Date.now(), frequencyMinutes });
  }

  function setSolidColor(value: string) {
    updateBackground({ solidColor: value });
  }

  function setSubreddits(list: string[]) {
    updateBackground({ subreddits: list, pausedKey: null });
  }

  function setUnsplashTopics(list: string[]) {
    updateBackground({ unsplashTopics: list, pausedKey: null });
  }

  function setDarken(e: Event) {
    const value = Number((e.target as HTMLInputElement).value);
    updateBackground({ darken: value });
  }

  function setBlur(e: Event) {
    const value = Number((e.target as HTMLInputElement).value);
    updateBackground({ blur: value });
  }

  function setFrequency(e: Event) {
    const value = Number((e.target as HTMLInputElement).value);
    updateBackground({ frequencyMinutes: Math.max(1, value), timedStartedAt: Date.now() });
  }

  const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

  async function uploadLocalImages(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    const newIds: string[] = [];
    const rejected: string[] = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        rejected.push(`${file.name} (não é imagem)`);
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        rejected.push(`${file.name} (maior que 10MB)`);
        continue;
      }
      const res = await send<"ASSET_ADDED">({ type: "ADD_ASSET", blob: file });
      if (res.type === "ASSET_ADDED") newIds.push(res.id);
    }
    if (rejected.length > 0) alert(`Ignorado(s):\n${rejected.join("\n")}`);
    updateBackground({ localAssetIds: [...bg.localAssetIds, ...newIds], pausedKey: null });
    input.value = "";
  }

  async function removeLocalImage(id: string) {
    await send({ type: "DELETE_ASSET", id });
    updateBackground({ localAssetIds: bg.localAssetIds.filter((x) => x !== id), pausedKey: null });
  }
</script>

<div class="field">
  <span class="field-label">Fonte</span>
  <div class="segmented wrap">
    {#each SOURCES as s (s.value)}
      <button class:active={bg.source === s.value} disabled={s.disabled} onclick={() => setSource(s.value)}>
        {s.label}
      </button>
    {/each}
  </div>
  {#if bg.source === "unsplash" && !unsplashConfigured}
    <p class="hint">Precisa de uma API key da Unsplash — ver <code>.env.example</code>.</p>
  {/if}
</div>

{#if bg.source === "solid"}
  <div class="field">
    <span class="field-label">Cor</span>
    <ColorPicker value={bg.solidColor} onChange={setSolidColor} />
  </div>
{:else}
  {#if bg.source === "reddit"}
    <div class="field">
      <span class="field-label">Subreddits (todos entram no ciclo)</span>
      <TagInput values={bg.subreddits} onChange={setSubreddits} search={searchSubreddits} placeholder="Buscar subreddit…" />
    </div>
  {:else if bg.source === "unsplash"}
    <div class="field">
      <span class="field-label">Tópicos (todos entram no ciclo)</span>
      <TagInput values={bg.unsplashTopics} onChange={setUnsplashTopics} search={searchUnsplashTopics} placeholder="Buscar tópico…" />
    </div>
  {:else if bg.source === "local"}
    <div class="field">
      <span class="field-label">Imagens ({bg.localAssetIds.length} salva(s), máx. 10MB cada)</span>
      <input type="file" accept="image/*" multiple onchange={uploadLocalImages} />
      {#if bg.localAssetIds.length > 0}
        <ul class="asset-list">
          {#each bg.localAssetIds as id (id)}
            <li>
              <span>Imagem {id.slice(0, 8)}</span>
              <button class="remove-asset" onclick={() => removeLocalImage(id)} aria-label="Remover imagem" title="Remover">
                <Icon name="x" size={12} />
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}

  <div class="field">
    <span class="field-label">Comportamento</span>
    <div class="segmented wrap">
      {#each ROTATION_MODES as m (m.value)}
        <button class:active={bg.rotationMode === m.value} onclick={() => setRotationMode(m.value)}>{m.label}</button>
      {/each}
    </div>
    <p class="hint">{ROTATION_MODES.find((m) => m.value === bg.rotationMode)?.hint}</p>
  </div>

  {#if bg.rotationMode === "timed"}
    <div class="field">
      <span class="field-label">Trocar a cada (minutos)</span>
      <input class="text-input" type="number" min="1" value={bg.frequencyMinutes} onchange={setFrequency} />
    </div>
  {/if}
{/if}

<div class="field">
  <span class="field-label">Escurecer <span class="field-value">{Math.round(bg.darken * 100)}%</span></span>
  <input type="range" min="0" max="1" step="0.05" value={bg.darken} oninput={setDarken} />
</div>

<div class="field">
  <span class="field-label">Desfoque <span class="field-value">{bg.blur}px</span></span>
  <input type="range" min="0" max="20" step="1" value={bg.blur} oninput={setBlur} />
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
  .text-input,
  input[type="file"] {
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
  .segmented button:hover:not(:disabled) {
    opacity: 0.9;
  }
  .segmented button:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  .asset-list {
    list-style: none;
    margin: 4px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .asset-list li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 6px;
    padding: 4px 8px;
    font-size: 11px;
    opacity: 0.8;
  }
  .remove-asset {
    background: none;
    border: none;
    color: inherit;
    opacity: 0.6;
    display: flex;
    cursor: pointer;
    padding: 2px 6px;
  }
  .remove-asset:hover {
    opacity: 1;
  }
</style>
