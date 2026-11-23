import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  // Artefatos de execucao (antes soltos na raiz do projeto como `test-results/`)
  // agora ficam dentro de `tests/` junto com o resto da suite de testes.
  outputDir: "./tests/test-results",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
});
