<script lang="ts">
  import Modal from "./Modal.svelte";
  import Icon from "./Icon.svelte";
  import ColorPicker from "./ColorPicker.svelte";
  import { store } from "../lib/store.svelte";
  import { listAllIconNames } from "../lib/iconify";

  const PAGE_SIZE = 48;

  interface Props {
    /** `null` = criando um grupo novo; preenchido = editando um existente. */
    initial?: { name: string; color: string | null; icon: string | null } | null;
    onSave: (name: string, color: string | null, icon: string | null) => void;
    onClose: () => void;
  }
  let { initial = null, onSave, onClose }: Props = $props();

  let name = $state(initial?.name ?? "");
  let color = $state(initial?.color ?? null);
  let icon = $state(initial?.icon ?? null);

  let style = $derived(store.config.tabManagerStyle);

  // Catalogo inteiro da Hugeicons (~6100 nomes) buscado uma unica vez e
  // cacheado (ver iconify.ts) — o filtro por texto digitado acontece aqui no
  // cliente, instantaneo, sem nova requisicao a cada tecla. `visibleCount`
  // implementa "mostrar mais" sem precisar renderizar os ~6100 de uma vez.
  let allIconNames: string[] = $state([]);
  let iconQuery = $state("");
  let visibleCount = $state(PAGE_SIZE);

  listAllIconNames().then((names) => (allIconNames = names));

  let filteredIconNames = $derived(
    iconQuery.trim()
      ? allIconNames.filter((n) => n.includes(iconQuery.trim().toLowerCase()))
      : allIconNames,
  );
  let visibleIconNames = $derived(filteredIconNames.slice(0, visibleCount));

  function searchIcons(e: Event) {
    iconQuery = (e.target as HTMLInputElement).value;
    visibleCount = PAGE_SIZE;
  }

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed, color, icon);
    onClose();
  }

  function handleFormKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  }
</script>

<Modal title={initial ? "Editar grupo" : "Novo grupo"} {onClose}>
  <div class="field">
    <span class="field-label">Nome</span>
    <!-- svelte-ignore a11y_autofocus -->
    <input class="text-input" type="text" bind:value={name} onkeydown={handleFormKeydown} autofocus placeholder="Nome do grupo" />
  </div>

  <div class="field">
    <span class="field-label">Cor</span>
    <ColorPicker value={color} onChange={(v) => (color = v)} allowNone onNone={() => (color = null)} />
  </div>

  <div class="field">
    <span class="field-label">Ícone ({filteredIconNames.length} de {allIconNames.length})</span>
    <input class="text-input" type="text" value={iconQuery} oninput={searchIcons} placeholder="Buscar ícone…" />
    <div class="icon-grid">
      <button class="icon-option none" class:active={icon === null} onclick={() => (icon = null)} aria-label="Sem ícone" title="Sem ícone">
        <Icon name="x" size={14} />
      </button>
      {#each visibleIconNames as opt (opt)}
        <button class="icon-option" class:active={icon === opt} onclick={() => (icon = opt)} aria-label={`Ícone ${opt}`} title={opt}>
          <Icon name={opt} size={16} />
        </button>
      {/each}
    </div>
    {#if visibleCount < filteredIconNames.length}
      <button class="more-icons" onclick={() => (visibleCount += PAGE_SIZE)}>
        Mostrar mais ({filteredIconNames.length - visibleCount} restantes)
      </button>
    {/if}
  </div>

  <div class="field">
    <span class="field-label">Pré-visualização (grupo colapsado, vazio)</span>
    <!--
      Mesma estrutura/CSS de GroupItem.svelte (.group/.group-header), pra ser
      fiel de verdade: cor como borda na borda esquerda do CONTAINER inteiro,
      contador logo apos o nome, botoes de acao presentes (inertes aqui, so
      pra mostrar o espacamento real) — nao uma aproximacao com classes
      proprias que divergem do card real.
    -->
    <div
      class="group preview"
      style:background={style.containerColor}
      style:border-radius="{style.containerRadius}px"
      style:border-left-color={color ?? "transparent"}
    >
      <header class="group-header">
        <span class="collapse-toggle"><Icon name="chevron-down" size={14} /></span>
        {#if icon}<span class="icon"><Icon name={icon} size={15} /></span>{/if}
        <span class="name">{name.trim() || "Nome do grupo"}</span>
        <span class="count">0</span>
        <span class="spacer"></span>
        <span class="icon-button"><Icon name="external-link" size={15} /></span>
        <span class="icon-button"><Icon name="pencil" size={15} /></span>
        <span class="icon-button"><Icon name="trash" size={15} /></span>
      </header>
    </div>
  </div>

  <button class="submit" onclick={submit} disabled={!name.trim()}>{initial ? "Salvar" : "Criar grupo"}</button>
</Modal>

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
  }
  .text-input {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: inherit;
    padding: 8px 10px;
    border-radius: 6px;
    font-size: 13px;
  }
  .icon-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 6px;
    max-height: 220px;
    overflow-y: auto;
    padding-right: 2px;
  }
  .icon-option {
    background: rgba(255, 255, 255, 0.05);
    border: 2px solid transparent;
    border-radius: 8px;
    padding: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.75;
  }
  .icon-option.active {
    border-color: #fff;
    background: rgba(255, 255, 255, 0.12);
    opacity: 1;
  }
  .icon-option.none {
    opacity: 0.6;
  }
  .more-icons {
    background: rgba(255, 255, 255, 0.06);
    border: none;
    color: inherit;
    opacity: 0.75;
    padding: 6px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 11px;
  }
  .more-icons:hover {
    opacity: 1;
  }

  /* Copiado de GroupItem.svelte de proposito (ver comentario no template) — duplicacao aceita pra garantir fidelidade visual exata. */
  .group {
    border-left: 3px solid transparent;
    padding: 4px 10px 8px;
  }
  .group-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 600;
    padding: 6px 0;
  }
  .collapse-toggle {
    display: flex;
    opacity: 0.7;
  }
  .icon {
    display: flex;
    opacity: 0.8;
  }
  .name {
    font-weight: 600;
  }
  .count {
    font-size: 11px;
    opacity: 0.5;
    font-weight: 400;
  }
  .spacer {
    flex: 1;
  }
  .icon-button {
    display: flex;
    opacity: 0.5;
    padding: 4px;
  }

  .submit {
    width: 100%;
    background: rgba(255, 255, 255, 0.12);
    border: none;
    color: inherit;
    padding: 10px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
  }
  .submit:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.2);
  }
  .submit:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
