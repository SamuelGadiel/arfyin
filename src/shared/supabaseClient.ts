import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { RemoteDb } from "./remote";

let cachedClient: SupabaseClient | null = null;

/**
 * Service worker e paginas da extensao (new-tab) sao processos JS separados —
 * `localStorage` (o storage padrao do supabase-js) nao existe no service worker
 * e nao e compartilhado entre eles de qualquer forma. `chrome.storage.local` e
 * o unico storage realmente compartilhado entre todos os contextos da mesma
 * extensao, por isso a sessao de auth precisa viver ali.
 */
const chromeStorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    const result = await chrome.storage.local.get(key);
    return (result[key] as string | undefined) ?? null;
  },
  async setItem(key: string, value: string): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  },
  async removeItem(key: string): Promise<void> {
    await chrome.storage.local.remove(key);
  },
};

export function getSupabaseClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Supabase nao configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no .env (ver .env.example).",
    );
  }

  cachedClient = createClient(url, publishableKey, {
    auth: {
      storage: chromeStorageAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return cachedClient;
}

/**
 * O client real do supabase-js satisfaz `RemoteDb` estruturalmente (tem `.from()`
 * com `.upsert()`/`.select().eq()`/`.delete().eq()` thenable) — este cast e so
 * para estreitar o tipo na borda de uso, nao muda o comportamento em runtime.
 */
export function getRemoteDb(): RemoteDb {
  return getSupabaseClient() as unknown as RemoteDb;
}

export async function getCurrentUserId(): Promise<string | null> {
  const { data } = await getSupabaseClient().auth.getSession();
  return data.session?.user.id ?? null;
}
