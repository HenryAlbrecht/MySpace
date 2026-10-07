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
const { createServer } = require("../server.cjs"),
  { createSignalingServer } = require("../server/signaling-server.cjs");
(async () => {
  const web = createServer(),
    signal = createSignalingServer({ port: 0, host: "127.0.0.1" }),
    errors = [];
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
    async function client(url, name, mood) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      });
      await context.addInitScript(
        ({ name, mood }) => {
          localStorage.setItem("myspace-profile-v1", JSON.stringify({ name, mood }));
          window.__captures = 0;
          navigator.mediaDevices.getUserMedia = () => {
            __captures++;
            throw Error("Unexpected capture");
          };
        },
        { name, mood },
      );
      // Test-only compressed idle deadline; production keeps five minutes.
      await context.route("**/voice/presence.js", (r) =>
        r.fulfill({
          contentType: "text/javascript",
          body:
            fs.readFileSync("dist/voice/presence.js", "utf8") +
            ";const factory=PARTY_PRESENCE.create;PARTY_PRESENCE.create=o=>factory({...o,idleMs:2000});",
        }),
      );
      await context.route("**/spacevoice.js", (r) =>
        r.fulfill({
          contentType: "text/javascript",
          body:
            fs.readFileSync("dist/spacevoice.js", "utf8") +
            ";const original=createSpaceVoice;createSpaceVoice=o=>window.__ui=original(o);",
        }),
      );
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      await page.goto(url);
      await page.waitForFunction(() => window.__ui?.chat.state.connected);
      return page;
    }
    const url = `http://127.0.0.1:${web.address().port}/?voiceWsUrl=${encodeURIComponent("ws://127.0.0.1:" + signal.wss.address().port)}#spacevoice`;
    const a = await client(url, "Alice", "<img src=x onerror=window.__xss=1>"),
      b = await client(a.url(), "Bob", "");
    const id = await a.evaluate(() => __ui.room.state.roomId);
    await b.waitForFunction(() => __ui.room.state.participants.length === 2);
    const remote = b.locator(".spacevoice-participants li[data-peer-id]");
    assert.equal(
      await remote.locator(".party-presence-mood").innerText(),
      "<img src=x onerror=window.__xss=1>",
    );
    assert.equal(await b.evaluate(() => window.__xss), undefined);
    assert.equal(await b.locator(".party-presence-mood img").count(), 0);
    await b.waitForFunction(
      () => __ui.room.state.participants.find((p) => p.displayName === "Alice")?.idle === true,
    );
    assert.equal(await remote.locator(".spacevoice-speaking").innerText(), "ausente");
    assert.equal(signal.rooms.get(id).size, 2);
    await a.mouse.move(400, 300);
    await b.waitForFunction(
      () => __ui.room.state.participants.find((p) => p.displayName === "Alice")?.idle === false,
    );
    assert.equal(await remote.locator(".spacevoice-speaking").innerText(), "na sala");
    await a.evaluate(() => {
      state.mood = "tentando terminar Trails";
      window.dispatchEvent(new Event("myspace-profile-change"));
    });
    await b.waitForFunction(
      () =>
        __ui.room.state.participants.find((p) => p.displayName === "Alice")?.statusText ===
        "tentando terminar Trails",
    );
    await b.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(
      await remote
        .locator(".party-presence-mood")
        .evaluate((n) => getComputedStyle(n).animationName),
      "none",
    );
    fs.mkdirSync("artifacts/party-v14", { recursive: true });
    await b.screenshot({ path: "artifacts/party-v14/presence.png" });
    await a.getByRole("button", { name: "[ nova party ]", exact: true }).click();
    await b.waitForFunction(() => __ui.room.state.participants.length === 1);
    assert.equal(await b.locator("li[data-peer-id]").count(), 0);
    assert.equal(await a.evaluate(() => __captures), 0);
    assert.equal(await b.evaluate(() => __captures), 0);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: two contexts, mood text/XSS, idle->active sync, counts, profile event, room isolation, reduced motion; no media or console errors.",
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
