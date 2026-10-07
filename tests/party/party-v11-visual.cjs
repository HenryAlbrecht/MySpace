const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { chromium } = require(
  path.join(
    require("node:os").homedir(),
    ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
  ),
);
const { createServer } = require("../../server.cjs");
const { createSignalingServer } = require("../../server/signaling-server.cjs");

const output = path.resolve(__dirname, "..", "..", "artifacts", "party-avatar-quality");
fs.mkdirSync(output, { recursive: true });
const report = { checks: [], errors: [], screenshots: [], browserContexts: 2 };
const web = createServer();
const signaling = createSignalingServer({ port: 0, host: "127.0.0.1" });
let browser;
const contexts = [];
const pages = [];
const wait = async (predicate) => {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  assert.fail("Timed out waiting for signaling");
};
async function screenshot(page, name) {
  await page.evaluate(() =>
    Promise.all(
      document
        .querySelector(".spacevoice")
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished.catch(() => {})),
    ),
  );
  const file = path.join(output, name);
  await page.screenshot({ path: file, fullPage: true });
  report.screenshots.push(file);
}
async function client(name, url, avatar) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 950 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  contexts.push(context);
  await context.addInitScript(
    ({ name, avatar, wsUrl }) => {
      if (!localStorage.getItem("myspace-profile-v1")) {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 600;
        const ctx = canvas.getContext("2d");
        const gradient = ctx.createLinearGradient(0, 0, 600, 600);
        gradient.addColorStop(0, "#394d80");
        gradient.addColorStop(1, "#e9ae7a");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 600, 600);
        ctx.fillStyle = "#fff1d6";
        ctx.beginPath();
        ctx.arc(300, 260, 125, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#24344f";
        ctx.lineWidth = 5;
        for (let n = 0; n < 30; n++) {
          ctx.beginPath();
          ctx.moveTo(100, 160 + n * 9);
          ctx.lineTo(500, 160 + n * 9);
          ctx.stroke();
        }
        localStorage.setItem(
          "myspace-profile-v1",
          JSON.stringify({
            name,
            avatar: avatar || canvas.toDataURL("image/jpeg", 0.85),
          }),
        );
      }
      window.SPACEVOICE_CONFIG = { url: wsUrl, iceServers: [] };
      window.__micRequests = 0;
      const native = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = (options) => {
        window.__micRequests++;
        return native(options);
      };
    },
    { name, avatar, wsUrl: `ws://127.0.0.1:${signaling.wss.address().port}` },
  );
  await context.route("**/spacevoice.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body:
        fs.readFileSync(path.join(__dirname, "..", "..", "dist", "spacevoice.js"), "utf8") +
        ";const __partyCreate=createSpaceVoice;createSpaceVoice=options=>{window.__partyUI=__partyCreate(options);return __partyUI;};",
    }),
  );
  const page = await context.newPage();
  pages.push(page);
  page.on("pageerror", (error) => report.errors.push(error.message));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__partyUI?.room.state.participants.length >= 1);
  return page;
}

(async () => {
  try {
    await Promise.all([
      new Promise((resolve) => web.listen(0, "127.0.0.1", resolve)),
      once(signaling.wss, "listening"),
    ]);
    const edge = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
    browser = await chromium.launch({
      ...(fs.existsSync(edge) ? { executablePath: edge } : {}),
      headless: true,
    });
    const base = new URL(`http://127.0.0.1:${web.address().port}/#spacevoice`);
    base.searchParams.set("voiceWsUrl", `ws://127.0.0.1:${signaling.wss.address().port}`);
    base.searchParams.set("voiceTransport", "websocket");
    base.searchParams.set("voiceIcePolicy", "all");
    base.searchParams.set("keep", "yes");
    const a = await client("Alice", base.href);
    const roomId = new URL(a.url()).searchParams.get("party");
    assert.match(roomId, /^[0-9a-f-]{36}$/);
    assert.equal(new URL(a.url()).searchParams.get("voiceIcePolicy"), "all");
    assert.equal(await a.evaluate(() => __micRequests), 0);
    await screenshot(a, "01-room-auto.png");
    report.checks.push(
      "missing party generated UUID in URL; technical query parameters preserved; no microphone request",
    );
    await a.getByRole("button", { name: "[ copiar convite ]", exact: true }).click();
    const invite = await a.evaluate(async () =>
      navigator.clipboard
        .readText()
        .catch(() => document.querySelector(".party-invite-fallback").value),
    );
    assert.equal(new URL(invite).searchParams.get("party"), roomId);
    const b = await client("Luna", invite);
    for (const page of [a, b])
      await page.waitForFunction(() => __partyUI.room.state.participants.length === 2);
    assert.equal(signaling.rooms.get(roomId).size, 2);
    await screenshot(a, "02-invite-second-window.png");
    const avatars = await b.evaluate(() => {
      const local = document.querySelector(
        ".spacevoice-participants li:not([data-peer-id]) .spacevoice-avatar img",
      );
      const remote = document.querySelector(
        ".spacevoice-participants li[data-peer-id] .spacevoice-avatar img",
      );
      return {
        local: { width: local?.naturalWidth, height: local?.naturalHeight },
        remote: {
          width: remote?.naturalWidth,
          height: remote?.naturalHeight,
          payloadChars: remote?.src.length,
          format: remote?.src.slice(0, 24),
        },
        style: remote && {
          fit: getComputedStyle(remote).objectFit,
          rendering: getComputedStyle(remote).imageRendering,
        },
      };
    });
    assert.ok(avatars.local.width >= 256, JSON.stringify(avatars));
    assert.ok(avatars.remote.width >= 384 && avatars.remote.width <= 512, JSON.stringify(avatars));
    assert.ok(avatars.remote.payloadChars <= 60000, JSON.stringify(avatars));
    assert.match(avatars.remote.format, /^data:image\/(png|webp);/);
    assert.deepEqual(avatars.style, { fit: "cover", rendering: "auto" });
    const smallSource = await b.evaluate(async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 80;
      canvas.getContext("2d").fillRect(0, 0, 64, 80);
      const thumbnail = await preparePartyAvatar(
        canvas.toDataURL("image/png"),
        PARTY_ROOM.MAX_AVATAR,
      );
      const image = new Image();
      image.src = thumbnail;
      await image.decode();
      return image.naturalWidth;
    });
    assert.equal(smallSource, 64);
    const crop = await b.evaluate(async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 600;
      canvas.height = 400;
      const context = canvas.getContext("2d");
      context.fillStyle = "#ff0000";
      context.fillRect(0, 0, 600, 400);
      context.fillStyle = "#00ff00";
      context.fillRect(100, 0, 400, 400);
      const result = await preparePartyAvatar(canvas.toDataURL("image/png"), PARTY_ROOM.MAX_AVATAR);
      const image = new Image();
      image.src = result;
      await image.decode();
      const sample = document.createElement("canvas");
      sample.width = sample.height = image.naturalWidth;
      const sampleContext = sample.getContext("2d");
      sampleContext.drawImage(image, 0, 0);
      return {
        width: image.naturalWidth,
        left: [...sampleContext.getImageData(0, 200, 1, 1).data],
        right: [...sampleContext.getImageData(image.naturalWidth - 1, 200, 1, 1).data],
      };
    });
    assert.equal(crop.width, 400);
    assert.ok(crop.left[1] > crop.left[0] && crop.right[1] > crop.right[0], JSON.stringify(crop));
    await screenshot(b, "03-avatar-local-remote.png");
    report.avatar = avatars;
    report.checks.push(
      "remote avatar is 384–512 px PNG/WebP with bounded payload and unchanged CSS size; crop is centered and small sources are not upscaled",
    );
    await b.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 600;
      const context = canvas.getContext("2d");
      context.fillStyle = "#efe9dd";
      context.fillRect(0, 0, 600, 600);
      context.fillStyle = "#28385d";
      context.fillRect(80, 80, 440, 440);
      context.fillStyle = "#f4ccae";
      context.beginPath();
      context.arc(300, 300, 150, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = "#161b2d";
      context.lineWidth = 10;
      for (const x of [245, 355]) {
        context.beginPath();
        context.moveTo(x - 20, 270);
        context.lineTo(x + 20, 270);
        context.stroke();
      }
      const profile = JSON.parse(localStorage.getItem("myspace-profile-v1"));
      profile.avatar = canvas.toDataURL("image/png");
      localStorage.setItem("myspace-profile-v1", JSON.stringify(profile));
    });
    await b.reload({ waitUntil: "domcontentloaded" });
    await a.waitForFunction(() =>
      document
        .querySelector(".spacevoice-participants li[data-peer-id] .spacevoice-avatar img")
        ?.src.startsWith("data:image/png;"),
    );
    const flatAvatar = await a
      .locator(".spacevoice-participants li[data-peer-id] .spacevoice-avatar img")
      .evaluate((image) => ({
        width: image.naturalWidth,
        payloadChars: image.src.length,
      }));
    assert.equal(flatAvatar.width, 512);
    assert.ok(flatAvatar.payloadChars <= 60000);
    await screenshot(a, "04-line-art-png.png");
    report.lineArt = flatAvatar;
    report.checks.push("flat-color line art stays PNG at 512 px within the presence limit");
    await b.evaluate(() => {
      const profile = JSON.parse(localStorage.getItem("myspace-profile-v1"));
      profile.avatar = "https://example.invalid/avatar.png";
      localStorage.setItem("myspace-profile-v1", JSON.stringify(profile));
    });
    await b.context().route("**/avatar.png", (route) => route.abort());
    await b.reload({ waitUntil: "domcontentloaded" });
    await a.waitForFunction(() => {
      const row = [...document.querySelectorAll(".spacevoice-participants li[data-peer-id]")].find(
        (node) => node.textContent.includes("Luna"),
      );
      return row?.querySelector(".spacevoice-avatar img")?.hidden === true;
    });
    assert.equal(
      await a
        .locator(".spacevoice-participants li[data-peer-id] .spacevoice-avatar span")
        .isVisible(),
      true,
    );
    await screenshot(a, "05-invalid-avatar-fallback.png");
    report.checks.push(
      "profile change replaces prior avatar and invalid remote image falls back to initials",
    );
    await b.getByRole("button", { name: "[ sair da sala ]", exact: true }).click();
    await wait(() => signaling.rooms.get(roomId)?.size === 1);
    assert.equal(await b.evaluate(() => __partyUI.room.state.roomId), null);
    await b.getByRole("button", { name: "[ entrar na sala ]", exact: true }).click();
    await b.waitForFunction((id) => __partyUI.room.state.roomId === id, roomId);
    await b.getByRole("button", { name: "[ nova party ]", exact: true }).click();
    await b.waitForFunction((id) => __partyUI.room.state.roomId !== id, roomId);
    const next = await b.evaluate(() => __partyUI.room.state.roomId);
    assert.match(next, /^[0-9a-f-]{36}$/);
    assert.equal(new URL(b.url()).searchParams.get("keep"), "yes");
    assert.equal(await b.evaluate(() => __micRequests), 0);
    assert.deepEqual(report.errors, []);
    report.checks.push(
      "leave removes presence; reenter uses invite room; new party changes UUID without microphone",
    );
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.failure = error.stack;
    throw error;
  } finally {
    for (const page of pages) await page.evaluate(() => window.__partyUI?.hide()).catch(() => {});
    for (const context of contexts) await context.close();
    await browser?.close();
    for (const socket of signaling.wss.clients) socket.terminate();
    await new Promise((resolve) => signaling.wss.close(resolve));
    await new Promise((resolve) => web.close(resolve));
    fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  }
  console.log(JSON.stringify(report, null, 2));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
