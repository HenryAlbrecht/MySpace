// Native display capture + real RTC. Fallback injection is explicitly test-only.
const assert = require("node:assert/strict"),
  path = require("node:path");
module.exports = async function ({
  persistent,
  report,
  instrument,
  snapshot,
  meshConnected,
  join,
  leave,
  clean,
  check,
  output,
}) {
  const contexts = [],
    pages = [],
    screenReport = {};
  report.screen = screenReport;
  const save = async (label, clients) =>
    (screenReport[label] = await Promise.all(clients.map(snapshot)));
  const stable = (page) =>
    page.waitForFunction(() =>
      window.__voiceTest.pcs
        .filter((p) => p.connectionState !== "closed")
        .every((p) => p.signalingState === "stable" && p.connectionState === "connected"),
    );
  async function videos(page, count) {
    await page.waitForFunction(
      (count) => document.querySelectorAll(".spacevoice video").length === count,
      count,
      { timeout: 20000 },
    );
  }
  async function videoRtp(page, count) {
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      const received = await page.evaluate(async () => {
        let received = 0;
        for (const pc of window.__voiceTest.pcs.filter((p) => p.connectionState !== "closed")) {
          const active = new Set(
            pc
              .getTransceivers()
              .filter((t) => ["recvonly", "sendrecv"].includes(t.currentDirection))
              .map((t) => t.receiver.track.id),
          );
          for (const s of (await pc.getStats()).values())
            if (
              s.type === "inbound-rtp" &&
              s.kind === "video" &&
              s.bytesReceived > 0 &&
              s.framesDecoded > 0 &&
              active.has(s.trackIdentifier)
            )
              received++;
        }
        return received;
      });
      if (received >= count) return;
      await page.waitForTimeout(100);
    }
    assert.fail("Missing screen video RTP");
  }
  async function start(page) {
    await page.getByRole("button", { name: "[ compartilhar tela ]", exact: true }).click();
    await page
      .getByRole("button", { name: "[ parar tela ]", exact: true })
      .waitFor({ timeout: 12000 });
  }
  async function stop(page) {
    await page.getByRole("button", { name: "[ parar tela ]", exact: true }).click();
  }
  async function inject(page) {
    await page.evaluate(() => {
      navigator.mediaDevices.getDisplayMedia = async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 1280;
        canvas.height = 720;
        const ctx = canvas.getContext("2d");
        let frame = 0;
        const draw = () => {
          ctx.fillStyle = "#132b32";
          ctx.fillRect(0, 0, 1280, 720);
          ctx.fillStyle = "#8bd8cc";
          ctx.font = "36px monospace";
          ctx.fillText("SPACEVOICE / test-only synthetic screen " + frame++, 40, 80);
        };
        draw();
        const stream = canvas.captureStream(30),
          timer = setInterval(draw, 100);
        const audio = new AudioContext(),
          oscillator = audio.createOscillator(),
          destination = audio.createMediaStreamDestination();
        oscillator.connect(destination);
        oscillator.start();
        stream.addTrack(destination.stream.getAudioTracks()[0]);
        window.__voiceTest.displays.push(stream);
        let stopped = false;
        const stop = stream.getVideoTracks()[0].stop.bind(stream.getVideoTracks()[0]);
        stream.getVideoTracks()[0].stop = () => {
          if (stopped) return;
          stopped = true;
          clearInterval(timer);
          oscillator.stop();
          void audio.close();
          stop();
        };
        return stream;
      };
    });
  }
  try {
    for (let i = 0; i < 4; i++) {
      const context = await persistent.browser().newContext({
        permissions: ["microphone"],
        viewport: { width: 1280, height: 900 },
      });
      contexts.push(context);
      const page = await context.newPage();
      pages.push(page);
      page.on("console", (m) => {
        if (m.type() === "error")
          report.errors.push({
            client: "screen-" + i,
            kind: "console",
            text: m.text(),
          });
      });
      page.on("pageerror", (e) =>
        report.errors.push({
          client: "screen-" + i,
          kind: "pageerror",
          text: e.message,
        }),
      );
      await page.addInitScript(instrument);
      await page.goto("http://localhost:3000/?voiceWsUrl=ws%3A%2F%2Flocalhost%3A8787#spacevoice");
      await page.getByRole("button", { name: "[ entrar na chamada ]", exact: true }).waitFor();
    }
    const [a, b, c, d] = pages;
    if (process.argv.includes("--synthetic-screen")) {
      for (const page of pages) await inject(page);
    }
    await join(a);
    await join(b);
    await Promise.all([a, b].map((p) => meshConnected(p, 1)));
    await a.screenshot({ path: path.join(output, "screen-empty.png") });
    try {
      await start(a);
      screenReport.captureMode = "native-getDisplayMedia-fake-device";
    } catch (error) {
      screenReport.nativeCaptureLimitation = String(error);
      await leave(a);
      await clean(a);
      await inject(a);
      await inject(b);
      await join(a);
      await Promise.all([a, b].map((p) => meshConnected(p, 1)));
      await start(a);
      screenReport.captureMode = "test-only-canvas-and-audio-injection";
    }
    await videos(b, 1);
    await videoRtp(b, 1);
    await Promise.all([a, b].map(stable));
    await save("firstShare", [a, b]);
    const sourceVideo = await a.evaluate(
      () => window.__voiceTest.displays.at(-1).getVideoTracks()[0].id,
    );
    assert.equal(
      await b.evaluate(
        () => document.querySelector(".spacevoice video").srcObject.getVideoTracks()[0].id,
      ),
      sourceVideo,
    );
    assert.equal(await a.evaluate(() => document.querySelector(".spacevoice video").muted), true);
    check(
      "Screen: explicit native/fallback capture distributes video to B with video RTP; correct source track, muted local preview and stable RTC",
    );
    await join(c);
    await Promise.all([a, b, c].map((p) => meshConnected(p, 2)));
    await videos(c, 1);
    await videoRtp(c, 1);
    await Promise.all([a, b, c].map(stable));
    assert.equal((await snapshot(a)).displays.length, 1);
    assert.equal(
      await c.evaluate(
        () => document.querySelector(".spacevoice video").srcObject.getVideoTracks()[0].id,
      ),
      sourceVideo,
    );
    await save("lateC", [a, b, c]);
    check("Screen: late C receives A screen automatically without another capture");
    await start(b);
    await Promise.all([a, b, c].map((p) => videos(p, 2)));
    await videoRtp(a, 1);
    await videoRtp(c, 2);
    await Promise.all([a, b, c].map(stable));
    await save("twoSharers", [a, b, c]);
    await c.screenshot({ path: path.join(output, "screen-two-sharers.png") });
    assert.equal(
      await c.evaluate(() => document.querySelectorAll(".spacevoice-screen-tabs button").length),
      2,
    );
    await c.locator(".spacevoice-screen-tabs button").nth(1).click();
    assert.equal(
      await c.evaluate(() => document.querySelectorAll(".spacevoice video:not([hidden])").length),
      1,
    );
    await c.getByRole("button", { name: "[ deafen ]", exact: true }).click();
    assert.equal(
      await c.evaluate(() =>
        [...document.querySelectorAll(".spacevoice audio,.spacevoice video")].every((e) => e.muted),
      ),
      true,
    );
    await c.getByRole("button", { name: "[ deafen · ligado (local) ]", exact: true }).click();
    assert.equal(
      await c.evaluate(() => document.querySelector(".spacevoice video:not([hidden])").muted),
      false,
    );
    check(
      "Screen: A/B independent simultaneous shares; C selector focuses one screen; deafen includes system-share playback",
    );
    await join(d);
    await Promise.all(pages.map((p) => meshConnected(p, 3)));
    await videos(d, 2);
    await videoRtp(d, 2);
    await Promise.all(pages.map(stable));
    await save("lateD", pages);
    check("Screen: fourth context joins and receives both active shares without recapture");
    await stop(a);
    await Promise.all(pages.map((p) => videos(p, 1)));
    await Promise.all(pages.map(stable));
    await Promise.all(pages.map((p) => meshConnected(p, 3)));
    assert.ok((await snapshot(a)).displays[0].tracks.every((t) => t.readyState === "ended"));
    assert.equal((await snapshot(b)).displays[0].tracks[0].readyState, "live");
    await save("afterAStop", pages);
    check(
      "Screen: stopping A removes only A share and its senders; B screen and all voice peers remain connected",
    );
    // Drop sharer B's actual WS while capture is live; no new picker/capture.
    await b.evaluate(() =>
      window.__voiceTest.sockets.find((s) => s.readyState === 1).close(4001, "screen reconnect"),
    );
    await b.waitForFunction(() =>
      window.__voiceTest.pcs.every((p) => p.connectionState === "closed"),
    );
    await Promise.all(pages.map((p) => meshConnected(p, 3)));
    await Promise.all(pages.map((p) => videos(p, 1)));
    await Promise.all([a, c, d].map((p) => videoRtp(p, 1)));
    await Promise.all(pages.map(stable));
    assert.equal((await snapshot(b)).displays.length, 1);
    await save("screenReconnected", pages);
    check("Screen: sharer reconnect keeps the same live capture and resends it to all three peers");
    await stop(b);
    await Promise.all(pages.map((p) => videos(p, 0)));
    await Promise.all(pages.map(stable));
    // Hold real signaling offers only in the test, producing actual have-local-offer glare.
    for (const page of [a, b])
      await page.evaluate(() => {
        window.__voiceTest.holdOffers = true;
        window.__voiceTest.heldOffers = [];
      });
    await Promise.all([start(a), start(b)]);
    for (const page of [a, b])
      await page.waitForFunction(() => window.__voiceTest.heldOffers.length === 3);
    for (const page of [a, b])
      await page.evaluate(() => {
        window.__voiceTest.holdOffers = false;
        for (const { socket, data } of window.__voiceTest.heldOffers) socket.send(data);
      });
    await Promise.all(pages.map((p) => videos(p, 2)));
    await Promise.all(pages.map(stable));
    await videoRtp(c, 2);
    await videoRtp(d, 2);
    await save("glareRecovered", pages);
    check(
      "Screen: simultaneous A/B starts with forced real offer collision recover to stable, both screens reach C/D",
    );
    await a.waitForFunction(
      () => document.querySelector(".spacevoice video:not([hidden])")?.readyState >= 2,
    );
    await c.waitForFunction(
      () => document.querySelector(".spacevoice video:not([hidden])")?.readyState >= 2,
    );
    await a.screenshot({
      path: path.join(output, "screen-local-preview.png"),
      fullPage: true,
    });
    await c.screenshot({
      path: path.join(output, "screen-remote-focused.png"),
      fullPage: true,
    });
    // Browser stop is represented by the track ended event after ending the real capture.
    await a.evaluate(() => {
      const video = window.__voiceTest.displays.at(-1).getVideoTracks()[0];
      video.stop();
      video.dispatchEvent(new Event("ended"));
    });
    await Promise.all(pages.map((p) => videos(p, 1)));
    await Promise.all(pages.map(stable));
    check("Screen: native track ended path stops only local A share and clears remote previews");
    for (let i = 0; i < 2; i++) {
      await start(a);
      await videos(c, 2);
      await stable(a);
      await stop(a);
      await videos(c, 1);
      await Promise.all(pages.map(stable));
    }
    check(
      "Screen: repeated stop/start leaves signaling stable and no duplicate active screen senders",
    );
    const overflow = await c.evaluate(
      () =>
        document.querySelector(".spacevoice-controls").scrollWidth >
        document.querySelector(".spacevoice-controls").clientWidth,
    );
    assert.equal(overflow, false);
    await c.setViewportSize({ width: 390, height: 844 });
    await c.screenshot({ path: path.join(output, "screen-mobile.png") });
    assert.equal(await c.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await c.setViewportSize({ width: 1280, height: 900 });
    await c
      .getByRole("button", { name: /aparência/i })
      .first()
      .click();
    await c.getByRole("tab", { name: "Cores", exact: true }).click();
    await c.getByText("Usar minhas próprias cores", { exact: true }).click();
    await c.getByLabel("Destaques", { exact: true }).fill("#70b6ab");
    await c.getByRole("tab", { name: "Fundo", exact: true }).click();
    await c.locator('input[name="backgroundFile"]').setInputFiles({
      name: "screen-wallpaper-test.gif",
      mimeType: "image/gif",
      buffer: Buffer.from("R0lGODlhAQABAIAAAAsVGP///yH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==", "base64"),
    });
    await c.locator('select[name="backgroundMode"]').selectOption("tile");
    await c.getByRole("button", { name: "salvar", exact: true }).click();
    await c.waitForFunction(() =>
      getComputedStyle(document.body).backgroundImage.includes("data:image/"),
    );
    await c.waitForFunction(
      () => document.querySelector(".spacevoice video:not([hidden])")?.readyState >= 2,
    );
    await stable(c);
    await c.screenshot({
      path: path.join(output, "screen-appearance.png"),
      fullPage: true,
    });
    check(
      "Screen: wallpaper/custom appearance applies while screen playback and existing RTC remain live",
    );
    await save("beforeExit", pages);
    for (const page of pages) await leave(page);
    await Promise.all(pages.map(clean));
    for (const page of pages) {
      const s = await snapshot(page);
      assert.equal(s.videos.length, 0);
      assert.ok(s.displays.every((s) => s.tracks.every((t) => t.readyState === "ended")));
    }
    check(
      "Screen: total leave stops every display/microphone track and removes all videos; controls fit desktop/mobile",
    );
  } catch (error) {
    screenReport.failureSnapshots = await Promise.all(pages.map(snapshot));
    screenReport.heldOffers = await Promise.all(
      pages.map((p) =>
        p.evaluate(() => ({
          count: window.__voiceTest.heldOffers?.length,
          offers: window.__voiceTest.heldOffers?.map((e) => JSON.parse(e.data)),
          state: document.querySelector(".spacevoice-screen-status")?.textContent,
        })),
      ),
    );
    throw error;
  } finally {
    for (const context of contexts) await context.close();
  }
};
