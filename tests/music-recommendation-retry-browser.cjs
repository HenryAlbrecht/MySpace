const assert = require("node:assert/strict"),
  path = require("node:path");
const { chromium } = require(
    path.join(
      require("node:os").homedir(),
      ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
    ),
  ),
  { createServer } = require("../server.cjs");
(async () => {
  let browser,
    calls = 0;
  const row = {
    kind: "music",
    catalogId: "ytmusic:video:seed0000001",
    title: "Weirdo (2024 Digital Master)",
    artist: "Artist",
    source: "YouTube Music",
  };
  const web = createServer({
    music: {
      details: async () => row,
      recommendations: async () => {
        calls++;
        if (calls === 1) {
          const e = Error("Não foi possível consultar o YouTube Music. Tente novamente.");
          e.status = 503;
          throw e;
        }
        return {
          items: [
            {
              ...row,
              catalogId: "ytmusic:video:song0000002",
              title: "New Song",
            },
          ],
          seedFallback: true,
          seedTitle: "Weirdo",
          resolution: {
            failures: calls === 2 ? 1 : 0,
            status: calls === 2 ? "partial" : "complete",
          },
        };
      },
    },
  });
  try {
    await new Promise((r) => web.listen(0, "127.0.0.1", r));
    browser = await chromium.launch({
      executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      headless: true,
    });
    const page = await browser.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:" + web.address().port);
    await page.evaluate((row) => TitlePages.open(row), row);
    await page.locator("[data-title-discovery]").scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: "tentar novamente", exact: true }).waitFor();
    assert.ok(
      (await page.locator(".discovery-grid").first().locator("..").textContent()).includes(
        "Não foi possível carregar recomendações agora.",
      ),
    );
    await page.getByRole("button", { name: "tentar novamente", exact: true }).click();
    await page.locator("[data-title-discovery] .music-track-row").waitFor();
    assert.ok(
      (await page.locator(".discovery-grid").first().locator("..").textContent()).includes(
        "Algumas sugestões ainda",
      ),
    );
    await page.evaluate(() => {
      window.recoveryCard = document.querySelector("[data-title-discovery] .music-track-row");
    });
    await page.getByRole("button", { name: "tentar novamente", exact: true }).click();
    await page.waitForFunction(
      () =>
        document.querySelector("[data-title-discovery]").getAttribute("aria-busy") === "false" &&
        document.querySelector("[data-title-discovery] .text-action").textContent ===
          "ver outras recomendações",
    );
    assert.equal(
      await page.evaluate(
        () =>
          window.recoveryCard === document.querySelector("[data-title-discovery] .music-track-row"),
      ),
      true,
    );
    assert.equal(calls, 3);
    assert.equal(await page.locator("[data-title-discovery] .music-track-row").count(), 1);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: unavailable -> retry -> partial with card -> retry recovers without cached failure; one context, zero pageerrors.",
    );
    assert.ok(
      (await page.locator(".discovery-grid").first().locator("..").textContent()).includes(
        "Rádio da faixa no YouTube Music.",
      ),
    );
    assert.equal(await page.locator(".title-layout h1").textContent(), row.title);
  } finally {
    await browser?.close();
    web.closeAllConnections();
    await new Promise((r) => web.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
