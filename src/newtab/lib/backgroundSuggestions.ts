/**
 * Autocomplete para os campos de subreddit/topico do background — busca
 * direto nas plataformas (nenhuma delas exige auth para isto: Reddit search
 * e publico, Unsplash so pede a access key que ja existe em `.env` para o
 * /topics). Sem isso o usuario tinha que digitar o nome exato de cada fonte
 * (ex.: "EarthPorn" com capitalizacao certa) sem nenhuma ajuda.
 */

interface RedditSearchChild {
  data?: { display_name?: string; subscribers?: number };
}

/** Sem texto digitado: sugere os subreddits populares (mostra algo antes do usuario escrever qualquer coisa). */
async function popularSubreddits(): Promise<string[]> {
  try {
    const res = await fetch(`https://www.reddit.com/subreddits/popular.json?limit=20`);
    const json = await res.json();
    const children = (json?.data?.children ?? []) as RedditSearchChild[];
    return children.map((c) => c.data?.display_name).filter((name): name is string => Boolean(name));
  } catch {
    return [];
  }
}

async function autocompleteSubreddits(query: string): Promise<string[]> {
  const res = await fetch(
    `https://www.reddit.com/api/subreddit_autocomplete_v2.json?query=${encodeURIComponent(query)}&include_over_18=true&include_profiles=false&typeahead_active=true&limit=12`,
  );
  const json = await res.json();
  const children = (json?.data?.children ?? []) as RedditSearchChild[];
  return children.map((c) => c.data?.display_name).filter((name): name is string => Boolean(name));
}

// So os N primeiros de cada busca entram na combinacao — confirmado ao vivo
// que tanto a busca crua quanto a enviesada degradam pra resultados sem
// nenhuma relacao com o termo buscado depois de poucos itens (ex.: "mountain
// wallpaper" cai pra "disneyparksmusic" a partir do 3º resultado). O proprio
// Reddit ja ordena por relevancia, entao os primeiros de cada lista sao os
// unicos que valem a pena mostrar.
const RESULTS_PER_QUERY = 6;

export async function searchSubreddits(query: string): Promise<string[]> {
  const q = query.trim();
  if (!q) return popularSubreddits();
  try {
    // `/subreddits/search.json` (usado antes) responde 403 — confirmado ao
    // vivo que o Reddit bloqueia esse endpoint especifico mesmo a partir de
    // um Chrome real (nao era so o sandbox de dev). O autocomplete usado pela
    // propria busca de subreddit do site funciona normalmente.
    //
    // A busca "crua" (`q`) sozinha traz muito subreddit sem nada a ver com
    // papel de parede (ex.: buscar "anime" trazia "animepiracy",
    // "anime_titties"...). Enviesar a query com " wallpaper" traz subreddits
    // de fato focados nisso (ex.: "Animewallpaper") — mas SOZINHA tambem nao
    // basta: pra termos mais genericos (ex.: "earth") ela as vezes nao traz o
    // subreddit mais obvio e estabelecido ("EarthPorn", convencao classica de
    // fotografia no Reddit). Por isso combina as duas em vez de substituir
    // uma pela outra — nenhuma API do Reddit filtra por conteudo/tema
    // visual, so por texto do nome/descricao, entao isto e uma melhoria de
    // "enviesar a ordem", nao um filtro perfeito.
    const [biased, plain] = await Promise.all([
      autocompleteSubreddits(`${q} wallpaper`).catch(() => []),
      autocompleteSubreddits(q).catch(() => []),
    ]);
    const seen = new Set<string>();
    const merged: string[] = [];
    for (const name of [...biased.slice(0, RESULTS_PER_QUERY), ...plain.slice(0, RESULTS_PER_QUERY)]) {
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(name);
    }
    return merged;
  } catch {
    return [];
  }
}

interface UnsplashTopic {
  slug?: string;
  title?: string;
}

// Lista completa buscada uma unica vez (a API de topicos da Unsplash nao tem
// busca por texto, so listagem paginada) — filtragem por substring acontece
// aqui no cliente a cada tecla digitada, sem nova requisicao de rede.
let unsplashTopicsCache: string[] | null = null;
let unsplashTopicsPromise: Promise<string[]> | null = null;

async function loadUnsplashTopics(): Promise<string[]> {
  const accessKey = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;
  if (!accessKey) return [];
  if (unsplashTopicsCache) return unsplashTopicsCache;
  if (!unsplashTopicsPromise) {
    unsplashTopicsPromise = fetch(`https://api.unsplash.com/topics?per_page=30`, {
      headers: { Authorization: `Client-ID ${accessKey}` },
    })
      .then((res) => res.json())
      .then((topics: UnsplashTopic[]) => {
        const names = Array.isArray(topics)
          ? topics.map((t) => t.slug ?? t.title).filter((name): name is string => Boolean(name))
          : [];
        unsplashTopicsCache = names;
        return names;
      })
      .catch(() => []);
  }
  return unsplashTopicsPromise;
}

export async function searchUnsplashTopics(query: string): Promise<string[]> {
  const q = query.trim().toLowerCase();
  const all = await loadUnsplashTopics();
  const matches = q ? all.filter((name) => name.toLowerCase().includes(q)) : all;
  return matches.slice(0, 20);
}
