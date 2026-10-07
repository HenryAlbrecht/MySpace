// Light visual verification: one browser, one context, one page, mocked call/session.
// No real microphone, signaling, AudioContext, or RTCPeerConnection is started.
const fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http"),
  assert = require("node:assert/strict");
const { chromium } = require(
  path.join(
    require("node:os").homedir(),
    ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
  ),
);
const output = path.resolve("artifacts/party-context-rail");
fs.mkdirSync(output, { recursive: true });
const report = { checks: [], errors: [], fixture: true, browserContexts: 1 };
(async () => {
  const root = path.resolve("dist");
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const file = path.resolve(root, "." + (pathname === "/" ? "/index.html" : pathname));
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(403);
      return res.end();
    }
    try {
      const content = fs.readFileSync(file);
      res.setHeader(
        "Content-Type",
        {
          ".html": "text/html",
          ".js": "text/javascript",
          ".css": "text/css",
          ".png": "image/png",
        }[path.extname(file)] || "application/octet-stream",
      );
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  let browser, context;
  try {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    browser = await chromium.launch({
      executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      headless: true,
    });
    context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    await context.route("**/voice/media.js", (route) =>
      route.fulfill({
        contentType: "text/javascript",
        body: `function createVoiceMedia(){const track={enabled:true,label:'Microfone — fixture visual',getSettings:()=>({}),stop(){}};return {enumerate:async()=>({inputs:[],outputs:[]}),watchDevices:()=>()=>{},acquire:async()=>({getAudioTracks:()=>[track],getTracks:()=>[track]}),release(){},mute:(s,m)=>{track.enabled=!m;}};}`,
      }),
    );
    await context.route("**/voice/levels.js", (route) =>
      route.fulfill({
        contentType: "text/javascript",
        body: `window.__partyMeters=new Map();function createVoiceLevels(){return {start(){},stop(){},remove(){},setMuted(){},monitor:(id,s,fn)=>window.__partyMeters.set(id,fn)};}`,
      }),
    );
    await context.route("**/voice/session.js", (route) =>
      route.fulfill({
        contentType: "text/javascript",
        body: `function createVoiceSession(hooks){window.__partyHooks=hooks;return {start(){hooks.onStatus('conectado');},close(){},setMuted(){},setScreen(){},sendApplication(){return true;}};}`,
      }),
    );
    await context.route("**/voice/state.js", (route) =>
      route.fulfill({
        contentType: "text/javascript",
        body:
          fs.readFileSync(path.join(root, "voice/state.js"), "utf8") +
          `;const nativeCall=createVoiceCall;createVoiceCall=(...args)=>{const call=nativeCall(...args);window.__partyCall=call;return call;};`,
      }),
    );
    const page = await context.newPage();
    page.on("pageerror", (e) => report.errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") report.errors.push(m.text());
    });
    await page.addInitScript(() => {
      window.__partyRtcCount = 0;
      window.RTCPeerConnection = class {
        constructor() {
          window.__partyRtcCount++;
          throw Error("Visual fixture must not start RTC");
        }
      };
      navigator.mediaDevices.getUserMedia = () => {
        throw Error("Visual fixture must not capture microphone");
      };
      HTMLMediaElement.prototype.setSinkId = async () => {};
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/#spacevoice`, {
      waitUntil: "domcontentloaded",
    });
    await page.locator(".spacevoice").waitFor();
    await page.evaluate(() => {
      document.documentElement.style.setProperty("--accent", "#baa7ec");
    });
    const settle = () =>
      page.evaluate(() =>
        Promise.all(
          document
            .querySelector(".spacevoice")
            .getAnimations({ subtree: true })
            .map((a) => a.finished.catch(() => {})),
        ),
      );
    const shot = async (name) => {
      await settle();
      await page.screenshot({
        path: path.join(output, name + ".png"),
        fullPage: true,
      });
    };
    await shot("01-closed");
    const height = () =>
      page.locator(".spacevoice").evaluate((e) => e.getBoundingClientRect().height);
    const initialHeight = await height();
    const mediaToggle = page.getByRole("button", {
      name: "[ mídia > ]",
      exact: true,
    });
    await mediaToggle.click();
    await settle();
    assert.equal(await page.locator(".spacevoice").getAttribute("data-context"), "media");
    assert.ok(Math.abs((await height()) - initialHeight) < 2);
    await shot("02-media-open");
    const field = page.getByLabel("Bitrate do vídeo da tela", { exact: true });
    await field.selectOption("14000000");
    await page.waitForFunction(() => !document.querySelector(".party-media-notice").textContent);
    await page.getByLabel("Cancelamento de eco", { exact: true }).uncheck();
    await page.waitForFunction(() => !document.querySelector(".party-media-notice").textContent);
    await page.evaluate(() => {
      window.__form = document.querySelector(".party-media-inner");
      __form.scrollTop = 90;
      window.__formScroll = __form.scrollTop;
    });
    await page.getByRole("button", { name: "[ mídia < ]", exact: true }).click();
    await settle();
    await mediaToggle.click();
    await settle();
    assert.equal(await field.inputValue(), "14000000");
    assert.equal(await page.getByLabel("Cancelamento de eco", { exact: true }).isChecked(), false);
    assert.equal(
      await page.evaluate(
        () =>
          __form === document.querySelector(".party-media-inner") &&
          __form.scrollTop === __formScroll,
      ),
      true,
    );
    await page.evaluate(() => __partyCall.join());
    await page.locator(".spacevoice header button[aria-expanded]").click();
    await settle();
    assert.equal(await page.locator(".spacevoice").getAttribute("data-context"), "chat");
    await page.locator(".spacevoice-chat-input").fill("draft preservado");
    await mediaToggle.click();
    await settle();
    assert.equal(await page.locator(".spacevoice-chat").evaluate((e) => e.inert), true);
    await page.locator(".spacevoice header button[aria-expanded]").click();
    await settle();
    assert.equal(await page.locator(".spacevoice-chat-input").inputValue(), "draft preservado");
    await page.evaluate(async () => {
      await __partyCall.join();
      __partyHooks.onPeers([{ id: "luna", status: "conectado" }]);
      const canvas = document.createElement("canvas");
      canvas.width = 1280;
      canvas.height = 720;
      const c = canvas.getContext("2d");
      c.fillStyle = "#253e52";
      c.fillRect(0, 0, 1280, 720);
      c.fillStyle = "#c6d7df";
      c.font = "28px monospace";
      c.fillText("PARTY // tela de teste", 48, 70);
      __partyScreen = canvas.captureStream(20);
      __partyHooks.onScreen("luna", __partyScreen);
    });
    await page.waitForFunction(() => document.querySelector(".spacevoice video")?.readyState >= 2);
    await settle();
    await page.evaluate(() => {
      window.__video = document.querySelector(".spacevoice video");
    });
    const screenHeight = await height();
    const frames = await page.evaluate(async () => {
      document.querySelector(".spacevoice-secondary-controls button").click();
      const frames = [],
        start = performance.now();
      while (performance.now() - start < 250) {
        await new Promise(requestAnimationFrame);
        frames.push({
          width: document.querySelector(".party-context-rail").getBoundingClientRect().width,
          opacity: Number(
            getComputedStyle(document.querySelector(".party-media-settings")).opacity,
          ),
          height: document.querySelector(".spacevoice").getBoundingClientRect().height,
          inner: document.querySelector(".party-media-inner").getBoundingClientRect().width,
        });
      }
      return frames;
    });
    await settle();
    assert.equal(await page.locator(".spacevoice").getAttribute("data-context"), "media");
    assert.ok(frames.some((f) => f.width > 277 && f.width < 339));
    assert.ok(frames.some((f) => f.opacity > 0 && f.opacity < 1));
    assert.ok(frames.every((f) => Math.abs(f.inner - 340) < 1));
    assert.ok(
      Math.abs((await height()) - screenHeight) < 2,
      "opening rail must not grow screen height",
    );
    report.frames = frames;
    assert.equal(
      await page.evaluate(
        () =>
          __video === document.querySelector(".spacevoice video") &&
          __video.srcObject === __partyScreen,
      ),
      true,
    );
    await shot("03-screen-media");
    assert.equal(await page.locator(".party-context-rail").count(), 1);
    await page.setViewportSize({ width: 390, height: 844 });
    await settle();
    await shot("04-mobile");
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(
      await page
        .locator(".party-media-settings")
        .evaluate((e) => getComputedStyle(e).transitionDuration),
      "0s",
    );
    assert.equal(
      await page
        .locator(".spacevoice-body")
        .evaluate((e) => getComputedStyle(e).transitionDuration),
      "0s",
    );
    await page.evaluate(() => {
      __partyHooks.onScreen("luna", null);
      __partyScreen.getTracks().forEach((t) => t.stop());
      __partyCall.leave();
    });
    assert.equal(await page.evaluate(() => __partyRtcCount), 0);
    assert.deepEqual(report.errors, []);
    report.checks = [
      "one shared rail, chat/media exclusive",
      "form values and mounted DOM/scroll preserved",
      "chat draft preserved through media",
      "pre-call and screen height stable",
      "intermediate grid widths and opacity; inner width 340px",
      "video/srcObject identity preserved",
      "mobile no horizontal overflow",
      "reduced motion instantaneous",
      "zero RTC/microphone capture",
    ];
    report.passed = true;
  } finally {
    await context?.close();
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
    report.cleanup = {
      browserClosed: !browser?.isConnected(),
      serverClosed: !server.listening,
    };
    fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
