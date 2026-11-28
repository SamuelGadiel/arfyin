import { store } from "./store.svelte";
import { send } from "./client";
import type { BackgroundCandidate, BackgroundAttribution } from "@/shared/backgroundSource";
import { type BgSpec, parseBgSpec, fetchFreshCandidates } from "@/shared/backgroundFetch";

// Cache de candidatos (reddit/unsplash) persistido no background — evita bater
// na rede (e no rate limit do Unsplash) a cada new-tab aberta. Fresco por ate
// 1h; depois disso, mostra o cache (instantaneo) e atualiza em paralelo para a
// PROXIMA aba, sem trocar a imagem desta aba no meio da sessao.
const CACHE_TTL_MS = 60 * 60_000;

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

  /**
   * Imagem consumida da fila de pre-fetch (ver src/background/backgroundPrefetch.ts)
   * — tem PRIORIDADE sobre `currentUrl` ate o usuario chamar next()/prev()
   * (que a descartam, passando a usar o pool normal) ou a aba fechar.
   * Existe pra garantir abertura de aba instantanea e sem repetir a imagem
   * da aba anterior (modo "per-tab") — ver BackgroundLayer.svelte.
   */
  prefetchedUrl: string | null = $state(null);
  prefetchedAttribution: BackgroundAttribution | undefined = $state(undefined);
  private prefetchedSourceUrl: string | null = null;
  private prefetchedObjectUrl: string | null = null;

  setPrefetched(blob: Blob, sourceUrl: string, attribution?: BackgroundAttribution): void {
    this.clearPrefetched();
    const url = URL.createObjectURL(blob);
    this.prefetchedObjectUrl = url;
    this.prefetchedUrl = url;
    this.prefetchedSourceUrl = sourceUrl;
    this.prefetchedAttribution = attribution;
  }

  clearPrefetched(): void {
    if (this.prefetchedObjectUrl) URL.revokeObjectURL(this.prefetchedObjectUrl);
    this.prefetchedObjectUrl = null;
    this.prefetchedUrl = null;
    this.prefetchedSourceUrl = null;
    this.prefetchedAttribution = undefined;
  }

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
    this.clearPrefetched();
    if (this.candidates.length === 0) return;
    this.currentIndex = (this.currentIndex + 1) % this.candidates.length;
    this.preloadNeighbors();
  }

  prev(): void {
    this.clearPrefetched();
    if (this.candidates.length === 0) return;
    this.currentIndex = (this.currentIndex - 1 + this.candidates.length) % this.candidates.length;
    this.preloadNeighbors();
  }

  /** Trava o candidato atualmente exibido: toda nova aba passa a mostrar so ele. */
  pause(): void {
    const bg = store.config.background;
    let key: string | null | undefined;
    if (bg.source === "local") {
      key = bg.localAssetIds[this.currentIndex];
    } else if (this.prefetchedUrl && this.prefetchedSourceUrl) {
      // Garante que o candidato prefetched exista no pool normal — assim que
      // pausedKey!==null, o fluxo volta a ser o normal (sem prefetch, ver
      // BackgroundLayer.svelte), e `applyPausedKey` precisa achar esta
      // entrada em `candidates` pra travar na imagem certa (a que ja estava
      // na tela), nao sortear outra.
      if (!this.candidates.some((c) => c.url === this.prefetchedSourceUrl)) {
        this.candidates = [{ url: this.prefetchedSourceUrl, attribution: this.prefetchedAttribution }, ...this.candidates];
      }
      key = this.prefetchedSourceUrl;
    } else {
      key = this.current?.url;
    }
    if (!key) return;
    store.updateConfig({ background: { ...bg, pausedKey: key } });
  }

  resume(): void {
    const bg = store.config.background;
    store.updateConfig({ background: { ...bg, pausedKey: null } });
  }
}

export const backgroundState = new BackgroundState();
