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
  { createSignalingServer } = require("../../server/party/signaling-server.cjs");
(async () => {
  const web = createServer(),
    signal = createSignalingServer({ port: 0, host: "127.0.0.1" }),
    contexts = [];
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
    const errors = [];
    async function client(href, cold = false) {
      const context = await browser.newContext();
      contexts.push(context);
      await context.addInitScript(() => {
        window.__avatarGate = new Promise((r) => (window.__releaseAvatar = r));
      });
      await context.route("**/spacevoice.js", (r) =>
        r.fulfill({
          contentType: "text/javascript",
          body:
            fs.readFileSync("dist/spacevoice.js", "utf8") +
            `;const original=createSpaceVoice;createSpaceVoice=o=>{const prepare=o.prepareAvatar;o.prepareAvatar=async v=>{await __avatarGate;return prepare(v);};window.__ui=original(o);return __ui;};`,
        }),
      );
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(href);
      await page.waitForFunction(() => window.__ui);
      if (cold)
        await page.evaluate(() => {
          window.dispatchEvent(new Event("hashchange"));
          window.dispatchEvent(new Event("hashchange"));
        });
      await page.evaluate(() => __releaseAvatar());
      await page.waitForFunction(
        () => __ui.chat.state.connected && __ui.chat.state.roomId === __ui.room.state.roomId,
      );
      return page;
    }
    const url = new URL(`http://127.0.0.1:${web.address().port}/#spacevoice`);
    url.searchParams.set("voiceWsUrl", `ws://127.0.0.1:${signal.wss.address().port}`);
    const a = await client(url.href, true),
      id = new URL(a.url()).searchParams.get("party");
    assert.match(id, /^[0-9a-f-]{36}$/);
    await a.locator(".party-chat-toggle").click();
    assert.equal(await a.locator(".spacevoice-chat-input").isEnabled(), true);
    async function send(page, text) {
      await page.locator(".spacevoice-chat-input").fill(text);
      await page.getByRole("button", { name: "[ enviar ]", exact: true }).click();
      await page.waitForFunction(
        (text) => __ui.chat.state.messages.some((m) => m.text === text),
        text,
      );
    }
    await send(a, "cold start sem nova party");
    const b = await client(a.url());
    await b.waitForFunction(() => __ui.chat.state.messages.length === 1);
    await a.locator(".spacevoice-chat-input").fill("draft preservado");
    await a.locator(".party-chat-toggle").click();
    await b.locator(".party-chat-toggle").click();
    await send(b, "segunda mensagem");
    await a.waitForFunction(() => __ui.chat.state.unread === 1);
    await a.locator(".party-chat-toggle").click();
    assert.equal(await a.locator(".spacevoice-chat-input").inputValue(), "draft preservado");
    if (await a.evaluate(() => __ui.chat.state.unread))
      await a.getByRole("button", { name: /novas mensagens/ }).click();
    assert.equal(await a.evaluate(() => __ui.chat.state.unread), 0);
    await a.getByRole("button", { name: "[ sair da sala ]", exact: true }).click();
    await a.getByRole("button", { name: "[ entrar na sala ]", exact: true }).click();
    await a.waitForFunction(
      () => __ui.chat.state.connected && __ui.chat.state.messages.length === 2,
    );
    await a.locator(".party-chat-toggle").click();
    await send(a, "depois da reentrada");
    await b.waitForFunction(() => __ui.chat.state.messages.length === 3);
    assert.equal(
      await b.evaluate(() => new Set(__ui.chat.state.messages.map((m) => m.id)).size),
      3,
    );
    assert.equal(signal.rooms.get(id).size, 2);
    await a.getByRole("button", { name: "[ nova party ]", exact: true }).click();
    await a.waitForFunction(
      (old) => __ui.chat.state.connected && __ui.room.state.roomId !== old,
      id,
    );
    await a.locator(".party-chat-toggle").click();
    await send(a, "nova party funciona");
    assert.deepEqual(errors, []);
    console.log(
      "PASS: cold start, repeated route entry, existing invite/history, draft/unread, reentry, unique messages and new party; two contexts.",
    );
  } finally {
    for (const c of contexts) await c.close();
    await browser?.close();
    for (const s of signal.wss.clients) s.terminate();
    await new Promise((r) => signal.wss.close(r));
    await new Promise((r) => web.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
