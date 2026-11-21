import { test, expect, chromium, type BrowserContext } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(dirname, "..", "dist");

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

  await expect(page.getByRole("button", { name: "+ Novo grupo" })).toBeVisible();

  await context.close();
});

test("criar um grupo via UI faz ele aparecer na lista", async () => {
  const context = await launchWithExtension();
  const extensionId = await getExtensionId(context);

  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/newtab/index.html`);

  const groupName = `E2E ${Date.now()}`;
  page.once("dialog", (dialog) => dialog.accept(groupName));
  await page.getByRole("button", { name: "+ Novo grupo" }).click();

  await expect(page.getByRole("button", { name: groupName })).toBeVisible();

  // limpeza: apaga o grupo criado para nao deixar lixo de teste no perfil
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: groupName })
    .locator("..")
    .getByTitle("Apagar grupo")
    .click();
  await expect(page.getByRole("button", { name: groupName })).toHaveCount(0);

  await context.close();
});
