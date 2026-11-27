import { test, expect, chromium, type BrowserContext, type Page } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ARF-165/166/167 (epic LIVE): mover aba(s) viva(s) entre janelas / reorder
// dentro da mesma janela via chrome.tabs.move. Expansão do ARF-110 — ver
// sdd/ARF-165-167-live-tab-move.md (seção "Testes previstos" é o checklist
// coberto aqui). Suíte pesada (cria 3 janelas reais do Chrome com ~11 abas
// via data: URLs) — mantida separada do extension.spec.ts para não acoplar
// timeout/setup dos 2 testes mínimos do ARF-110.

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

async function findSectionIndexByTabTitle(page: Page, title: string): Promise<number> {
  return page.evaluate((title) => {
    const sections = Array.from(document.querySelectorAll("section.group"));
    for (let i = 0; i < sections.length; i++) {
      const titles = Array.from(sections[i]!.querySelectorAll(".live-tab .title")).map((e) => e.textContent);
      if (titles.includes(title)) return i;
    }
    return -1;
  }, title);
}

async function dragLiveTabByTitle(
  page: Page,
  fromTitle: string,
  toSectionIdx: number,
  gapIndex: number,
  extraInit?: { altKey?: boolean },
): Promise<void> {
  await page
    .waitForFunction(
      (fromTitle) =>
        Array.from(document.querySelectorAll(".live-tab .title")).some((e) => e.textContent === fromTitle),
      fromTitle,
      { timeout: 3000 },
    )
    .catch(() => undefined);

  await page.evaluate(
    ({ fromTitle, toSectionIdx, gapIndex, extraInit }) => {
      const sections = Array.from(document.querySelectorAll("section.group"));
      const srcEl = Array.from(document.querySelectorAll(".live-tab")).find(
        (el) => el.querySelector(".title")?.textContent === fromTitle,
      );
      if (!srcEl) throw new Error("src not found: " + fromTitle);
      const dstSection = sections[toSectionIdx];
      if (!dstSection) throw new Error("section not found idx=" + toSectionIdx);
      const gaps = Array.from(dstSection.querySelectorAll(".tab-gap"));
      const dstGap = gaps[gapIndex];
      if (!dstGap) throw new Error("gap not found idx=" + gapIndex);

      const dt = new DataTransfer();
      const fire = (el: Element, type: string, extra?: object) => {
        el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt, ...extra }));
      };
      fire(srcEl, "dragstart", extraInit);
      fire(dstGap, "dragenter", extraInit);
      fire(dstGap, "dragover", extraInit);
      fire(dstGap, "drop", extraInit);
      fire(srcEl, "dragend", extraInit);
    },
    { fromTitle, toSectionIdx, gapIndex, extraInit },
  );
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
 * `tabs` prop lido por `LiveTabDropGap` depende do round-trip
 * mutação->onMoved/onAttached->liveTabsBroadcast->Port->Svelte, que tem
 * latência própria, maior que uma query direta `chrome.tabs.query`. Sem
 * isto, um 2º drag disparado rápido demais calcularia o índice de drop sobre
 * uma ordem já desatualizada na tela (achado real durante esta validação).
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

test("mover/reordenar abas vivas via drag-and-drop (chrome.tabs.move) — ARF-165/166/167", async () => {
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

  // NÃO faz reload — exercita o broadcast ao vivo de verdade (Port já
  // conectado antes das janelas serem criadas). `sections.length >= 3` por si
  // só é insuficiente (achado real: flakiness ~1/3 das execuções) — o número
  // de seções pode bater antes de TODAS as abas de cada janela terem chegado
  // (broadcasts intermediários, uma seção pode aparecer com 0 abas por um
  // instante). Espera pela ÚLTIMA aba criada em cada janela (garante que o
  // broadcast mais recente, com a lista completa, já chegou).
  await page.waitForFunction(
    () => {
      const titles = Array.from(document.querySelectorAll(".live-tab .title")).map((e) => e.textContent);
      return ["A-5", "B-3", "C-only"].every((t) => titles.includes(t));
    },
    { timeout: 5000 },
  );

  // ===== 1. Mover aba única entre janelas, posição exata =====
  const idxB = await findSectionIndexByTabTitle(page, "B-1");
  await dragLiveTabByTitle(page, "A-3", idxB, 1);
  let bTabs = await windowTabs(page, setup.winBId);
  expect(bTabs.map((t) => t.title)).toEqual(["B-1", "A-3", "B-2", "B-3"]);
  expect(bTabs.some((t) => t.id === setup.a3)).toBe(true); // mesmo chromeTabId — sem close/reopen
  await waitForDomTitles(page, "B-1", bTabs.map((t) => t.title));

  // ===== 6. Aba de tab group nativo ejeta ao mudar de janela =====
  const idxBNow = await findSectionIndexByTabTitle(page, "B-1");
  await dragLiveTabByTitle(page, "A-4", idxBNow, 0);
  bTabs = await windowTabs(page, setup.winBId);
  const a4After = bTabs.find((t) => t.id === setup.a4);
  expect(a4After?.groupId).toBe(-1); // chrome.tabGroups.TAB_GROUP_ID_NONE
  await waitForDomTitles(page, "B-1", bTabs.map((t) => t.title));

  // ===== 2. Lote selecionado (multi-seleção) entre janelas, ordem de seleção preservada =====
  await page.getByRole("button", { name: "Selecionar" }).click();
  await page.getByRole("button", { name: "A-5", exact: true }).click();
  await page.getByRole("button", { name: "A-3", exact: true }).click();
  await expect(page.getByRole("button", { name: "Cancelar seleção" })).toBeVisible();

  const idxBForBatch = await findSectionIndexByTabTitle(page, "B-1");
  await dragLiveTabByTitle(page, "A-5", idxBForBatch, 0);
  bTabs = await windowTabs(page, setup.winBId);
  expect(bTabs[0]?.id).toBe(setup.a5);
  expect(bTabs[1]?.id).toBe(setup.a3);
  await expect(page.getByRole("button", { name: "Cancelar seleção" })).toHaveCount(0); // seleção desativada ao final
  await waitForDomTitles(page, "B-1", bTabs.map((t) => t.title));

  // ===== 3. Reorder dentro da mesma janela =====
  const idxBReorder = await findSectionIndexByTabTitle(page, "B-3");
  await dragLiveTabByTitle(page, "B-3", idxBReorder, 0);
  bTabs = await windowTabs(page, setup.winBId);
  expect(bTabs[0]?.id).toBe(setup.b3);
  await waitForDomTitles(page, "B-1", bTabs.map((t) => t.title));

  // ===== 4. No-op ao soltar na posição atual =====
  const beforeNoop = await windowTabs(page, setup.winBId);
  const noopTitle = beforeNoop[2]!.title;
  const idxBNoop = await findSectionIndexByTabTitle(page, noopTitle);
  await dragLiveTabByTitle(page, noopTitle, idxBNoop, 2);
  const afterNoop = await windowTabs(page, setup.winBId);
  expect(afterNoop.map((t) => t.id)).toEqual(beforeNoop.map((t) => t.id));
  await waitForDomTitles(page, "B-1", afterNoop.map((t) => t.title));

  // ===== 5. Mover a única aba de uma janela fecha a janela de origem =====
  expect(await allWindowIds(page)).toContain(setup.winCId);
  const idxAForC = await findSectionIndexByTabTitle(page, "A-pin-1");
  await dragLiveTabByTitle(page, "C-only", idxAForC, 0);
  await page.waitForFunction((winCId) => true, setup.winCId); // no-op para manter padrão; checagem real abaixo
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
  // Soltar uma aba NÃO-pinned num índice que cairia dentro da faixa de
  // pinned do destino: o Chrome ajusta sozinho para depois do bloco pinned
  // (não lança erro, não vira pinned, não fica "dentro" da faixa) — achado
  // confirmado ao vivo aqui, documentado também em
  // docs/research/live-tab-move-cross-window.md.
  const idxAForPin = await findSectionIndexByTabTitle(page, "A-pin-1");
  await dragLiveTabByTitle(page, "B-1", idxAForPin, 0);
  const aTabsAfterPinTest = await windowTabs(page, setup.winAId);
  const b1AfterPin = aTabsAfterPinTest.find((t) => t.id === setup.b1);
  const pinnedCount = aTabsAfterPinTest.filter((t) => t.pinned).length;
  expect(b1AfterPin?.pinned).toBe(false);
  expect(b1AfterPin?.index).toBe(pinnedCount); // logo após o bloco de pinned, nunca "dentro" dele
  await waitForDomTitles(page, "A-pin-1", aTabsAfterPinTest.map((t) => t.title));

  // ===== Alt/Option não tem efeito — sempre move, nunca duplica =====
  const bCountBeforeAlt = (await windowTabs(page, setup.winBId)).length;
  const aCountBeforeAlt = (await windowTabs(page, setup.winAId)).length;
  const idxAForAlt = await findSectionIndexByTabTitle(page, "A-pin-1");
  await dragLiveTabByTitle(page, "B-2", idxAForAlt, 0, { altKey: true });
  const bCountAfterAlt = (await windowTabs(page, setup.winBId)).length;
  const aCountAfterAlt = (await windowTabs(page, setup.winAId)).length;
  expect(bCountAfterAlt).toBe(bCountBeforeAlt - 1);
  expect(aCountAfterAlt).toBe(aCountBeforeAlt + 1);

  // ===== Indicador visual (LiveTabDropGap) só durante drag de live-tab/live-tabs-batch =====
  const anyGapActive = () =>
    page.evaluate(() => Array.from(document.querySelectorAll(".tab-gap")).some((el) => el.classList.contains("active")));
  expect(await anyGapActive()).toBe(false);

  const groupName = `E2E-gap-${Date.now()}`;
  await page.getByRole("button", { name: "Novo grupo" }).click();
  await page.getByPlaceholder("Nome do grupo").fill(groupName);
  await page.getByRole("button", { name: "Criar grupo" }).click();
  await page.getByRole("button", { name: groupName, exact: true }).waitFor();

  const gapDuringGroupDrag = await page.evaluate((groupName) => {
    const header = Array.from(document.querySelectorAll("[draggable='true']")).find((el) =>
      el.textContent?.includes(groupName),
    );
    if (!header) return "no-header";
    const dt = new DataTransfer();
    header.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt }));
    const active = Array.from(document.querySelectorAll(".tab-gap")).some((el) => el.classList.contains("active"));
    header.dispatchEvent(new DragEvent("dragend", { bubbles: true, cancelable: true, dataTransfer: dt }));
    return active;
  }, groupName);
  expect(gapDuringGroupDrag).toBe(false); // drag de GRUPO salvo não ativa o gap

  const gapDuringWindowDrag = await page.evaluate(() => {
    const header = document.querySelector(".group-header[draggable='true']");
    if (!header) return "no-header";
    const dt = new DataTransfer();
    header.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt }));
    const active = Array.from(document.querySelectorAll(".tab-gap")).some((el) => el.classList.contains("active"));
    header.dispatchEvent(new DragEvent("dragend", { bubbles: true, cancelable: true, dataTransfer: dt }));
    return active;
  });
  expect(gapDuringWindowDrag).toBe(false); // drag de LIVE-WINDOW (header de janela) não ativa o gap

  // dragstart + checagem em round-trips SEPARADOS: a reatividade de Svelte 5
  // ($state) flusha a atualização do DOM de forma assíncrona (microtask) —
  // uma checagem síncrona na MESMA chamada de evaluate() roda antes do
  // flush e sempre leria "false" (achado real durante esta validação).
  await page.evaluate(() => {
    const srcEl = document.querySelector(".live-tab[draggable='true']");
    const dt = new DataTransfer();
    (window as unknown as { __qaDrag: unknown }).__qaDrag = { srcEl, dt };
    srcEl?.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt }));
  });
  const gapDuringLiveTabDrag = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".tab-gap")).some((el) => el.classList.contains("active")),
  );
  await page.evaluate(() => {
    const handle = (window as unknown as { __qaDrag: { srcEl: Element | null; dt: DataTransfer } }).__qaDrag;
    handle?.srcEl?.dispatchEvent(new DragEvent("dragend", { bubbles: true, cancelable: true, dataTransfer: handle.dt }));
  });
  expect(gapDuringLiveTabDrag).toBe(true); // drag de LIVE-TAB real ATIVA o gap

  // limpeza do grupo de teste
  const groupButton = page.getByRole("button", { name: groupName, exact: true });
  await groupButton.locator("..").getByRole("button", { name: "Apagar grupo" }).click();
  await page.getByRole("button", { name: "Apagar", exact: true }).click();
  await expect(groupButton).toHaveCount(0);

  // ===== Falha do chrome.tabs.move não quebra a UI (tabId inexistente) =====
  const failResp = await page.evaluate(async (winBId) => {
    return chrome.runtime.sendMessage({ type: "MOVE_LIVE_TAB", tabIds: [999999999], windowId: winBId, index: 0 });
  }, setup.winBId);
  expect(failResp?.type).toBe("LIVE_TAB_MOVE_FAILED");
  expect(await page.evaluate(() => document.querySelectorAll("section.group").length > 0)).toBe(true);

  // ===== Mesma falha, mas pelo FLUXO REAL DE DRAG (aba fechada entre dragstart e drop) =====
  // — confirma que o erro fica visível no console (critério de aceite
  // explícito do SDD), não só que a Promise resolve.
  consoleErrors.length = 0;
  await page.evaluate(async () => {
    const srcEl = Array.from(document.querySelectorAll(".live-tab[draggable='true']")).find(
      (el) => el.querySelector(".title")?.textContent !== "arfyin",
    );
    if (!srcEl) return;
    const title = srcEl.querySelector(".title")?.textContent ?? "";
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find((t) => t.title === title);
    if (!tab) return;
    const dt = new DataTransfer();
    srcEl.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt }));
    await chrome.tabs.remove(tab.id!); // fecha a aba arrastada ANTES do drop
    const gap = document.querySelectorAll(".tab-gap")[0]!;
    gap.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true, dataTransfer: dt }));
    gap.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }));
    gap.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
    srcEl.dispatchEvent(new DragEvent("dragend", { bubbles: true, cancelable: true, dataTransfer: dt }));
  });
  await page.waitForFunction(() => true); // deixa o .then do handler de drop resolver
  await expect
    .poll(() => consoleErrors.some((e) => e.includes("MOVE_LIVE_TAB falhou")), { timeout: 3000 })
    .toBe(true);
  expect(await page.evaluate(() => document.querySelectorAll("section.group").length > 0)).toBe(true);

  await context.close();
});
