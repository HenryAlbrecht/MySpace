// Local scroll/geometry fixture: one browser/context, no providers or capture.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(
  path.join(
    require("node:os").homedir(),
    ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
  ),
);
const { createServer } = require("../../server.cjs");
const phase = process.argv[2] || "after";
const output = path.resolve("artifacts/collection-title-return", phase);
fs.mkdirSync(output, { recursive: true });
const web = createServer({
  music: {
    search: async () => ({ items: [] }),
    details: async () => ({}),
    summary: async () => ({}),
    recommendations: async () => ({ items: [] }),
    artistPhoto: async () => ({}),
  },
});
let browser;
(async () => {
  try {
    await new Promise((resolve) => web.listen(0, "127.0.0.1", resolve));
    browser = await chromium.launch({
      executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      headless: true,
    });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    await context.route("https://**/*", (route) => route.abort());
    await context.addInitScript(() => {
      localStorage.setItem("myspace-collection-view", "list");
      sessionStorage.setItem(
        "myspace-reading-positions",
        JSON.stringify(
          ["#perfil", "#fotos", "#buscar", "#descobrir", "#spacevoice"].map((hash) => [hash, 500]),
        ),
      );
      localStorage.setItem(
        "myspace-extras-v1",
        JSON.stringify({
          version: 1,
          items: ["film", "series", "game"].flatMap((kind) =>
            Array.from({ length: 40 }, (_, n) => ({
              id: kind + n,
              kind,
              title: kind + " fixture " + n,
              status: kind === "film" && n === 0 ? "active" : "planned",
              progress:
                kind === "film" && n === 0 ? 2 : kind === "film" && n === 1 ? 3 : 0,
              total: kind === "film" && n === 0 ? 5 : 0,
              ...(kind === "film" && n === 0
                ? { startedAt: "2026-01-10", lists: ["Existing list"], updated: 100 }
                : {}),
              ...(kind === "film" && n === 1 ? { updated: 200 } : {}),
              ...(kind === "film" && n === 2 ? { notes: "Keep this", updated: 300 } : {}),
              ...(kind === "film" && n >= 10 && n < 18 ? { featured: true } : {}),
              image: "/profile-art.png",
            })),
          ),
        }),
      );
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${web.address().port}/?voiceTransport=local#colecao/film`);
    await page.waitForSelector("#collectionPage");
    await page.evaluate(() => {
      window.__scrollCalls = [];
      const original = window.scrollTo.bind(window);
      window.scrollTo = (options) => {
        __scrollCalls.push(options);
        return original(options);
      };
    });

    await page.evaluate(() => {
      Catalog.details = async (item) => ({
        ...item,
        summary: Array(80).fill("Long detail fixture.").join("\n\n"),
      });
      Catalog.summary = async (item) => item;
    });
    async function settle() {
      await page.waitForTimeout(300);
    }
    async function mode(value) {
      await page.evaluate((value) => {
        localStorage.setItem("myspace-collection-view", value);
        dispatchEvent(new Event("myspace:preferences-restored"));
      }, value);
      await settle();
    }
    async function openFromCollection(view) {
      return page.evaluate(async (view) => {
        scrollTo({ top: 900, behavior: "instant" });
        await new Promise(requestAnimationFrame);
        const selector = view === "list" ? ".list-entry" : ".shelf-cover";
        const nodes = [...document.querySelectorAll(selector)];
        const node = nodes.find((node) => {
          const box = node.getBoundingClientRect();
          return box.top >= 0 && box.bottom < innerHeight;
        });
        if (!node) throw Error("No visible origin fixture");
        node.focus({ preventScroll: true });
        const id = node.dataset.itemId,
          y = scrollY;
        if (view === "list") {
          node.click();
          node.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
        } else node.click();
        return { id, y };
      }, view);
    }
    async function returned(origin, view) {
      await settle();
      const state = await page.evaluate(() => ({
        y: scrollY,
        id: document.activeElement.dataset.itemId,
        selected: document.querySelector('.list-entry[aria-pressed="true"]')?.dataset.itemId,
        xmb: !!document.querySelector(".xmb:not([hidden])"),
      }));
      assert.ok(Math.abs(state.y - origin.y) < 2, "return camera " + JSON.stringify(state));
      assert.equal(state.id, origin.id, "origin focus");
      if (view === "list") assert.equal(state.selected, origin.id);
      assert.equal(state.xmb, false);
      return state;
    }
    const runs = [];
    for (const view of ["covers", "list"]) {
      await mode(view);
      const origin = await openFromCollection(view);
      await settle();
      assert.ok((await page.evaluate(() => scrollY)) < 2, "detail entry");
      if (view === "covers") await page.goBack();
      else await page.getByRole("button", { name: "← voltar", exact: true }).click();
      runs.push({ view, origin, returned: await returned(origin, view) });
      await page.locator('.nav a[data-route="spacevoice"]').click();
      await settle();
      await page.locator('.nav a[data-route="colecao"]').click();
      await settle();
      assert.ok((await page.evaluate(() => scrollY)) < 2, "origin does not leak into header entry");
      await page.evaluate(() => {
        location.hash = "#colecao/film";
      });
      await settle();
    }
    await page.locator('.nav a[data-route="buscar"]').click();
    await settle();
    await page.evaluate(() =>
      TitlePages.open({
        kind: "music",
        catalogId: "itunes:search-fixture",
        title: "Search fixture",
      }),
    );
    await settle();
    await page.getByRole("button", { name: "← voltar", exact: true }).click();
    await settle();
    assert.equal(await page.evaluate(() => location.hash), "#buscar");
    assert.ok((await page.evaluate(() => scrollY)) < 2, "search does not restore Collection");

    await page.locator('.nav a[data-route="colecao"]').click();
    await page.evaluate(() => {
      location.hash = "#colecao/film";
    });
    await page.waitForSelector('.list-entry[data-item-id="film0"]');
    const bulkBefore = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("myspace-extras-v1")).items,
    );
    assert.equal(bulkBefore.length, 120);
    const bulkTargets = new Set(["film0", "film1"]);

    await page.getByRole("button", { name: "selecionar títulos", exact: true }).click();
    await page.getByRole("button", { name: "Marcar film fixture 0", exact: true }).click();
    await page.getByRole("button", { name: "Marcar film fixture 1", exact: true }).click();
    await page.getByLabel("Ação para os selecionados").selectOption("favorite");
    await page.getByRole("button", { name: "aplicar aos selecionados", exact: true }).click();
    const afterRejectedBulk = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("myspace-extras-v1")).items,
    );
    assert.equal(
      await page.locator("#toast").textContent(),
      "A vitrine tem até 8 favoritos.",
      "bulk favorite must report the validation error",
    );
    assert.deepEqual(
      afterRejectedBulk,
      bulkBefore,
      "validation error must not persist partial bulk changes",
    );

    await page.getByRole("button", { name: "limpar seleção", exact: true }).click();
    await page.getByRole("button", { name: "Marcar film fixture 0", exact: true }).click();
    await page.getByRole("button", { name: "Marcar film fixture 1", exact: true }).click();
    await page.getByLabel("Ação para os selecionados").selectOption("status");
    await page.getByLabel("Status em lote").selectOption("done");
    await page.getByRole("button", { name: "aplicar aos selecionados", exact: true }).click();
    const afterStatus = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("myspace-extras-v1")).items,
    );
    assert.deepEqual(
      afterStatus.map((item) => item.id),
      bulkBefore.map((item) => item.id),
      "bulk status must preserve every Collection record",
    );
    assert.deepEqual(
      afterStatus.filter((item) => !bulkTargets.has(item.id)),
      bulkBefore.filter((item) => !bulkTargets.has(item.id)),
      "unselected records and timestamps must remain unchanged",
    );
    const doneFilm0 = afterStatus.find((item) => item.id === "film0");
    const doneFilm1 = afterStatus.find((item) => item.id === "film1");
    assert.equal(doneFilm0.status, "done");
    assert.equal(doneFilm0.progress, doneFilm0.total);
    assert.equal(doneFilm0.startedAt, "2026-01-10");
    assert.match(doneFilm0.finishedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(doneFilm0.updated > 100);
    assert.equal(doneFilm1.status, "done");
    assert.equal(doneFilm1.progress, 3, "unknown total preserves existing progress");
    assert.match(doneFilm1.finishedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(doneFilm1.updated > 200);

    await page.getByRole("button", { name: "Marcar film fixture 0", exact: true }).click();
    await page.getByLabel("Ação para os selecionados").selectOption("addList");
    await page.getByLabel("Lista para os selecionados").fill("Bulk selected");
    await page.getByRole("button", { name: "aplicar aos selecionados", exact: true }).click();
    const afterList = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("myspace-extras-v1")).items,
    );
    assert.deepEqual(
      afterList.map((item) => item.id),
      afterStatus.map((item) => item.id),
      "bulk list update must preserve every Collection record",
    );
    assert.deepEqual(
      afterList.filter((item) => item.id !== "film0"),
      afterStatus.filter((item) => item.id !== "film0"),
      "list changes must affect only selected IDs",
    );
    assert.deepEqual(
      afterList.find((item) => item.id === "film0").lists,
      ["Existing list", "Bulk selected"],
    );
    assert.ok(afterList.find((item) => item.id === "film0").updated > doneFilm0.updated);
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, "report.json"), JSON.stringify({ runs, errors }, null, 2));
    console.log(
      "Collection: selected-only bulk status/lists, validation atomicity, and title return passed.",
    );
  } finally {
    await browser?.close();
    await new Promise((resolve) => web.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
