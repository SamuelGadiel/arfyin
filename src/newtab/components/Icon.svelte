<script lang="ts">
  import { getIconBody } from "../lib/iconify";
  import { SEMANTIC_ICONS } from "../lib/icons";

  interface Props {
    /** Um nome semantico fixo (ver SEMANTIC_ICONS) ou, pros icones de grupo escolhidos no seletor, o nome bruto do icone na Hugeicons. */
    name: string;
    size?: number;
  }
  let { name, size = 16 }: Props = $props();

  let resolvedName = $derived(name in SEMANTIC_ICONS ? SEMANTIC_ICONS[name as keyof typeof SEMANTIC_ICONS] : name);
  let body: string | null = $state(null);

  $effect(() => {
    const target = resolvedName;
    body = null;
    getIconBody(target).then((b) => {
      // Descarta resposta atrasada de um nome que ja nao e mais o atual
      // (mesmo padrao de guarda usado no debounce do QuickAccessDialog).
      if (target === resolvedName) body = b;
    });
  });
</script>

{#if body}
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    {@html body}
  </svg>
{/if}
