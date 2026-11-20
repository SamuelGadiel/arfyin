import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { RemoteDb } from "./remote";

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Supabase nao configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no .env (ver .env.example).",
    );
  }

  cachedClient = createClient(url, publishableKey);
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
