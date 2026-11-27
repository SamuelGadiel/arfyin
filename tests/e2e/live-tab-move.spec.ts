import { test, expect, chromium, type BrowserContext, type Page } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ARF-165/166/167 (epic LIVE): mover aba(s) viva(s) entre janelas / reorder
// dentro da mesma janela via chrome.tabs.move. Ver sdd/ARF-165-167-live-tab-move.md.
//
// IMPORTANTE (pós-correção de bug real, 2026-11-27): a 1a versão deste teste
// disparava DragEvent sintéticos via `element.dispatchEvent()` diretamente no
// alvo de drop — isso NÃO exercita o pipeline nativo de drag-and-drop do
// Chrome (o navegador decide se um 'drop' é permitido com base no histórico
// real de 'dragover'/preventDefault ao longo do gesto de mouse de verdade) e
// deu falso positivo: passou nos testes mas o usuário reportou, ao vivo, que
// NADA acontecia (nem cross-window, nem reorder same-window). A causa real
// era um bug de design (alvo de drop fino demais — ver LiveTabItem.svelte),
// que só se manifesta com um drag genuinamente conduzido pelo mouse. Por
// isso este teste usa `page.mouse.move/down/up` — o único jeito confiável de
// testar HTML5 DnD de verdade — e não dispatch manual de DragEvent.

const dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(dirname, "..", "..", "dist");

async function launchWithExtension(): Promise<BrowserContext> {
  return chromium.launchPersistentContext("", {
    headless: false,
    // Viewport grande o bastante pra conter as ~4 janelas/dezenas de abas de
    // teste sem scroll — a coluna "Abas abertas" tem overflow-y:auto próprio
    // (achado real durante esta correção: na viewport default de 1280x720 um
    // elemento mais abaixo na lista ficava fora da área visível e o drag real
    // de mouse simplesmente não alcançava nada ali, sem nenhum erro). Isto é
    // uma necessidade do PRÓPRIO TESTE (muitas janelas sintéticas numa tela
    // só) — não corrige nem mascara nenhum comportamento de produção.
    viewport: { width: 1280, height: 2200 },
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
  });
}

async function getExtensionId(context: BrowserContext): Promise<string> {
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent("serviceworker");
  return worker.url().split("/")[2]!;
}

interface Setup {
  winAId: number;
  a1: number;
  a2: number;
  a3: number;
  a4: number;
  a5: number;
  winBId: number;
  b1: number;
  b2: number;
  b3: number;
  winCId: number;
  c1: number;
  groupId: number;
}

interface TabInfo {
  id: number;
  title: string;
  index: number;
  pinned: boolean;
  groupId: number;
}

/**
 * Drag real via mouse (down → N moves incrementais → up), soltando no corpo
 * de um `.live-tab` (nunca numa faixa fina dedicada — não existe mais desde a
 * correção): `verticalBias` 0..1 decide em qual metade do item de destino o
 * cursor solta (< 0.5 = antes dele, > 0.5 = depois) — é exatamente o gesto
 * que um usuário real faz.
 */
async function realDragByTitle(
  page: Page,
  fromTitle: string,
  toTitle: string,
  verticalBias: number,
  opts?: { altKey?: boolean },
): Promise<void> {
  await page
    .waitForFunction(
      (fromTitle) =>
        Array.from(document.querySelectorAll(".live-tab .title")).some((e) => e.textContent === fromTitle),
      fromTitle,
      { timeout: 3000 },
    )
    .catch(() => undefined);

  const src = page.locator(".live-tab", { hasText: fromTitle }).first();
  const dst = page.locator(".live-tab", { hasText: toTitle }).first();
  const srcBox = await src.boundingBox();
  const dstBox = await dst.boundingBox();
  if (!srcBox || !dstBox) throw new Error(`elemento nao encontrado: from=${fromTitle} to=${toTitle}`);

  const startX = srcBox.x + srcBox.width / 2;
  const startY = srcBox.y + srcBox.height / 2;
  const targetX = dstBox.x + dstBox.width / 2;
  const targetY = dstBox.y + dstBox.height * verticalBias;

  if (opts?.altKey) await page.keyboard.down("Alt");
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.waitForTimeout(60);
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(startX + ((targetX - startX) * i) / steps, startY + ((targetY - startY) * i) / steps);
    await page.waitForTimeout(18);
  }
  await page.waitForTimeout(80);
  await page.mouse.up();
  if (opts?.altKey) await page.keyboard.up("Alt");
  await page.waitForTimeout(300);
}

async function windowTabs(page: Page, windowId: number): Promise<TabInfo[]> {
  return page.evaluate(async (windowId) => {
    const tabs = await chrome.tabs.query({ windowId });
    tabs.sort((x, y) => (x.index ?? 0) - (y.index ?? 0));
    return tabs.map((t) => ({
      id: t.id!,
      title: t.title!,
      index: t.index,
      pinned: t.pinned!,
      groupId: t.groupId!,
    }));
  }, windowId);
}

async function allWindowIds(page: Page): Promise<number[]> {
  return page.evaluate(async () => (await chrome.windows.getAll()).map((w) => w.id!));
}

/**
 * Sincroniza com o broadcast (Port `LIVE_WINDOWS`) antes do próximo drag: o
 * `tabs` prop lido por `LiveTabItem` depende do round-trip
 * mutação->onMoved/onAttached->liveTabsBroadcast->Port->Svelte, que tem
 * latência própria. Sem isto, um 2º drag disparado rápido demais calcularia
 * o índice de drop sobre uma ordem já desatualizada na tela.
 */
async function waitForDomTitles(page: Page, sectionTabTitle: string, expectedTitles: string[]): Promise<void> {
  await page.waitForFunction(
    ({ sectionTabTitle, expectedTitles }) => {
      const sections = Array.from(document.querySelectorAll("section.group"));
      const sec = sections.find((s) =>
        Array.from(s.querySelectorAll(".live-tab .title")).some((e) => e.textContent === sectionTabTitle),
      );
      if (!sec) return false;
      const titles = Array.from(sec.querySelectorAll(".live-tab .title")).map((e) => e.textContent);
      return JSON.stringify(titles) === JSON.stringify(expectedTitles);
    },
    { sectionTabTitle, expectedTitles },
    { timeout: 5000 },
  );
}

test.setTimeout(120_000);

test("mover/reordenar abas vivas via drag-and-drop real de mouse (chrome.tabs.move) — ARF-165/166/167", async () => {
  const context = await launchWithExtension();
  const extensionId = await getExtensionId(context);

  const consoleErrors: string[] = [];
  const page = await context.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push("pageerror: " + err.message));

  await page.goto(`chrome-extension://${extensionId}/src/newtab/index.html`);

  // --- Setup: 3 janelas reais com abas marcadas por título único. Janela A
  // tem 2 abas pinned (teste 7) + 1 aba num tab group nativo (teste 6).
  const setup: Setup = await page.evaluate(async () => {
    function mkUrl(title: string) {
      return `data:text/html,<title>${title}</title><body>${title}</body>`;
    }
    const allWindows = await chrome.windows.getAll({ populate: true });
    const myTab = await chrome.tabs.getCurrent();
    const myWindowId = myTab!.windowId;
    for (const w of allWindows) {
      if (w.id !== myWindowId) await chrome.windows.remove(w.id!);
    }
    const myWinTabs = (await chrome.tabs.query({ windowId: myWindowId })).filter((t) => t.id !== myTab!.id);
    for (const t of myWinTabs) await chrome.tabs.remove(t.id!);

    const winA = await chrome.windows.create({ url: mkUrl("A-pin-1"), focused: false });
    const a1 = winA.tabs![0]!;
    await chrome.tabs.update(a1.id!, { pinned: true });
    const a2 = await chrome.tabs.create({ windowId: winA.id, url: mkUrl("A-pin-2"), pinned: true, index: 1 });
    const a3 = await chrome.tabs.create({ windowId: winA.id, url: mkUrl("A-3"), index: 2 });
    const a4 = await chrome.tabs.create({ windowId: winA.id, url: mkUrl("A-4"), index: 3 });
    const a5 = await chrome.tabs.create({ windowId: winA.id, url: mkUrl("A-5"), index: 4 });

    const winB = await chrome.windows.create({ url: mkUrl("B-1"), focused: false });
    const b1 = winB.tabs![0]!;
    const b2 = await chrome.tabs.create({ windowId: winB.id, url: mkUrl("B-2"), index: 1 });
    const b3 = await chrome.tabs.create({ windowId: winB.id, url: mkUrl("B-3"), index: 2 });

    const winC = await chrome.windows.create({ url: mkUrl("C-only"), focused: false });
    const c1 = winC.tabs![0]!;

    const groupId = await chrome.tabs.group({ tabIds: [a4.id!] });

    return {
      winAId: winA.id!, a1: a1.id!, a2: a2.id!, a3: a3.id!, a4: a4.id!, a5: a5.id!,
      winBId: winB.id!, b1: b1.id!, b2: b2.id!, b3: b3.id!,
      winCId: winC.id!, c1: c1.id!,
      groupId,
    };
  });

  await page.waitForFunction(
    () => {
      const titles = Array.from(document.querySelectorAll(".live-tab .title")).map((e) => e.textContent);
      return ["A-5", "B-3", "C-only"].every((t) => titles.includes(t));
    },
    { timeout: 5000 },
  );

  // ===== 1. Mover aba única entre janelas, soltando no CORPO de B-1 (metade de baixo = depois) =====
  await realDragByTitle(page, "A-3", "B-1", 0.75);
  let bTabs = await windowTabs(page, setup.winBId);
  expect(bTabs.map((t) => t.title)).toEqual(["B-1", "A-3", "B-2", "B-3"]);
  expect(bTabs.some((t) => t.id === setup.a3)).toBe(true); // mesmo chromeTabId — sem close/reopen
  await waitForDomTitles(page, "B-1", bTabs.map((t) => t.title));

  // ===== 6. Aba de tab group nativo ejeta ao mudar de janela =====
  await realDragByTitle(page, "A-4", "B-1", 0.25);
  bTabs = await windowTabs(page, setup.winBId);
  const a4After = bTabs.find((t) => t.id === setup.a4);
  expect(a4After?.groupId).toBe(-1); // chrome.tabGroups.TAB_GROUP_ID_NONE
  expect(a4After?.title).toBe(bTabs[0]?.title); // caiu antes de B-1 (metade de cima)
  await waitForDomTitles(page, "B-1", bTabs.map((t) => t.title));

  // ===== 2. Lote selecionado (multi-seleção) entre janelas, ordem de seleção preservada =====
  await page.getByRole("button", { name: "Selecionar" }).click();
  await page.getByRole("button", { name: "A-5", exact: true }).click();
  await page.getByRole("button", { name: "A-3", exact: true }).click();
  await expect(page.getByRole("button", { name: "Cancelar seleção" })).toBeVisible();

  await realDragByTitle(page, "A-5", "B-1", 0.25);
  bTabs = await windowTabs(page, setup.winBId);
  // A-4 ja estava antes de B-1 desde o passo 6 — o lote [A-5, A-3] (ordem de
  // selecao) entra ENTRE A-4 e B-1, nao no inicio absoluto da janela.
  const b1Idx = bTabs.findIndex((t) => t.id === setup.b1);
  expect(bTabs[b1Idx - 2]?.id).toBe(setup.a5);
  expect(bTabs[b1Idx - 1]?.id).toBe(setup.a3);
  await expect(page.getByRole("button", { name: "Cancelar seleção" })).toHaveCount(0); // seleção desativada ao final
  await waitForDomTitles(page, "B-1", bTabs.map((t) => t.title));

  // ===== 3. Reorder dentro da mesma janela =====
  const beforeReorder = await windowTabs(page, setup.winBId);
  const lastTitle = beforeReorder[beforeReorder.length - 1]!.title;
  const firstTitle = beforeReorder[0]!.title;
  await realDragByTitle(page, lastTitle, firstTitle, 0.25);
  bTabs = await windowTabs(page, setup.winBId);
  expect(bTabs[0]?.title).toBe(lastTitle);
  await waitForDomTitles(page, "B-1", bTabs.map((t) => t.title));

  // ===== 4. No-op ao soltar sobre o próprio item (metade de cima dele mesmo) =====
  const beforeNoop = await windowTabs(page, setup.winBId);
  const noopTitle = beforeNoop[2]!.title;
  await realDragByTitle(page, noopTitle, noopTitle, 0.25);
  const afterNoop = await windowTabs(page, setup.winBId);
  expect(afterNoop.map((t) => t.id)).toEqual(beforeNoop.map((t) => t.id));
  await waitForDomTitles(page, "B-1", afterNoop.map((t) => t.title));

  // ===== 5. Mover a única aba de uma janela fecha a janela de origem =====
  // waitForDomTitles aqui (ausente na 1a tentativa) é necessário: o passo de
  // no-op anterior ainda dispara um round-trip de broadcast mesmo sem mudar
  // nada, e sem esperar esse assentamento o boundingBox de "A-pin-1" podia
  // ser lido num instante intermediário do DOM — achado real durante esta
  // correção (flakiness ~1x, não reprodutível isolado sem o histórico de
  // passos anteriores).
  await waitForDomTitles(page, "B-1", (await windowTabs(page, setup.winBId)).map((t) => t.title));
  expect(await allWindowIds(page)).toContain(setup.winCId);
  await realDragByTitle(page, "C-only", "A-pin-1", 0.25);
  expect(await allWindowIds(page)).not.toContain(setup.winCId);

  const aTabsAfterClose = await windowTabs(page, setup.winAId);
  await waitForDomTitles(page, "A-pin-1", aTabsAfterClose.map((t) => t.title));
  const cSectionGone = await page.evaluate(
    () =>
      !Array.from(document.querySelectorAll("section.group")).some(
        (s) => s.querySelectorAll(".live-tab .title").length === 1 && s.textContent?.includes("C-only"),
      ),
  );
  expect(cSectionGone).toBe(true); // UI re-renderiza via broadcast já existente, sem reload

  // ===== 7. Aba pinned — comportamento nativo documentado =====
  // Soltar uma aba NÃO-pinned no corpo da 1a aba pinned do destino: o Chrome
  // ajusta sozinho para depois do bloco pinned (não lança erro, não vira
  // pinned, não fica "dentro" da faixa) — achado confirmado ao vivo,
  // documentado também em docs/research/live-tab-move-cross-window.md.
  await realDragByTitle(page, "B-1", "A-pin-1", 0.25);
  const aTabsAfterPinTest = await windowTabs(page, setup.winAId);
  const b1AfterPin = aTabsAfterPinTest.find((t) => t.id === setup.b1);
  const pinnedCount = aTabsAfterPinTest.filter((t) => t.pinned).length;
  expect(b1AfterPin?.pinned).toBe(false);
  expect(b1AfterPin?.index).toBe(pinnedCount); // logo após o bloco de pinned, nunca "dentro" dele
  await waitForDomTitles(page, "A-pin-1", aTabsAfterPinTest.map((t) => t.title));

  // ===== Alt/Option não tem efeito — sempre move, nunca duplica =====
  const bCountBeforeAlt = (await windowTabs(page, setup.winBId)).length;
  const aCountBeforeAlt = (await windowTabs(page, setup.winAId)).length;
  await realDragByTitle(page, "B-2", "A-pin-1", 0.25, { altKey: true });
  const bCountAfterAlt = (await windowTabs(page, setup.winBId)).length;
  const aCountAfterAlt = (await windowTabs(page, setup.winAId)).length;
  expect(bCountAfterAlt).toBe(bCountBeforeAlt - 1);
  expect(aCountAfterAlt).toBe(aCountBeforeAlt + 1);

  // ===== Indicador visual só aparece durante drag de live-tab/live-tabs-batch,
  // nunca durante drag de group/saved-tab/live-window — verificado via drag
  // REAL de mouse (não dispatch sintético), mantendo o cursor parado sobre
  // outra aba no meio do gesto. =====
  const groupName = `E2E-indicator-${Date.now()}`;
  await page.getByRole("button", { name: "Novo grupo" }).click();
  await page.getByPlaceholder("Nome do grupo").fill(groupName);
  await page.getByRole("button", { name: "Criar grupo" }).click();
  await page.getByRole("button", { name: groupName, exact: true }).waitFor();

  const groupHeaderBox = await page
    .locator(".group-header", { hasText: groupName })
    .first()
    .boundingBox();
  expect(groupHeaderBox).not.toBeNull();
  await page.mouse.move(groupHeaderBox!.x + 10, groupHeaderBox!.y + 10);
  await page.mouse.down();
  await page.waitForTimeout(60);
  await page.mouse.move(groupHeaderBox!.x + 10, groupHeaderBox!.y + 60, { steps: 5 });
  const dropBeforeDuringGroupDrag = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".live-tab")).some(
      (el) => el.classList.contains("drop-before") || el.classList.contains("drop-after"),
    ),
  );
  await page.mouse.up();
  expect(dropBeforeDuringGroupDrag).toBe(false); // drag de GRUPO salvo não ativa o indicador de aba viva

  const groupButton = page.getByRole("button", { name: groupName, exact: true });
  await groupButton.locator("..").getByRole("button", { name: "Apagar grupo" }).click();
  await page.getByRole("button", { name: "Apagar", exact: true }).click();
  await expect(groupButton).toHaveCount(0);

  const anyTabBox = await page.locator(".live-tab").first().boundingBox();
  const anotherTabBox = await page.locator(".live-tab").nth(1).boundingBox();
  expect(anyTabBox).not.toBeNull();
  expect(anotherTabBox).not.toBeNull();
  await page.mouse.move(anyTabBox!.x + anyTabBox!.width / 2, anyTabBox!.y + anyTabBox!.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(60);
  await page.mouse.move(
    anotherTabBox!.x + anotherTabBox!.width / 2,
    anotherTabBox!.y + anotherTabBox!.height * 0.25,
    { steps: 8 },
  );
  await page.waitForTimeout(60);
  const dropIndicatorDuringLiveTabDrag = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".live-tab")).some((el) => el.classList.contains("drop-before")),
  );
  await page.mouse.up();
  await page.waitForTimeout(200);
  expect(dropIndicatorDuringLiveTabDrag).toBe(true); // drag de LIVE-TAB real ATIVA o indicador

  // ===== Falha do chrome.tabs.move não quebra a UI (tabId inexistente, via mensagem direta) =====
  const failResp = await page.evaluate(async (winBId) => {
    return chrome.runtime.sendMessage({ type: "MOVE_LIVE_TAB", tabIds: [999999999], windowId: winBId, index: 0 });
  }, setup.winBId);
  expect(failResp?.type).toBe("LIVE_TAB_MOVE_FAILED");
  expect(await page.evaluate(() => document.querySelectorAll("section.group").length > 0)).toBe(true);

  // ===== Mesma falha, mas pelo FLUXO REAL DE DRAG DE MOUSE (aba fechada no meio do gesto) =====
  // Confirma que o erro fica visível no console (critério de aceite
  // explícito do SDD), usando um drag de mouse genuíno pausado a meio
  // caminho — não um dispatch sintético de 'drop'.
  consoleErrors.length = 0;
  const remainingTabs = await windowTabs(page, setup.winAId);
  const victimTitle = remainingTabs[remainingTabs.length - 1]!.title;
  const victimBox = await page.locator(".live-tab", { hasText: victimTitle }).first().boundingBox();
  const otherBox = await page.locator(".live-tab").first().boundingBox();
  expect(victimBox).not.toBeNull();
  expect(otherBox).not.toBeNull();

  await page.mouse.move(victimBox!.x + victimBox!.width / 2, victimBox!.y + victimBox!.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(60);
  await page.mouse.move(
    (victimBox!.x + otherBox!.x) / 2,
    (victimBox!.y + otherBox!.y) / 2,
    { steps: 5 },
  );
  await page.evaluate(async (title) => {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find((t) => t.title === title);
    if (tab) await chrome.tabs.remove(tab.id!);
  }, victimTitle);
  await page.mouse.move(otherBox!.x + otherBox!.width / 2, otherBox!.y + otherBox!.height * 0.25, { steps: 5 });
  await page.waitForTimeout(80);
  await page.mouse.up();
  await page.waitForTimeout(300);

  await expect
    .poll(() => consoleErrors.some((e) => e.includes("MOVE_LIVE_TAB falhou")), { timeout: 3000 })
    .toBe(true);
  expect(await page.evaluate(() => document.querySelectorAll("section.group").length > 0)).toBe(true);

  await context.close();
});
