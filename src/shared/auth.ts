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

function buildGoogleAuthUrl(clientId: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "id_token",
    redirect_uri: redirectUri,
    scope: "openid email profile",
    nonce: crypto.randomUUID(),
  });
  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

export async function signInWithGoogle(): Promise<void> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error(
      "Login com Google nao configurado: defina VITE_GOOGLE_CLIENT_ID no .env (ver sdd/ARF-011-google-auth.md).",
    );
  }

  const redirectUri = chrome.identity.getRedirectURL();
  const authUrl = buildGoogleAuthUrl(clientId, redirectUri);

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
  });
  if (error) throw new Error(`Falha ao autenticar no Supabase: ${error.message}`);
}

export async function signOut(): Promise<void> {
  await getSupabaseClient().auth.signOut();
}

export async function getAuthState(): Promise<{ loggedIn: boolean; email: string | null }> {
  const { data } = await getSupabaseClient().auth.getSession();
  const user = data.session?.user ?? null;
  return { loggedIn: user !== null, email: user?.email ?? null };
}
