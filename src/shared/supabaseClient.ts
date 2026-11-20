import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
