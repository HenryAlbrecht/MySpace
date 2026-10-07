/* Exactly one browser, two contexts; no dumps, traces, screenshots or credentials. */
const fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http"),
  { once } = require("node:events");
const { chromium } = require(
  path.join(
    require("node:os").homedir(),
    ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
  ),
);
const { createSignalingServer } = require("../server/signaling-server.cjs");
try {
  process.loadEnvFile(".env");
} catch {}
const report = {
  provider: "metered",
  apiResponded: false,
  contexts: 2,
  connected: false,
  relay: false,
  rtpGrew: false,
};
(async () => {
  if (process.env.PARTY_ICE_PROVIDER !== "metered" || !process.env.METERED_TURN_API_KEY)
    throw Error("Environment unavailable");
  const root = path.resolve("dist");
  let browser, web, service;
  const contexts = [];
  let phase = "setup";
  try {
    web = http.createServer((req, res) => {
      try {
        const file = path.resolve(
          root,
          "." +
            (new URL(req.url, "http://localhost").pathname === "/"
              ? "/index.html"
              : new URL(req.url, "http://localhost").pathname),
        );
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
          }[path.extname(file)] || "application/octet-stream",
        );
        res.end(fs.readFileSync(file));
      } catch {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise((r) => web.listen(0, "127.0.0.1", r));
    const origin = "http://127.0.0.1:" + web.address().port;
    service = createSignalingServer({
      port: 0,
      host: "127.0.0.1",
      env: { ...process.env, PARTY_ALLOWED_ORIGINS: origin },
      iceProviderOptions: {
        onStatus: (status) => {
          report.apiResponded = status.ok;
        },
      },
    });
    await once(service.wss, "listening");
    const wsUrl = "ws://127.0.0.1:" + service.wss.address().port;
    browser = await chromium.launch({
      executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      headless: true,
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
        "--autoplay-policy=no-user-gesture-required",
      ],
    });
    const pages = [];
    for (const name of ["Alice", "Luna"]) {
      const context = await browser.newContext({ permissions: ["microphone"] });
      contexts.push(context);
      await context.addInitScript(
        ({ name, wsUrl }) => {
          localStorage.setItem("myspace-profile-v1", JSON.stringify({ name, avatar: "" }));
          window.SPACEVOICE_CONFIG = { url: wsUrl };
          window.__pcs = [];
          const Native = RTCPeerConnection;
          window.RTCPeerConnection = class extends Native {
            constructor(...args) {
              super(...args);
              __pcs.push(this);
            }
          };
          navigator.mediaDevices.getDisplayMedia = () => {
            throw Error("Not allowed");
          };
        },
        { name, wsUrl },
      );
      await context.route("**/spacevoice.js", (route) =>
        route.fulfill({
          contentType: "text/javascript",
          body:
            fs.readFileSync(path.join(root, "spacevoice.js"), "utf8") +
            ";const __original=createSpaceVoice;createSpaceVoice=options=>{window.__partyUI=__original(options);return __partyUI;};",
        }),
      );
      const page = await context.newPage();
      pages.push(page);
      await page.goto(origin + "/?party=metered-relay-test&voiceIcePolicy=relay#spacevoice", {
        waitUntil: "domcontentloaded",
      });
      await page.waitForFunction(() => window.__partyUI?.room.state.participants.length >= 1);
    }
    phase = "call";
    for (const page of pages)
      await page.getByRole("button", { name: "[ entrar na chamada ]", exact: true }).click();
    phase = "connection";
    for (const page of pages)
      await page.waitForFunction(
        () => __pcs.length === 1 && __pcs[0].connectionState === "connected",
        null,
        { timeout: 45000 },
      );
    report.connected = true;
    const sample = (page) =>
      page.evaluate(async () => {
        const pc = __pcs[0],
          diagnostics = await PARTY_NETWORK.getPeerConnectionDiagnostics(pc),
          stats = await pc.getStats();
        let sent = 0,
          received = 0;
        stats.forEach((s) => {
          if (s.type === "outbound-rtp" && !s.isRemote) sent += s.bytesSent || 0;
          if (s.type === "inbound-rtp" && !s.isRemote) received += s.bytesReceived || 0;
        });
        const pair = diagnostics.candidatePair;
        return {
          connectionState: pc.connectionState,
          relay: pair?.localType === "relay" || pair?.remoteType === "relay",
          route: pair?.route || null,
          protocol: pair?.relayProtocol || pair?.protocol || null,
          sent,
          received,
          policy: pc.getConfiguration().iceTransportPolicy,
        };
      });
    phase = "route";
    const before = await Promise.all(pages.map(sample));
    report.relay = before.every((p) => p.relay && p.policy === "relay");
    report.routes = before.map((p) => ({
      route: p.route,
      protocol: p.protocol,
      candidateType: p.relay ? "relay" : "non-relay",
    }));
    if (!report.relay) throw Error("Relay not observed");
    phase = "rtp";
    await pages[0].waitForTimeout(2500);
    const after = await Promise.all(pages.map(sample));
    report.rtpGrew = after.every(
      (p, i) =>
        p.connectionState === "connected" &&
        p.sent > before[i].sent &&
        p.received > before[i].received,
    );
    report.validated = report.apiResponded && report.connected && report.relay && report.rtpGrew;
  } catch {
    report.validated = false;
    report.failurePhase = phase;
  } finally {
    for (const context of contexts) await context.close().catch(() => {});
    await browser?.close().catch(() => {});
    if (service) {
      for (const socket of service.wss.clients) socket.terminate();
      await new Promise((r) => service.wss.close(r));
    }
    if (web?.listening) await new Promise((r) => web.close(r));
    report.cleanedUp = true;
  }
  const output = path.resolve("artifacts/party-v10/metered-relay.json");
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  if (!report.validated) process.exitCode = 1;
})().catch(() => {
  console.log("Metered integration unavailable; no sensitive details recorded.");
  process.exitCode = 1;
});
