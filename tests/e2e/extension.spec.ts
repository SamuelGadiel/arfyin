import { test, expect, chromium, type BrowserContext } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(dirname, "..", "..", "dist");

async function launchWithExtension(): Promise<BrowserContext> {
  return chromium.launchPersistentContext("", {
    headless: false,
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
  });
}

async function getExtensionId(context: BrowserContext): Promise<string> {
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent("serviceworker");
  return worker.url().split("/")[2]!;
}

test("new-tab carrega e mostra a UI principal", async () => {
  const context = await launchWithExtension();
  const extensionId = await getExtensionId(context);

  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/newtab/index.html`);

  await expect(page.getByRole("button", { name: "Novo grupo" })).toBeVisible();

  await context.close();
});

test("criar um grupo via UI faz ele aparecer na lista", async () => {
  const context = await launchWithExtension();
  const extensionId = await getExtensionId(context);

  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/newtab/index.html`);

  // O `prompt()`/`confirm()` nativos foram substituidos por popups proprios
  // (Modal/GroupDialog/ConfirmDialog, ver ARF-157) -- o fluxo agora interage
  // com esses componentes em vez de `page.on("dialog")`.
  const groupName = `E2E ${Date.now()}`;
  await page.getByRole("button", { name: "Novo grupo" }).click();
  await page.getByPlaceholder("Nome do grupo").fill(groupName);
  await page.getByRole("button", { name: "Criar grupo" }).click();

  const groupButton = page.getByRole("button", { name: groupName, exact: true });
  await expect(groupButton).toBeVisible();

  // limpeza: apaga o grupo criado para nao deixar lixo de teste no perfil
  await groupButton.locator("..").getByRole("button", { name: "Apagar grupo" }).click();
  await page.getByRole("button", { name: "Apagar", exact: true }).click();
  await expect(groupButton).toHaveCount(0);

  await context.close();
});
