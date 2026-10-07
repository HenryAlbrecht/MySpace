/* PARTY v1.2: one browser, two contexts, one room-chat lifecycle. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http");
const { once } = require("node:events");
const { chromium } = require(
  path.join(
    require("node:os").homedir(),
    ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
  ),
);
const { createSignalingServer } = require("../server/signaling-server.cjs");
const result = { contexts: 2, checks: [], errors: [] };
(async () => {
  const root = path.resolve("dist");
  let web, signaling, browser;
  const contexts = [];
  try {
    web = http.createServer((req, res) => {
      try {
        const pathname = new URL(req.url, "http://localhost").pathname;
        const file = path.resolve(root, "." + (pathname === "/" ? "/index.html" : pathname));
        if (!file.startsWith(root + path.sep)) {
          res.writeHead(403);
          return res.end();
        }
        res.setHeader(
          "Content-Type",
          {
            ".js": "text/javascript",
            ".html": "text/html; charset=utf-8",
            ".css": "text/css",
            ".png": "image/png",
          }[path.extname(file)] || "application/octet-stream",
        );
        res.end(fs.readFileSync(file));
      } catch {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise((r) => web.listen(0, "127.0.0.1", r));
    signaling = createSignalingServer({ port: 0, host: "127.0.0.1" });
    await once(signaling.wss, "listening");
    const wsUrl = "ws://127.0.0.1:" + signaling.wss.address().port,
      origin = "http://127.0.0.1:" + web.address().port;
    const href =
      origin +
      "/?party=chat-lifecycle-test&voiceTransport=websocket&voiceWsUrl=" +
      encodeURIComponent(wsUrl) +
      "#spacevoice";
    browser = await chromium.launch({
      executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      headless: true,
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
        "--autoplay-policy=no-user-gesture-required",
      ],
    });
    async function client(name) {
      const context = await browser.newContext({
        permissions: ["microphone"],
        viewport: { width: 1280, height: 900 },
      });
      contexts.push(context);
      await context.addInitScript(
        ({ name, wsUrl }) => {
          localStorage.setItem("myspace-profile-v1", JSON.stringify({ name, avatar: "" }));
          window.SPACEVOICE_CONFIG = { url: wsUrl };
          window.__pcs = [];
          window.__mic = 0;
          const PC = RTCPeerConnection;
          window.RTCPeerConnection = class extends PC {
            constructor(...args) {
              super(...args);
              window.__pcs.push(this);
            }
          };
          const get = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
          navigator.mediaDevices.getUserMedia = (...args) => {
            window.__mic++;
            return get(...args);
          };
        },
        { name, wsUrl },
      );
      await context.route("**/spacevoice.js", (route) =>
        route.fulfill({
          contentType: "text/javascript",
          body:
            fs.readFileSync(path.join(root, "spacevoice.js"), "utf8") +
            ";const __originalParty=createSpaceVoice;createSpaceVoice=options=>{window.__partyUI=__originalParty(options);return __partyUI;};",
        }),
      );
      const page = await context.newPage();
      page.on("pageerror", (e) => result.errors.push(e.message));
      await page.goto(href, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(
        () =>
          window.__partyUI?.room.state.roomId === "chat-lifecycle-test" &&
          __partyUI.room.state.status === "conectado",
      );
      return page;
    }
    const input = (page) => page.getByRole("textbox", { name: "Mensagem para a sala" }),
      messages = (page) => page.locator(".spacevoice-chat-text");
    const send = async (page, value) => {
      await input(page).fill(value);
      await input(page).press("Enter");
    };
    const has = async (page, value) =>
      page.waitForFunction(
        (v) =>
          [...document.querySelectorAll(".spacevoice-chat-text")].some((n) => n.textContent === v),
        value,
      );
    const a = await client("Alice");
    assert.deepEqual(await a.evaluate(() => ({ pcs: __pcs.length, mic: __mic })), {
      pcs: 0,
      mic: 0,
    });
    assert.equal(await a.locator(".party-chat-toggle").isVisible(), true);
    await a.locator(".party-chat-toggle").click();
    await send(a, "histórico no lobby");
    await has(a, "histórico no lobby");
    result.checks.push("A sends in room lobby with zero microphone/PC");
    const b = await client("Luna");
    await b.waitForFunction(() => __partyUI.room.state.participants.length === 2);
    await has(b, "histórico no lobby");
    assert.deepEqual(
      await b.evaluate(() => ({
        pcs: __pcs.length,
        mic: __mic,
        unread: __partyUI.chat.state.unread,
      })),
      { pcs: 0, mic: 0, unread: 0 },
    );
    result.checks.push("late lobby member receives targeted history; neither creates WebRTC");
    await b.locator(".party-chat-toggle").click();
    await input(b).fill("estou digitando");
    await a.waitForFunction(() =>
      document.querySelector(".spacevoice-chat-typing").textContent.includes("Luna"),
    );
    await send(b, "resposta no lobby");
    await has(a, "resposta no lobby");
    await a.waitForFunction(() => !document.querySelector(".spacevoice-chat-typing").textContent);
    result.checks.push("typing and two-way messages work before call");
    const longMessage = Array.from({ length: 90 }, (_, i) => "linha " + i).join("\n");
    await send(a, longMessage);
    await has(a, longMessage);
    await has(b, longMessage);
    await a.locator(".spacevoice-chat-log").evaluate((node) => {
      node.scrollTop = 60;
      node.dispatchEvent(new Event("scroll"));
    });
    assert.ok(
      await a
        .locator(".spacevoice-chat-log")
        .evaluate((node) => node.scrollHeight > node.clientHeight && node.scrollTop > 0),
    );
    await b.locator(".party-chat-toggle").click();
    await send(a, "não lida no lobby");
    await b.waitForFunction(() => __partyUI.chat.state.unread === 1);
    assert.equal(await b.locator(".party-chat-toggle").innerText(), "[ chat · 1 > ]");
    result.checks.push("closed lobby chat increments unread");
    await input(a).fill("draft atravessa call");
    const before = await a.evaluate(() => ({
      room: __partyUI.chat.state.roomId,
      count: __partyUI.chat.state.messages.length,
      chatOpen: document.querySelector(".spacevoice").dataset.chatOpen,
      scroll: document.querySelector(".spacevoice-chat-log").scrollTop,
    }));
    await a.getByRole("button", { name: "[ entrar na chamada ]", exact: true }).click();
    await a.waitForFunction(() => __partyUI.call.state.joined);
    assert.equal(await a.evaluate(() => __pcs.length), 0);
    assert.equal(await input(a).inputValue(), "draft atravessa call");
    assert.equal(
      await a.evaluate(() => document.querySelector(".spacevoice").dataset.chatOpen),
      "true",
    );
    assert.equal(
      await a.evaluate(() => document.querySelector(".spacevoice-chat-log").scrollTop),
      before.scroll,
    );
    result.checks.push("entering call alone preserves open chat/draft and creates no peer");
    await b.getByRole("button", { name: "[ entrar na chamada ]", exact: true }).click();
    await b.waitForFunction(() => __partyUI.call.state.joined);
    for (const page of [a, b]) await page.waitForFunction(() => __pcs.length === 1);
    assert.equal(await b.evaluate(() => __partyUI.chat.state.unread), 1);
    await b.getByRole("button", { name: "Sair da party", exact: true }).click();
    await b.waitForFunction(() => !__partyUI.call.state.joined);
    assert.equal(await b.locator(".party-chat-toggle").isVisible(), true);
    assert.equal(await b.evaluate(() => __partyUI.chat.state.unread), 1);
    assert.equal(
      await a.evaluate(() => document.querySelector(".spacevoice").dataset.chatOpen),
      "true",
    );
    assert.equal(await input(a).inputValue(), "draft atravessa call");
    assert.equal(
      await a.evaluate(() => document.querySelector(".spacevoice-chat-log").scrollTop),
      before.scroll,
    );
    await send(a, "depois da call");
    await has(a, "depois da call");
    await has(b, "depois da call");
    assert.equal(await b.evaluate(() => __partyUI.chat.state.unread), 2);
    assert.equal(await a.evaluate(() => __partyUI.chat.state.messages.length), before.count + 1);
    result.checks.push("leaving call retains room chat, draft, open state and messages");
    await a.getByRole("button", { name: "[ nova party ]", exact: true }).click();
    await a.waitForFunction(
      () =>
        __partyUI.room.state.roomId !== "chat-lifecycle-test" &&
        __partyUI.room.state.participants.length === 1,
    );
    assert.equal(await a.evaluate(() => __partyUI.chat.state.messages.length), 0);
    assert.equal(await a.evaluate(() => __partyUI.chat.state.draft), "");
    assert.equal(
      await a.evaluate(() => document.querySelector(".spacevoice").dataset.chatOpen),
      "false",
    );
    await b.locator(".party-chat-toggle").click();
    await send(b, "apenas sala antiga");
    await has(b, "apenas sala antiga");
    await a.waitForTimeout(100);
    assert.equal(await messages(a).filter({ hasText: "apenas sala antiga" }).count(), 0);
    result.checks.push("new party resets chat and isolates old room messages");
    await a.getByRole("button", { name: "[ sair da sala ]", exact: true }).click();
    await a.waitForFunction(() => __partyUI.room.state.roomId === null);
    assert.equal(await a.locator(".party-chat-toggle").isVisible(), false);
    assert.equal(await a.evaluate(() => __partyUI.chat.state.roomId), null);
    result.checks.push("leaving room cleans chat and hides toggle");
    assert.deepEqual(result.errors, []);
    result.passed = true;
  } catch (error) {
    result.passed = false;
    result.failure = error.message;
    throw error;
  } finally {
    for (const context of contexts) await context.close().catch(() => {});
    await browser?.close().catch(() => {});
    if (signaling) {
      for (const socket of signaling.wss.clients) socket.terminate();
      await new Promise((r) => signaling.wss.close(r));
    }
    if (web?.listening) await new Promise((r) => web.close(r));
    result.cleanedUp = true;
    console.log(JSON.stringify(result));
  }
})().catch(() => {
  process.exitCode = 1;
});
