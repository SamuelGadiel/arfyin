import { test, expect, chromium, type BrowserContext } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ARF-170 (epic CORE/LIVE): criar grupo diretamente a partir de uma seleção
// de abas vivas, em vez de criar o grupo vazio e depois arrastar abas pra
// ele. Pedido direto do usuário (2026-11-27).

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

test("criar grupo a partir de uma seleção de abas vivas (sem fechar originais)", async () => {
  const context = await launchWithExtension();
  const extensionId = await getExtensionId(context);
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/newtab/index.html`);

  const setup = await page.evaluate(async () => {
    function mkUrl(title: string) {
      return `data:text/html,<title>${title}</title><body>${title}</body>`;
    }
    const myTab = await chrome.tabs.getCurrent();
    const t1 = await chrome.tabs.create({ windowId: myTab!.windowId, url: mkUrl("Sel-X"), active: false });
    const t2 = await chrome.tabs.create({ windowId: myTab!.windowId, url: mkUrl("Sel-Y"), active: false });
    return { t1: t1.id!, t2: t2.id! };
  });

  await page.waitForFunction(
    () => {
      const titles = Array.from(document.querySelectorAll(".live-tab .title")).map((e) => e.textContent);
      return ["Sel-X", "Sel-Y"].every((t) => titles.includes(t));
    },
    { timeout: 5000 },
  );

  await page.getByRole("button", { name: "Selecionar" }).click();
  await page.getByRole("button", { name: "Sel-X", exact: true }).click();
  await page.getByRole("button", { name: "Sel-Y", exact: true }).click();

  const createGroupBtn = page.getByRole("button", { name: /Criar grupo \(2\)/ });
  await expect(createGroupBtn).toBeVisible();
  await createGroupBtn.click();

  // Contador da pré-visualização reflete a quantidade selecionada (não 0 fixo).
  await expect(page.locator(".group.preview .count").first()).toHaveText("2");

  const groupName = `E2E-sel-${Date.now()}`;
  await page.getByPlaceholder("Nome do grupo").fill(groupName);
  await page.getByRole("button", { name: "Criar grupo", exact: true }).click();

  const groupButton = page.getByRole("button", { name: groupName, exact: true });
  await expect(groupButton).toBeVisible();

  // Abas originais continuam abertas (sem Alt) e seleção foi desativada.
  const stillOpen = await page.evaluate(async (ids) => {
    const tabs = await chrome.tabs.query({});
    return ids.every((id) => tabs.some((t) => t.id === id));
  }, [setup.t1, setup.t2]);
  expect(stillOpen).toBe(true);
  await expect(page.getByRole("button", { name: "Cancelar seleção" })).toHaveCount(0);

  // limpeza
  await groupButton.locator("..").getByRole("button", { name: "Apagar grupo" }).click();
  await page.getByRole("button", { name: "Apagar", exact: true }).click();

  await context.close();
});

test("criar grupo a partir de uma seleção com Alt fecha as abas originais", async () => {
  const context = await launchWithExtension();
  const extensionId = await getExtensionId(context);
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/newtab/index.html`);

  const setup = await page.evaluate(async () => {
    function mkUrl(title: string) {
      return `data:text/html,<title>${title}</title><body>${title}</body>`;
    }
    const myTab = await chrome.tabs.getCurrent();
    const t1 = await chrome.tabs.create({ windowId: myTab!.windowId, url: mkUrl("SelAlt-X"), active: false });
    const t2 = await chrome.tabs.create({ windowId: myTab!.windowId, url: mkUrl("SelAlt-Y"), active: false });
    return { t1: t1.id!, t2: t2.id! };
  });

  await page.waitForFunction(
    () => {
      const titles = Array.from(document.querySelectorAll(".live-tab .title")).map((e) => e.textContent);
      return ["SelAlt-X", "SelAlt-Y"].every((t) => titles.includes(t));
    },
    { timeout: 5000 },
  );

  await page.getByRole("button", { name: "Selecionar" }).click();
  await page.getByRole("button", { name: "SelAlt-X", exact: true }).click();
  await page.getByRole("button", { name: "SelAlt-Y", exact: true }).click();

  // `click({ modifiers })` em vez de `keyboard.down/up("Alt")` ao redor do
  // clique: o modificador vai junto do evento de clique sintetizado via CDP,
  // sem depender do estado do teclado do SO/foco de janela real — achado real
  // de flakiness ao rodar a suíte inteira em sequência (outro spec, que abre
  // e fecha várias janelas reais do Chrome, podia "roubar" o foco do SO entre
  // o keydown e o click, fazendo o Alt não chegar na janela certa).
  await page.getByRole("button", { name: /Criar grupo \(2\)/ }).click({ modifiers: ["Alt"] });

  const groupName = `E2E-sel-alt-${Date.now()}`;
  await page.getByPlaceholder("Nome do grupo").fill(groupName);
  await page.getByRole("button", { name: "Criar grupo", exact: true }).click();

  const groupButton = page.getByRole("button", { name: groupName, exact: true });
  await expect(groupButton).toBeVisible();

  const stillOpen = await page.evaluate(async (ids) => {
    const tabs = await chrome.tabs.query({});
    return ids.some((id) => tabs.some((t) => t.id === id));
  }, [setup.t1, setup.t2]);
  expect(stillOpen).toBe(false);

  await groupButton.locator("..").getByRole("button", { name: "Apagar grupo" }).click();
  await page.getByRole("button", { name: "Apagar", exact: true }).click();

  await context.close();
});
