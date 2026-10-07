const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  { once } = require("node:events");
const { chromium } = require(
  path.join(
    require("node:os").homedir(),
    ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
  ),
);
const { createServer } = require("../../server.cjs"),
  { createSignalingServer } = require("../../server/signaling-server.cjs");
(async () => {
  const web = createServer(),
    signal = createSignalingServer({ port: 0, host: "127.0.0.1" });
  let browser;
  try {
    await Promise.all([
      new Promise((r) => web.listen(0, "127.0.0.1", r)),
      once(signal.wss, "listening"),
    ]);
    browser = await chromium.launch({
      executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      headless: true,
    });
    const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      }),
      page = await context.newPage(),
      errors = [];
    page.setDefaultTimeout(10000);
    page.on("pageerror", (e) => errors.push(e.message));
    await context.route("**/spacevoice.js", (r) =>
      r.fulfill({
        contentType: "text/javascript",
        body:
          fs.readFileSync("dist/spacevoice.js", "utf8") +
          ";const original=createSpaceVoice;createSpaceVoice=o=>window.__ui=original(o);",
      }),
    );
    await page.goto(
      `http://127.0.0.1:${web.address().port}/?voiceWsUrl=${encodeURIComponent("ws://127.0.0.1:" + signal.wss.address().port)}#spacevoice`,
    );
    await page.waitForFunction(() => window.__ui?.chat.state.connected);
    fs.mkdirSync("artifacts/party-rename-inline", { recursive: true });
    const edit = page.getByRole("button", {
        name: "Editar nome da sala",
        exact: true,
      }),
      input = page.getByRole("textbox", { name: "Nome da sala", exact: true });
    const settle = () =>
      page.evaluate(async () => {
        await Promise.all(
          document
            .querySelector(".section-head")
            .getAnimations({ subtree: true })
            .map((a) => a.finished),
        );
      });
    await page.screenshot({ path: "artifacts/party-rename-inline/closed.png" });
    const body = await page.locator(".spacevoice-body").boundingBox(),
      actions = await page.locator(".party-room-actions").boundingBox();
    await edit.click();
    await settle();
    assert.equal(await page.locator(".section-head .party-room-name-editor").count(), 1);
    assert.equal(await page.locator(".party-room-actions .party-room-name-editor").count(), 0);
    assert.deepEqual(await page.locator(".spacevoice-body").boundingBox(), body);
    assert.deepEqual(await page.locator(".party-room-actions").boundingBox(), actions);
    await page.screenshot({ path: "artifacts/party-rename-inline/open.png" });
    await input.fill("cinema");
    await page.getByRole("button", { name: "[ salvar ]", exact: true }).click();
    await page.waitForFunction(() => __ui.room.state.name === "cinema");
    await edit.click();
    await input.fill("cancelado");
    await page.getByRole("button", { name: "[ cancelar ]", exact: true }).click();
    assert.equal(await page.evaluate(() => __ui.room.state.name), "cinema");
    await edit.click();
    await input.fill("escape");
    await input.press("Escape");
    assert.equal(await input.isVisible(), false);
    assert.equal(await page.evaluate(() => __ui.room.state.name), "cinema");
    await edit.click();
    await input.fill("madrugada");
    await input.press("Enter");
    await page.waitForFunction(() => __ui.room.state.name === "madrugada");
    await edit.click();
    await input.fill("");
    await input.press("Enter");
    await page.waitForFunction(() => __ui.room.state.name === "geral");
    await page.locator(".party-chat-toggle").click();
    await edit.click();
    await settle();
    assert.equal(await page.locator(".spacevoice-chat-input").isEnabled(), true);
    await page.screenshot({
      path: "artifacts/party-rename-inline/open-chat.png",
    });
    await input.press("Escape");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await edit.click();
    assert.equal(
      await page
        .locator(".party-room-name-editor")
        .evaluate((e) => getComputedStyle(e).animationName),
      "none",
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: inline header, stable body/actions, save/cancel, Enter/Escape, empty fallback, chat composer, reduced motion; one context.",
    );
  } finally {
    await browser?.close();
    for (const c of signal.wss.clients) c.terminate();
    await new Promise((r) => signal.wss.close(r));
    await new Promise((r) => web.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
