import { getSupabaseClient } from "./supabaseClient";

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";

/**
 * Extrai o `id_token` do fragmento (#...) da URL de retorno do
 * `launchWebAuthFlow`. Funcao pura — testavel sem chrome.identity real.
 */
export function parseIdTokenFromRedirectUrl(redirectUrl: string): string | null {
  const hashIndex = redirectUrl.indexOf("#");
  if (hashIndex === -1) return null;
  const params = new URLSearchParams(redirectUrl.slice(hashIndex + 1));
  return params.get("id_token");
}

function buildGoogleAuthUrl(clientId: string, redirectUri: string, hashedNonce: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "id_token",
    redirect_uri: redirectUri,
    scope: "openid email profile",
    nonce: hashedNonce,
  });
  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

/** SHA-256 em hex (Web Crypto nativo) — Google embute este hash no claim `nonce` do id_token. */
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function signInWithGoogle(): Promise<void> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error(
      "Login com Google nao configurado: defina VITE_GOOGLE_CLIENT_ID no .env (ver sdd/ARF-011-google-auth.md).",
    );
  }

  const redirectUri = chrome.identity.getRedirectURL();
  // O GoTrue (backend de auth do Supabase) SEMPRE recalcula sha256(nonce) e
  // compara contra o claim `nonce` do id_token (confirmado no codigo-fonte:
  // internal/api/token_oidc.go) — nao ha opcao de enviar o nonce puro. Por
  // isso mandamos o HASH pro Google (vira o claim do JWT) e o valor PURO pro
  // Supabase (que recalcula o hash e compara) — exatamente o que a lib oficial
  // Google Identity Services faz por baixo dos panos.
  const nonce = crypto.randomUUID();
  const hashedNonce = await sha256Hex(nonce);
  const authUrl = buildGoogleAuthUrl(clientId, redirectUri, hashedNonce);

  const redirectUrl = await chrome.identity.launchWebAuthFlow({
    url: authUrl,
    interactive: true,
  });

  if (!redirectUrl) throw new Error("Login cancelado.");

  const idToken = parseIdTokenFromRedirectUrl(redirectUrl);
  if (!idToken) throw new Error("Nao foi possivel extrair o id_token da resposta do Google.");

  const { error } = await getSupabaseClient().auth.signInWithIdToken({
    provider: "google",
    token: idToken,
    nonce,
  });
  if (error) throw new Error(`Falha ao autenticar no Supabase: ${error.message}`);

  // Restaura dados salvos em outra maquina (pull) e sobe o que so existe aqui
  // localmente (push) — sem isto, logar numa maquina nova nao trazia nada do
  // Supabase, so pra na proxima mutacao/alarme de 15min. Falha aqui nao deve
  // reportar "falha ao autenticar" (o login no Supabase ja teve sucesso).
  try {
    await chrome.runtime.sendMessage({ type: "BOOTSTRAP_SYNC" });
  } catch (err) {
    console.error("[arfyin] bootstrap sync apos login falhou:", err instanceof Error ? err.message : err);
  }
}

export async function signOut(): Promise<void> {
  await getSupabaseClient().auth.signOut();
}

export interface AuthState {
  loggedIn: boolean;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}

export async function getAuthState(): Promise<AuthState> {
  const { data } = await getSupabaseClient().auth.getSession();
  const user = data.session?.user ?? null;
  // O Google OAuth via Supabase preenche `user_metadata` com os claims do
  // id_token (full_name/name, avatar_url/picture) — nomes variam conforme a
  // versao do provider, por isso checa os dois.
  const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>;
  return {
    loggedIn: user !== null,
    email: user?.email ?? null,
    name: (metadata.full_name as string) || (metadata.name as string) || null,
    avatarUrl: (metadata.avatar_url as string) || (metadata.picture as string) || null,
  };
}
