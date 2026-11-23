import { store } from "./store.svelte";
import { send } from "./client";
import {
  extractImageUrls,
  extractUnsplashCandidates,
  type BackgroundCandidate,
  type MinimalRedditPost,
  type MinimalUnsplashPhoto,
} from "@/shared/backgroundSource";
import type { BackgroundRotationMode, BackgroundSourceKind } from "@/shared/types";

// Cache de candidatos (reddit/unsplash) persistido no background — evita bater
// na rede (e no rate limit do Unsplash) a cada new-tab aberta. Fresco por ate
// 1h; depois disso, mostra o cache (instantaneo) e atualiza em paralelo para a
// PROXIMA aba, sem trocar a imagem desta aba no meio da sessao.
const CACHE_TTL_MS = 60 * 60_000;

async function fetchUnsplashRandom(topic: string, accessKey: string, landscapeOnly: boolean) {
  const orientationParam = landscapeOnly ? "&orientation=landscape" : "";
  const res = await fetch(
    `https://api.unsplash.com/photos/random?query=${encodeURIComponent(topic)}&count=10${orientationParam}`,
    { headers: { Authorization: `Client-ID ${accessKey}` } },
  );
  const photos = (await res.json()) as MinimalUnsplashPhoto[];
  return extractUnsplashCandidates(Array.isArray(photos) ? photos : []);
}

interface BgSpec {
  source: BackgroundSourceKind;
  subreddits: string[];
  unsplashTopics: string[];
  localAssetIds: string[];
  pausedKey: string | null;
  rotationMode: BackgroundRotationMode;
  frequencyMinutes: number;
  timedStartedAt: number;
}

function parseBgSpec(key: string): BgSpec {
  const [
    source,
    subreddits,
    unsplashTopics,
    localAssetIds,
    pausedKey,
    rotationMode,
    frequencyMinutes,
    timedStartedAt,
  ] = JSON.parse(key) as [
    BackgroundSourceKind,
    string[],
    string[],
    string[],
    string | null,
    BackgroundRotationMode,
    number,
    number,
  ];
  return {
    source,
    subreddits,
    unsplashTopics,
    localAssetIds,
    pausedKey,
    rotationMode,
    frequencyMinutes,
    timedStartedAt,
  };
}

/**
 * Busca candidatos de TODAS as fontes configuradas (todos os subreddits ou
 * topicos, nao so um sorteado) e combina — e isso que faz "ciclar entre
 * varios ao mesmo tempo" funcionar de verdade: o pool de candidatos passa a
 * conter imagens de cada um deles, em vez de travar numa fonte escolhida ao
 * acaso a cada atualizacao de cache.
 */
async function fetchFreshCandidates(spec: BgSpec): Promise<BackgroundCandidate[]> {
  if (spec.source === "reddit" && spec.subreddits.length > 0) {
    const perSubreddit = await Promise.all(
      spec.subreddits.map(async (subreddit) => {
        try {
          const res = await fetch(`https://www.reddit.com/r/${subreddit}/top.json?limit=25&t=week`);
          const json = await res.json();
          const posts = (json?.data?.children ?? []) as MinimalRedditPost[];
          return extractImageUrls(posts);
        } catch {
          return [];
        }
      }),
    );
    return perSubreddit.flat();
  }
  if (spec.source === "unsplash" && spec.unsplashTopics.length > 0) {
    const accessKey = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;
    if (!accessKey) return [];
    const perTopic = await Promise.all(
      spec.unsplashTopics.map(async (topic) => {
        try {
          // `orientation=landscape` e parametro oficial da API (evita papel de
          // parede em retrato cortando muito ao esticar pra tela cheia — mesmo
          // ajuste feito no lado do reddit em backgroundSource.ts). Mesma
          // rede de seguranca do lado do reddit: se o topico nao tiver NENHUM
          // resultado em paisagem (raro, mas possivel pra topicos bem
          // especificos), refaz sem o parametro em vez de deixar o pool vazio.
          const landscapeOnly = await fetchUnsplashRandom(topic, accessKey, true);
          if (landscapeOnly.length > 0) return landscapeOnly;
          return await fetchUnsplashRandom(topic, accessKey, false);
        } catch {
          return [];
        }
      }),
    );
    return perTopic.flat();
  }
  return [];
}

/**
 * Estado do papel de parede (candidatos, imagem atual, pause) extraido de
 * `BackgroundLayer.svelte` para um modulo compartilhado: tanto o layer (que
 * so renderiza a imagem) quanto `BackgroundNavControls` (prev/next/pausar,
 * que agora pode viver DENTRO da secao do relogio no layout scroll-reveal,
 * nao mais fixo na tela inteira) precisam ler/acionar o mesmo estado.
 *
 * Os `$effect`s que dependem deste estado (recarregar candidatos, disparar o
 * trigger de download da Unsplash, o timer de troca automatica) continuam
 * vivendo dentro de `BackgroundLayer.svelte` — e sempre montado enquanto o
 * app roda — porque `$effect` exige um ciclo de vida de componente; esta
 * classe so guarda estado e metodos, nunca efeitos.
 */
class BackgroundState {
  candidates: BackgroundCandidate[] = $state([]);
  currentIndex = $state(0);
  objectUrlsToRevoke: string[] = [];
  downloadTriggeredFor: string | null = null;

  current = $derived(this.candidates[this.currentIndex] ?? null);
  currentUrl = $derived(this.current?.url ?? null);

  // Token de sequencia: descarta o resultado de uma chamada de loadCandidates
  // que termina DEPOIS de uma mais recente ja ter aplicado seu proprio
  // resultado (race real, confirmada ao vivo: pausar disparava um reload
  // concorrente com um reload anterior ainda em voo, e o mais antigo
  // terminando por ultimo sobrescrevia o indice pausado com um sorteio
  // aleatorio). `lastSpecKey` evita todo esse ciclo quando so o pause/resume
  // (ou o modo de rotacao) mudou: nesse caso nao ha necessidade de rebuscar
  // nem resortear nada, so reaplicar a escolha de indice.
  private loadSeq = 0;
  private lastSpecKey: string | null = null;
  // URLs ja mandadas pro browser pre-carregar (ver preloadNeighbors) — evita
  // recriar um `Image()` pra uma URL que ja esta no cache HTTP do browser.
  private preloadedUrls = new Set<string>();

  async loadCandidates(key: string): Promise<void> {
    const spec = parseBgSpec(key);
    const specKey = JSON.stringify([spec.source, spec.subreddits, spec.unsplashTopics, spec.localAssetIds]);

    if (specKey === this.lastSpecKey) {
      this.applyIndex(spec);
      return;
    }

    const seq = ++this.loadSeq;
    this.objectUrlsToRevoke.forEach((url) => URL.revokeObjectURL(url));
    this.objectUrlsToRevoke = [];

    if (spec.source === "local") {
      const urls: string[] = [];
      for (const id of spec.localAssetIds) {
        const res = await send<"ASSET">({ type: "GET_ASSET", id });
        if (res.type === "ASSET" && res.blob) {
          const url = URL.createObjectURL(res.blob);
          urls.push(url);
          this.objectUrlsToRevoke.push(url);
        }
      }
      if (seq !== this.loadSeq) return;
      this.candidates = urls.map((url) => ({ url }));
      this.currentIndex = this.candidates.length > 0 ? Math.floor(Math.random() * this.candidates.length) : 0;
    } else if (spec.source === "reddit" || spec.source === "unsplash") {
      // IMPORTANTE: a chave de cache usa `specKey` (so fonte/parametros de
      // busca), nunca `key` inteira — `key` inclui `pausedKey`/rotationMode/
      // etc, que mudam sem precisar re-buscar nada. Usar `key` aqui fazia o
      // cache nunca bater ao pausar (chave nunca antes gravada), caindo no
      // fetch de candidatos NOVOS da API a cada pausa/reload — e o candidato
      // que se queria travar nem existia nesse lote novo. Bug real confirmado
      // ao vivo: pausar e recarregar a pagina trocava a foto em vez de manter
      // a travada.
      const cacheKey = `${spec.source}:${specKey}`;
      const cacheRes = await send<"BACKGROUND_CACHE">({ type: "GET_BACKGROUND_CACHE", key: cacheKey });
      const cached = cacheRes.type === "BACKGROUND_CACHE" ? cacheRes.entry : null;

      if (cached && cached.candidates.length > 0) {
        if (seq !== this.loadSeq) return;
        this.candidates = cached.candidates;
        this.currentIndex = Math.floor(Math.random() * this.candidates.length);
        if (Date.now() - cached.fetchedAt > CACHE_TTL_MS) {
          // stale: atualiza o cache em paralelo, sem perturbar esta sessao
          fetchFreshCandidates(spec).then((fresh) => {
            if (fresh.length > 0) {
              void send({ type: "SET_BACKGROUND_CACHE", key: cacheKey, entry: { candidates: fresh, fetchedAt: Date.now() } });
            }
          });
        }
      } else {
        const fresh = await fetchFreshCandidates(spec);
        if (seq !== this.loadSeq) return;
        this.candidates = fresh;
        this.currentIndex = fresh.length > 0 ? Math.floor(Math.random() * fresh.length) : 0;
        if (fresh.length > 0) {
          void send({ type: "SET_BACKGROUND_CACHE", key: cacheKey, entry: { candidates: fresh, fetchedAt: Date.now() } });
        }
      }
    } else {
      this.candidates = [];
      this.currentIndex = 0;
    }

    this.lastSpecKey = specKey;
    this.applyIndex(spec);
    this.preloadNeighbors();
  }

  /**
   * Pre-carrega a imagem atual + as proximas (e a anterior) no cache HTTP do
   * browser, chamando `next()`/`prev()` e dar a sensacao de instantaneo em
   * vez de mostrar a tela escurecida ate a imagem nova baixar. So cria um
   * `Image()` por URL uma unica vez (ver `preloadedUrls`) — util mesmo para a
   * fonte "local" (object URL de blob, ja em memoria): o custo e desprezivel
   * e evita ter que distinguir o caso aqui.
   */
  preloadNeighbors(aheadCount = 3): void {
    const n = this.candidates.length;
    if (n === 0) return;
    const offsets = [0, 1, 2, 3, -1].slice(0, Math.min(aheadCount + 2, n));
    for (const offset of offsets) {
      const idx = (((this.currentIndex + offset) % n) + n) % n;
      const url = this.candidates[idx]?.url;
      if (!url || this.preloadedUrls.has(url)) continue;
      this.preloadedUrls.add(url);
      const img = new Image();
      img.src = url;
    }
  }

  /** Reaplica a escolha de indice sem rebuscar nada — usado pelo timer do modo "timed". */
  recompute(key: string): void {
    this.applyIndex(parseBgSpec(key));
  }

  /** Decide o indice conforme o modo de rotacao (chamado apos candidatos carregados, e periodicamente para "timed"). */
  applyIndex(spec: BgSpec): void {
    if (spec.pausedKey) {
      this.applyPausedKey(spec);
      return;
    }
    if (spec.rotationMode === "static") {
      // Estatico sem nada travado ainda (primeira vez neste modo): escolhe UM
      // candidato e persiste como pausedKey — a partir daqui o modo estatico
      // e so uma aplicacao particular do mecanismo de pause ja existente.
      if (this.candidates.length > 0) this.pause();
      return;
    }
    if (spec.rotationMode === "timed" && this.candidates.length > 0) {
      const intervalMs = Math.max(1, spec.frequencyMinutes) * 60_000;
      const elapsed = Math.max(0, Date.now() - spec.timedStartedAt);
      this.currentIndex = Math.floor(elapsed / intervalMs) % this.candidates.length;
    }
    // "per-tab": mantem o indice aleatorio ja sorteado em loadCandidates.
  }

  private applyPausedKey(spec: BgSpec): void {
    if (!spec.pausedKey) return;
    if (spec.source === "local") {
      const idx = spec.localAssetIds.indexOf(spec.pausedKey);
      if (idx !== -1 && this.candidates[idx]) this.currentIndex = idx;
    } else {
      const idx = this.candidates.findIndex((c) => c.url === spec.pausedKey);
      if (idx !== -1) this.currentIndex = idx;
    }
  }

  next(): void {
    if (this.candidates.length === 0) return;
    this.currentIndex = (this.currentIndex + 1) % this.candidates.length;
    this.preloadNeighbors();
  }

  prev(): void {
    if (this.candidates.length === 0) return;
    this.currentIndex = (this.currentIndex - 1 + this.candidates.length) % this.candidates.length;
    this.preloadNeighbors();
  }

  /** Trava o candidato atualmente exibido: toda nova aba passa a mostrar so ele. */
  pause(): void {
    const bg = store.config.background;
    const key = bg.source === "local" ? bg.localAssetIds[this.currentIndex] : this.current?.url;
    if (!key) return;
    store.updateConfig({ background: { ...bg, pausedKey: key } });
  }

  resume(): void {
    const bg = store.config.background;
    store.updateConfig({ background: { ...bg, pausedKey: null } });
  }
}

export const backgroundState = new BackgroundState();
