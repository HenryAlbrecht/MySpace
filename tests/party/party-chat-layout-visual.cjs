// One context, mocked media/session: presentation only, no RTC or microphone.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { chromium } = require(
  path.join(
    require("node:os").homedir(),
    ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
  ),
);
const { createServer } = require("../../server.cjs");
const phase = process.argv[2] || "after",
  output = path.resolve("artifacts/party-chat-layout", phase);
fs.mkdirSync(output, { recursive: true });
(async () => {
  const server = createServer(),
    report = { errors: [], states: [], phase };
  let browser, context;
  try {
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    browser = await chromium.launch({
      executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      headless: true,
    });
    context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    await context.route("**/voice/media.js", (r) =>
      r.fulfill({
        contentType: "text/javascript",
        body: `function createVoiceMedia(){const track={enabled:true,label:'fixture',getSettings:()=>({}),stop(){}};return {enumerate:async()=>({inputs:[],outputs:[]}),watchDevices:()=>()=>{},acquire:async()=>({getAudioTracks:()=>[track],getTracks:()=>[track]}),release(){},mute(){}};}`,
      }),
    );
    await context.route("**/voice/levels.js", (r) =>
      r.fulfill({
        contentType: "text/javascript",
        body: `function createVoiceLevels(){return {start(){},stop(){},remove(){},setMuted(){},monitor(){}};}`,
      }),
    );
    await context.route("**/voice/session.js", (r) =>
      r.fulfill({
        contentType: "text/javascript",
        body: `function createVoiceSession(h){return {start(){h.onStatus('conectado');},close(){},setMuted(){},setScreen(){},setMediaSettings(){}};}`,
      }),
    );
    await context.route("**/spacevoice.js", (r) =>
      r.fulfill({
        contentType: "text/javascript",
        body:
          fs.readFileSync("dist/spacevoice.js", "utf8") +
          ";const originalParty=createSpaceVoice;createSpaceVoice=o=>{window.__partyUI=originalParty(o);return __partyUI;};",
      }),
    );
    const page = await context.newPage();
    page.on("pageerror", (e) => report.errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/?voiceTransport=local#spacevoice`);
    await page.locator(".party-chat-toggle:not([hidden])").waitFor();
    const settle = () =>
      page.evaluate(() =>
        Promise.all(
          document
            .querySelector(".spacevoice")
            .getAnimations({ subtree: true })
            .map((a) => a.finished.catch(() => {})),
        ),
      );
    await page.locator(".party-chat-toggle").click();
    async function capture(name) {
      await settle();
      const geometry = await page.evaluate(() => {
        const panel = document.querySelector(".spacevoice-chat-inner"),
          log = document.querySelector(".spacevoice-chat-log"),
          input = document.querySelector(".spacevoice-chat-input"),
          send = document.querySelector(".spacevoice-chat-compose button");
        const rect = (e) => {
          const r = e.getBoundingClientRect();
          return {
            width: r.width,
            height: r.height,
            top: r.top,
            bottom: r.bottom,
          };
        };
        return {
          heading: panel.querySelector("h3").textContent,
          panel: rect(panel),
          log: rect(log),
          input: rect(input),
          send: rect(send),
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      report.states.push({ name, ...geometry });
      await page.screenshot({
        path: path.join(output, name + ".png"),
        fullPage: true,
      });
      if (phase === "after") {
        assert.equal(geometry.heading, "// chat · geral");
        assert.ok(geometry.panel.width >= 320 || name === "compact");
        assert.ok(geometry.log.height >= 100, JSON.stringify(geometry));
        assert.ok(geometry.input.height >= 80);
        assert.ok(geometry.send.bottom <= geometry.panel.bottom + 1);
        assert.equal(geometry.overflow, false);
      }
    }
    await capture("lobby");
    await page.getByRole("button", { name: "[ entrar na chamada ]", exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector(".spacevoice").dataset.joined === "true",
    );
    await page
      .locator(".spacevoice-chat-input")
      .fill("Mensagem de teste\nsegunda linha bem visível");
    await capture("call");
    if (phase === "after") {
      await page.evaluate(() => {
        const roomId = __partyUI.room.state.roomId;
        for (let i = 0; i < 35; i++)
          __partyUI.chat.receive({
            type: "chat-message",
            roomId,
            from: "luna",
            payload: {
              id: "visual-" + i,
              roomId,
              authorId: "luna",
              authorName: "Luna",
              text: "Mensagem " + i + " para verificar a rolagem da coluna.",
              createdAt: Date.now() + i,
            },
          });
      });
      await capture("messages");
      assert.equal(
        await page.locator(".spacevoice-chat-log").evaluate((e) => e.scrollHeight > e.clientHeight),
        true,
      );
      await page.getByRole("button", { name: "[ mídia > ]", exact: true }).click();
      await settle();
      assert.equal(
        await page.locator(".party-media-inner").evaluate((e) => e.getBoundingClientRect().width),
        340,
      );
      await page.locator(".party-chat-toggle").click();
      await settle();
    }
    await page.locator(".party-chat-toggle").click();
    await settle();
    await page.locator(".party-chat-toggle").click();
    await settle();
    assert.equal(
      await page.locator(".spacevoice-chat-input").inputValue(),
      "Mensagem de teste\nsegunda linha bem visível",
    );
    await page.setViewportSize({ width: 760, height: 844 });
    await capture("compact");
    if (phase === "after") {
      await page.setViewportSize({ width: 390, height: 844 });
      await capture("compact");
    }
    assert.deepEqual(report.errors, []);
    report.passed = true;
  } finally {
    await context?.close();
    await browser?.close();
    await new Promise((r) => server.close(r));
    fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  }
  console.log(JSON.stringify(report, null, 2));
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
