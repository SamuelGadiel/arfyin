<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { store } from "../lib/store.svelte";

  let now = $state(new Date());
  let intervalId: ReturnType<typeof setInterval> | undefined;

  onMount(() => {
    intervalId = setInterval(() => (now = new Date()), 1000);
  });

  onDestroy(() => {
    if (intervalId) clearInterval(intervalId);
  });

  /**
   * Detecta se o ambiente (locale do navegador/SO, normalmente herdado das
   * preferencias de regiao do sistema) usa relogio de 12h (AM/PM) ou 24h —
   * substitui o toggle manual que existia antes: simplifica a config e segue
   * o que o usuario ja configurou no proprio computador, sem duplicar essa
   * escolha dentro da extensao.
   */
  function detectHour12(): boolean {
    try {
      const parts = new Intl.DateTimeFormat(undefined, { hour: "numeric" }).formatToParts(
        new Date(2020, 0, 1, 13),
      );
      return parts.some((p) => p.type === "dayPeriod");
    } catch {
      return false;
    }
  }

  const hour12 = detectHour12();

  let timeText = $derived(
    new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", hour12 }).format(now),
  );

  const DATE_FORMAT_OPTIONS: Record<string, Intl.DateTimeFormatOptions> = {
    long: { weekday: "long", day: "2-digit", month: "long" },
    short: { weekday: "short", day: "2-digit", month: "short" },
    numeric: { day: "2-digit", month: "2-digit", year: "numeric" },
  };

  /**
   * Formato customizado por tokens (estilo Itsycal/strftime, simplificado):
   * dddd/ddd = dia da semana completo/abreviado, MMMM/MMM = mes por
   * extenso/abreviado, MM/M = mes numerico com/sem zero a esquerda,
   * DD/D = dia com/sem zero, YYYY/YY = ano completo/2 digitos. Texto entre
   * aspas simples ('de', 'às') e literal — nao vira token, as aspas somem
   * no resultado. Nomes de mes/dia respeitam o locale do navegador (via
   * Intl), sem lib nova. A ordem dos tokens importa: os mais longos vem
   * antes dos prefixos (ex.: "dddd" antes de "ddd") para nao substituir
   * parcialmente.
   */
  function formatCustomDate(date: Date, pattern: string): string {
    const weekdayLong = new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(date);
    const weekdayShort = new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date);
    const monthLong = new Intl.DateTimeFormat(undefined, { month: "long" }).format(date);
    const monthShort = new Intl.DateTimeFormat(undefined, { month: "short" }).format(date);
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    // Protege trechos entre aspas simples (texto literal) antes de aplicar os
    // tokens, senao um "D" ou "M" dentro do texto livre do usuario tambem
    // seria substituido por engano.
    const literals: string[] = [];
    const withPlaceholders = pattern.replace(/'([^']*)'/g, (_match, text: string) => {
      literals.push(text);
      return `\u0000${literals.length - 1}\u0000`;
    });

    const replacements: [RegExp, string][] = [
      [/dddd/g, weekdayLong],
      [/ddd/g, weekdayShort],
      [/MMMM/g, monthLong],
      [/MMM/g, monthShort],
      [/MM/g, String(month).padStart(2, "0")],
      [/M/g, String(month)],
      [/DD/g, String(day).padStart(2, "0")],
      [/D/g, String(day)],
      [/YYYY/g, String(year)],
      [/YY/g, String(year).slice(-2)],
    ];
    const withTokens = replacements.reduce((acc, [re, value]) => acc.replace(re, value), withPlaceholders);
    return withTokens.replace(/\u0000(\d+)\u0000/g, (_match, idx: string) => literals[Number(idx)] ?? "");
  }

  // `dateFormat` "hidden" nao tem entrada em DATE_FORMAT_OPTIONS (de proposito:
  // usar `null` como valor + `??` cairia sempre no fallback "long", ja que
  // `null ?? x` retorna `x`  — o guard precisa ser pela CHAVE, nao pelo valor).
  let dateText = $derived(
    store.config.clock.dateFormat === "hidden"
      ? null
      : store.config.clock.dateFormat === "custom"
        ? formatCustomDate(now, store.config.clock.customDateFormat)
        : new Intl.DateTimeFormat(
            undefined,
            DATE_FORMAT_OPTIONS[store.config.clock.dateFormat] ?? DATE_FORMAT_OPTIONS.long,
          ).format(now),
  );
</script>

<div class="clock" style:color={store.config.clock.color}>
  <span
    class="time"
    style:font-size={`clamp(24px, ${store.config.clock.fontSize}px, 22vw)`}
    style:font-weight={store.config.clock.fontWeight}
  >
    {timeText}
  </span>
  {#if dateText}
    <span class="date" class:auto-capitalize={store.config.clock.dateFormat !== "custom"}>{dateText}</span>
  {/if}
</div>

<style>
  .clock {
    display: block;
    width: 100%;
    text-align: center;
  }
  .time {
    display: block;
    letter-spacing: 2px;
  }
  .date {
    display: block;
    font-size: 14px;
    opacity: 0.6;
  }
  /* So capitaliza nos formatos automaticos (nomes de dia/mes vem em
     minusculo do Intl) — no formato customizado o texto e livre do usuario
     (ex.: preposicoes como "de" nao devem virar maiusculas). */
  .date.auto-capitalize {
    text-transform: capitalize;
  }
</style>
