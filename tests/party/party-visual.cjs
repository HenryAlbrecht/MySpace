// Visual fixtures use real four-client RTC and test-only canvas screen capture.
const { chromium } = require(
  require("node:path").join(
    require("node:os").homedir(),
    ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
  ),
);
const fs = require("node:fs"),
  assert = require("node:assert/strict");
const output = "artifacts/party-visual";
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    headless: true,
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      "--autoplay-policy=no-user-gesture-required",
    ],
  });
  const errors = [],
    contexts = [];
  try {
    const pages = [];
    for (let i = 0; i < 4; i++) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        permissions: ["microphone"],
      });
      contexts.push(context);
      const page = await context.newPage();
      pages.push(page);
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      await page.addInitScript(() => {
        window.__partyPeers = [];
        const PC = window.RTCPeerConnection;
        window.RTCPeerConnection = class extends PC {
          constructor(...a) {
            super(...a);
            window.__partyPeers.push(this);
          }
        };
        navigator.mediaDevices.getDisplayMedia = async () => {
          const canvas = document.createElement("canvas");
          canvas.width = 1280;
          canvas.height = 720;
          const ctx = canvas.getContext("2d");
          let n = 0;
          const draw = () => {
            ctx.fillStyle = "#181c1e";
            ctx.fillRect(0, 0, 1280, 720);
            ctx.fillStyle = "#abc2bd";
            ctx.font = "24px monospace";
            ctx.fillText("PARTY // captura sintética de teste", 48, 64);
            ctx.fillText("voz + tela + chat · " + n++, 48, 110);
          };
          draw();
          const stream = canvas.captureStream(30);
          const timer = setInterval(draw, 100);
          stream.getVideoTracks()[0].addEventListener("ended", () => clearInterval(timer));
          return stream;
        };
      });
      await page.goto("http://localhost:3000/?voiceWsUrl=ws%3A%2F%2Flocalhost%3A8787#spacevoice");
    }
    const [a, b, c, d] = pages;
    const shot = async (name) => {
      await a.locator(".spacevoice").scrollIntoViewIfNeeded();
      await a.screenshot({
        path: output + "/" + name + ".png",
        fullPage: true,
      });
    };
    await shot("01-fora-da-chamada");
    const join = (p) =>
      p.getByRole("button", { name: "[ entrar na chamada ]", exact: true }).click();
    await join(a);
    await a.waitForFunction(() => document.querySelector(".spacevoice").dataset.joined === "true");
    await shot("02-uma-pessoa");
    for (const p of [b, c, d]) await join(p);
    await Promise.all(
      pages.map((p) =>
        p.waitForFunction(
          () => window.__partyPeers.filter((pc) => pc.connectionState === "connected").length === 3,
        ),
      ),
    );
    await a.waitForFunction(
      () => document.querySelectorAll(".spacevoice-participants li").length === 4,
    );
    await shot("03-voz-quatro-pessoas");
    await b.getByRole("button", { name: "[ compartilhar tela ]", exact: true }).click();
    await a.waitForFunction(
      () =>
        document.querySelector(".spacevoice").dataset.mode === "screen" &&
        document.querySelector("video")?.readyState >= 2,
    );
    await shot("04-tela-quatro-pessoas");
    await a.evaluate(() => {
      window.__partyVideo = document.querySelector(".spacevoice video");
      window.__partyStream = window.__partyVideo.srcObject;
    });
    const chat = a.locator(".spacevoice header button");
    await chat.click();
    await chat.click();
    await a.locator(".spacevoice-chat-input").fill("teste de chat sem recriar mídia");
    await a.locator(".spacevoice-chat-input").press("Enter");
    assert.equal(
      await a.evaluate(
        () =>
          window.__partyVideo === document.querySelector(".spacevoice video") &&
          window.__partyStream === window.__partyVideo.srcObject,
      ),
      true,
    );
    await c.getByRole("button", { name: "[ compartilhar tela ]", exact: true }).click();
    await a.waitForFunction(() => document.querySelectorAll(".spacevoice video").length === 2);
    await shot("05-multiplas-telas");
    await a.evaluate(() => {
      document.body.style.backgroundImage = 'url("profile-art.png")';
      document.body.style.backgroundSize = "cover";
    });
    await shot("06-wallpaper");
    await a.evaluate(() => {
      document.body.style.backgroundImage = "none";
    });
    await shot("07-sem-wallpaper");
    await a.setViewportSize({ width: 390, height: 844 });
    await shot("08-mobile");
    assert.equal(await a.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await a.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(
      await a
        .locator(".spacevoice-avatar")
        .first()
        .evaluate((e) => getComputedStyle(e).transitionDuration),
      "0s",
    );
    await b.getByRole("button", { name: "[ parar tela ]", exact: true }).click();
    await c.getByRole("button", { name: "[ parar tela ]", exact: true }).click();
    await a.waitForFunction(() => document.querySelector(".spacevoice").dataset.mode === "voice");
    assert.equal(errors.length, 0, JSON.stringify(errors));
    fs.writeFileSync(
      output + "/report.json",
      JSON.stringify(
        {
          passed: true,
          errors,
          checks: [
            "4 real RTC clients",
            "voice/screen/voice reflow",
            "persistent video and srcObject during chat toggle/message",
            "two sharers",
            "mobile no overflow",
            "reduced motion",
          ],
          screenshots: fs.readdirSync(output).filter((n) => n.endsWith(".png")),
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
