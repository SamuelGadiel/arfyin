<script lang="ts">
  import Icon from "./Icon.svelte";

  interface Props {
    values: string[];
    onChange: (values: string[]) => void;
    search: (query: string) => Promise<string[]>;
    placeholder?: string;
  }
  let { values, onChange, search, placeholder = "" }: Props = $props();

  let text = $state("");
  let suggestions: string[] = $state([]);
  let open = $state(false);
  let debounceId: ReturnType<typeof setTimeout> | undefined;
  // Token de sequencia: descarta uma resposta de busca que chega depois de
  // uma mais recente ja ter sido aplicada (mesmo problema de race condition
  // ja resolvido em backgroundState.svelte.ts — digitar rapido dispara varias
  // buscas concorrentes, e a mais lenta nao pode sobrescrever o resultado da
  // mais rapida/recente).
  let searchSeq = 0;

  let sortedValues = $derived([...values].sort((a, b) => a.localeCompare(b)));

  async function runSearch(query: string) {
    const seq = ++searchSeq;
    const results = await search(query);
    if (seq !== searchSeq) return;
    suggestions = [...results.filter((r) => !values.includes(r))].sort((a, b) => a.localeCompare(b));
  }

  // Busca tambem com o campo vazio (ao focar) — sem isso o usuario precisava
  // digitar alguma coisa antes de ver qualquer sugestao, mesmo quando a fonte
  // (ex.: subreddits populares) tem um default razoavel sem nenhum texto.
  $effect(() => {
    const query = text;
    clearTimeout(debounceId);
    debounceId = setTimeout(() => runSearch(query), 300);
  });

  function handleFocus() {
    open = true;
  }

  function add(value: string) {
    const trimmed = value.trim();
    if (!trimmed || values.includes(trimmed)) return;
    onChange([...values, trimmed]);
    text = "";
    suggestions = suggestions.filter((s) => s !== trimmed);
  }

  function remove(value: string) {
    onChange(values.filter((v) => v !== value));
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      add(text);
    } else if (e.key === "Escape") {
      open = false;
    }
  }
</script>

<div class="tag-input">
  {#if sortedValues.length > 0}
    <div class="pills">
      {#each sortedValues as value (value)}
        <span class="pill">
          {value}
          <button class="pill-remove" onclick={() => remove(value)} aria-label={`Remover ${value}`} title="Remover">
            <Icon name="x" size={10} />
          </button>
        </span>
      {/each}
    </div>
  {/if}

  <div class="combo">
    <input
      class="text-input"
      type="text"
      bind:value={text}
      onkeydown={handleKeydown}
      onfocus={handleFocus}
      onblur={() => setTimeout(() => (open = false), 150)}
      {placeholder}
    />
    <button class="add-button" onclick={() => add(text)} disabled={!text.trim()} aria-label="Adicionar">
      Adicionar
    </button>
  </div>

  {#if open && suggestions.length > 0}
    <div class="suggestions">
      <span class="suggestions-label">Sugestões</span>
      <div class="suggestions-list">
        {#each suggestions as s (s)}
          <button class="suggestion" onmousedown={(e) => e.preventDefault()} onclick={() => add(s)}>{s}</button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .tag-input {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .pill {
    display: flex;
    align-items: center;
    gap: 4px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 999px;
    padding: 3px 4px 3px 10px;
    font-size: 12px;
  }
  .pill-remove {
    background: none;
    border: none;
    color: inherit;
    opacity: 0.6;
    display: flex;
    cursor: pointer;
    padding: 3px;
    border-radius: 50%;
  }
  .pill-remove:hover {
    opacity: 1;
    background: rgba(255, 255, 255, 0.15);
  }
  .combo {
    display: flex;
    gap: 6px;
  }
  .text-input {
    flex: 1;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: inherit;
    padding: 6px 8px;
    border-radius: 6px;
    font-size: 12px;
  }
  .add-button {
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: inherit;
    padding: 6px 10px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    white-space: nowrap;
  }
  .add-button:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.18);
  }
  .add-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .suggestions {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .suggestions-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    opacity: 0.5;
  }
  .suggestions-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    max-height: 140px;
    overflow-y: auto;
  }
  .suggestion {
    background: rgba(255, 255, 255, 0.06);
    border: none;
    color: inherit;
    padding: 4px 10px;
    border-radius: 999px;
    cursor: pointer;
    font-size: 12px;
  }
  .suggestion:hover {
    background: rgba(255, 255, 255, 0.15);
  }
</style>
