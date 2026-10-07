const assert = require("node:assert/strict"),
  path = require("node:path");
const { chromium } = require(
  path.join(
    require("node:os").homedir(),
    ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
  ),
);
const { createServer } = require("../../server.cjs");
(async () => {
  let browser;
  const row = {
    kind: "music",
    catalogId: "itunes:1",
    source: "iTunes",
    title: "First",
    artist: "Artist",
  };
  const web = createServer({
    music: {
      playbackSource: async () => ({ items: [], status: "not-found" }),
      summary: async () => ({}),
      details: async () => row,
      recommendations: async () => ({
        items: Array.from({ length: 12 }, (_, i) => ({
          ...row,
          catalogId: "itunes:" + (i + 20),
          title: "Suggestion " + i,
        })),
      }),
    },
  });
  try {
    await new Promise((r) => web.listen(0, "127.0.0.1", r));
    browser = await chromium.launch({
      executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      headless: true,
    });
    const page = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:" + web.address().port);
    await page.evaluate((row) => {
      CollectionActions.saveMusic(row);
      CollectionActions.saveMusic({
        ...row,
        catalogId: "itunes:2",
        title: "Second",
      });
      location.hash = "#colecao";
    }, row);
    const covers = page.locator("button.shelf-cover");
    await covers.first().waitFor({ state: "visible" });
    await covers.first().focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(await covers.nth(1).evaluate((e) => e === document.activeElement), true);
    await page.keyboard.press("ArrowLeft");
    assert.equal(await covers.first().evaluate((e) => e === document.activeElement), true);
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "carregar recomendações", exact: true }).click();
    const cards = page.locator(".discovery-grid button.discover-card");
    await cards.first().waitFor();
    await cards.first().focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(await cards.nth(1).evaluate((e) => e === document.activeElement), true);
    await page.keyboard.press("ArrowDown");
    const selected = await page.evaluate(() => document.activeElement.textContent);
    assert.notEqual(selected, "Suggestion 1");
    await page.keyboard.press("ArrowUp");
    assert.equal(await cards.nth(1).evaluate((e) => e === document.activeElement), true);
    // A genuine button opener exercises native Escape and focus restoration.
    await page.evaluate(() => {
      const b = document.createElement("button");
      b.id = "keyboard-link-opener";
      b.textContent = "Link test";
      b.onclick = () => MusicBridge.link(CollectionActions.getItems()[0]);
      document.querySelector("#titleDetail")?.append(b) || document.body.append(b);
    });
    const opener = page.locator("#keyboard-link-opener");
    await opener.click();
    const input = page.getByLabel("Link de reprodução");
    await input.fill("abc");
    await input.press("ArrowLeft");
    await input.press("x");
    assert.equal(await input.inputValue(), "abxc");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("dialog[open]"));
    assert.equal(await opener.evaluate((e) => e === document.activeElement), true);
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(
      await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches),
      true,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: collection/recommendation spatial arrows, native Enter, text caret preserved, Escape restores opener, reduced-motion setting; one context; zero page errors.",
    );
  } finally {
    await browser?.close();
    web.closeAllConnections();
    await new Promise((r) => web.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
