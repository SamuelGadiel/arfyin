<script lang="ts">
  import { store } from "../lib/store.svelte";
  import { uiState } from "../lib/uiState.svelte";
  import type { LayoutMode, QuickAccessDisplayMode } from "@/shared/types";
  import ClockSettings from "./ClockSettings.svelte";
  import BackgroundSettings from "./BackgroundSettings.svelte";
  import TabManagerSettings from "./TabManagerSettings.svelte";
  import AuthControls from "./AuthControls.svelte";
  import BackupControls from "./BackupControls.svelte";
  import Icon from "./Icon.svelte";
  import Switch from "./Switch.svelte";

  const LAYOUTS: { value: LayoutMode; label: string; hint: string }[] = [
    { value: "coexistent", label: "Relógio + abas juntos", hint: "Relógio fixo no topo, abas logo abaixo." },
    { value: "scroll-reveal", label: "Relógio em tela cheia", hint: "Role a tela (ou ↓) para revelar as abas." },
    { value: "no-clock", label: "Sem relógio", hint: "Só a gestão de abas." },
  ];

  const QUICK_ACCESS_MODES: { value: QuickAccessDisplayMode; label: string }[] = [
    { value: "text", label: "Só texto" },
    { value: "icon-text", label: "Ícone + texto" },
    { value: "icon", label: "Só ícone" },
  ];

  function close() {
    uiState.settingsOpen = false;
  }

  function setLayout(value: LayoutMode) {
    store.updateConfig({ layoutMode: value });
  }

  function setQuickAccessDisplayMode(value: QuickAccessDisplayMode) {
    store.updateConfig({ quickAccessDisplayMode: value });
  }

  function setQuickAccessSlot(value: boolean) {
    store.updateConfig({ quickAccessShowSlot: value });
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && uiState.settingsOpen) close();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<button
  class="hamburger"
  onclick={() => (uiState.settingsOpen = true)}
  aria-label="Abrir configurações"
  title="Configurações"
>
  <Icon name="menu" size={18} />
</button>

{#if uiState.settingsOpen}
  <button class="backdrop" onclick={close} aria-label="Fechar configurações"></button>
  <aside class="drawer">
    <div class="drawer-header">
      <h2>Configurações</h2>
      <button class="close" onclick={close} aria-label="Fechar"><Icon name="x" size={16} /></button>
    </div>

    <div class="drawer-body">
      <section>
        <h3>Layout</h3>
        <div class="layout-options">
          {#each LAYOUTS as l (l.value)}
            <button class="layout-option" class:active={store.config.layoutMode === l.value} onclick={() => setLayout(l.value)}>
              <span class="layout-label">{l.label}</span>
              <span class="layout-hint">{l.hint}</span>
            </button>
          {/each}
        </div>
      </section>

      <section>
        <h3>Acesso rápido</h3>
        <div class="field">
          <span class="field-label">Exibição</span>
          <div class="layout-options inline">
            {#each QUICK_ACCESS_MODES as m (m.value)}
              <button
                class="inline-option"
                class:active={store.config.quickAccessDisplayMode === m.value}
                onclick={() => setQuickAccessDisplayMode(m.value)}
              >
                {m.label}
              </button>
            {/each}
          </div>
        </div>
        <Switch checked={store.config.quickAccessShowSlot} onChange={setQuickAccessSlot} label="Mostrar número do atalho" />
      </section>

      <section>
        <h3>Relógio</h3>
        <ClockSettings />
      </section>

      <section>
        <h3>Aparência</h3>
        <BackgroundSettings />
      </section>

      <section>
        <h3>Gestão de abas</h3>
        <TabManagerSettings />
      </section>

      <section>
        <h3>Conta</h3>
        <AuthControls />
      </section>

      <section>
        <h3>Dados</h3>
        <BackupControls />
      </section>
    </div>
  </aside>
{/if}

<style>
  .hamburger {
    position: fixed;
    top: 16px;
    left: 16px;
    z-index: 20;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #eaeaea;
    background: rgba(0, 0, 0, 0.35);
    border: none;
    border-radius: 8px;
    cursor: pointer;
  }
  .hamburger:hover {
    background: rgba(0, 0, 0, 0.5);
  }

  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 29;
    background: rgba(0, 0, 0, 0.45);
    border: none;
    cursor: default;
    animation: fade-in 0.15s ease;
  }

  .drawer {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 30;
    width: 340px;
    max-width: 88vw;
    background: rgba(16, 16, 16, 0.94);
    backdrop-filter: blur(16px);
    box-shadow: 4px 0 32px rgba(0, 0, 0, 0.5);
    color: #eaeaea;
    display: flex;
    flex-direction: column;
    animation: slide-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    flex-shrink: 0;
  }
  .drawer-header h2 {
    font-size: 15px;
    font-weight: 600;
    margin: 0;
  }
  .close {
    background: none;
    border: none;
    color: inherit;
    opacity: 0.6;
    display: flex;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
  }
  .close:hover {
    opacity: 1;
    background: rgba(255, 255, 255, 0.08);
  }

  .drawer-body {
    flex: 1;
    overflow-y: auto;
    padding: 4px 20px 24px;
  }

  section {
    padding: 22px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }
  section:last-child {
    border-bottom: none;
  }
  section h3 {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    opacity: 0.5;
    margin: 0 0 16px;
    font-weight: 600;
  }

  .layout-options {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .layout-option {
    display: flex;
    flex-direction: column;
    gap: 2px;
    align-items: flex-start;
    text-align: left;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid transparent;
    border-radius: 8px;
    padding: 10px 12px;
    cursor: pointer;
    color: inherit;
  }
  .layout-option:hover {
    background: rgba(255, 255, 255, 0.08);
  }
  .layout-option.active {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
  }
  .layout-label {
    font-size: 13px;
  }
  .layout-hint {
    font-size: 11px;
    opacity: 0.55;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 18px;
  }
  .field-label {
    font-size: 12px;
    opacity: 0.75;
  }
  .layout-options.inline {
    flex-direction: row;
    flex-wrap: wrap;
  }
  .inline-option {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid transparent;
    border-radius: 8px;
    padding: 6px 10px;
    cursor: pointer;
    color: inherit;
    font-size: 12px;
    opacity: 0.75;
  }
  .inline-option.active {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.2);
    opacity: 1;
  }

  @keyframes slide-in {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(0);
    }
  }
  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
</style>
