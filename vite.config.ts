import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json" with { type: "json" };

export default defineConfig({
  plugins: [svelte(), crx({ manifest })],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    // e2e/ roda com Playwright (npm run test:e2e), nao com Vitest.
    exclude: ["**/node_modules/**", "**/e2e/**"],
    // Nunca deixar o .env real (credenciais de producao) vazar para os testes —
    // testes de sync usam fakes de RemoteDb, nao o Supabase de verdade.
    env: {
      VITE_SUPABASE_URL: "",
      VITE_SUPABASE_PUBLISHABLE_KEY: "",
      VITE_GOOGLE_CLIENT_ID: "",
      VITE_UNSPLASH_ACCESS_KEY: "",
    },
  },
});
