<script lang="ts">
  import Modal from "./Modal.svelte";

  interface Props {
    /** Pre-preenche o formulario (ex.: "virar acesso rapido" numa aba ja aberta/salva) — null/omitido = formulario vazio, fluxo manual de sempre. */
    initial?: { title: string; url: string } | null;
    onSave: (title: string, url: string) => void;
    onClose: () => void;
  }
  let { initial = null, onSave, onClose }: Props = $props();

  let url = $state(initial?.url ?? "");
  let title = $state(initial?.title ?? "");

  /** Normaliza para ter protocolo (usuarios costumam colar so "google.com.br"). */
  function normalizeUrl(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return trimmed;
    return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  }

  let normalizedUrl = $derived(normalizeUrl(url));

  // Debounce (300ms): sem isto, cada tecla digitada disparava uma requisicao
  // de rede real pro servico de favicon (confirmado ao vivo — dezenas de
  // pedidos abortados/404 pra cada estado parcial da URL, tipo "h", "ht",
  // "htt"...). So busca depois que o usuario para de digitar por um instante.
  let faviconUrl: string | null = $state(null);
  let debounceId: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const target = normalizedUrl;
    clearTimeout(debounceId);
    if (!target) {
      faviconUrl = null;
      return;
    }
    debounceId = setTimeout(() => {
      faviconUrl = `https://www.google.com/s2/favicons?sz=32&domain_url=${encodeURIComponent(target)}`;
    }, 300);
  });

  /** "https://www.google.com.br" -> "google" — tira "www.", pega so o primeiro rotulo do dominio. */
  function titleFromUrl(value: string): string {
    try {
      const hostname = new URL(value).hostname.replace(/^www\./, "");
      return hostname.split(".")[0] || hostname;
    } catch {
      return value;
    }
  }

  function submit() {
    if (!normalizedUrl) return;
    const finalTitle = title.trim() || titleFromUrl(normalizedUrl);
    onSave(finalTitle, normalizedUrl);
    onClose();
  }

  function handleFormKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  }
</script>

<Modal title="Novo acesso rápido" {onClose}>
  <div class="field">
    <span class="field-label">Título (opcional — sem isso, usa o nome do site)</span>
    <!-- svelte-ignore a11y_autofocus -->
    <input
      class="text-input"
      type="text"
      bind:value={title}
      onkeydown={handleFormKeydown}
      autofocus
      placeholder={normalizedUrl ? titleFromUrl(normalizedUrl) : "Nome do atalho"}
    />
  </div>

  <div class="field">
    <span class="field-label">URL</span>
    <input class="text-input" type="text" bind:value={url} onkeydown={handleFormKeydown} placeholder="https://exemplo.com" />
  </div>

  {#if normalizedUrl}
    <div class="preview">
      {#if faviconUrl}<img src={faviconUrl} alt="" class="favicon" />{/if}
      <span class="preview-title">{title.trim() || titleFromUrl(normalizedUrl)}</span>
    </div>
  {/if}

  <button class="submit" onclick={submit} disabled={!normalizedUrl}>Adicionar</button>
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
  .preview {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 8px 10px;
    margin-bottom: 16px;
    font-size: 13px;
  }
  .favicon {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }
  .preview-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
