const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const audioStats = require("./screen-audio-stats.cjs");
module.exports = async ({
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
}) => {
  const contexts = [],
    pages = [],
    diagnostics = {};
  report.screenAudio = diagnostics;
  try {
    for (let i = 0; i < 2; i++) {
      const context = await persistent.browser().newContext({
        permissions: ["microphone"],
        viewport: { width: 1280, height: 900 },
      });
      contexts.push(context);
      const page = await context.newPage();
      pages.push(page);
      page.on("pageerror", (e) => report.errors.push({ kind: "pageerror", text: e.message }));
      page.on("console", (m) => {
        if (m.type() === "error") report.errors.push({ kind: "console", text: m.text() });
      });
      await page.addInitScript(instrument);
      await page.goto("http://localhost:3000/?voiceWsUrl=ws%3A%2F%2Flocalhost%3A8787#spacevoice");
      await join(page);
    }
    const [a, b] = pages;
    await Promise.all(pages.map((p) => meshConnected(p, 1)));
    diagnostics.microphoneBefore = await a.evaluate(() => ({
      settings: window.__voiceTest.streams.at(-1).getAudioTracks()[0].getSettings(),
      parameters: window.__voiceTest.pcs
        .find((p) => p.connectionState === "connected")
        .getSenders()
        .find((s) => s.track?.kind === "audio")
        .getParameters(),
    }));
    await a.getByRole("button", { name: "[ compartilhar tela ]", exact: true }).click();
    await a.getByRole("button", { name: "[ parar tela ]", exact: true }).waitFor();
    await b.waitForFunction(
      () => document.querySelector(".spacevoice video")?.srcObject?.getAudioTracks().length === 1,
      null,
      { timeout: 20000 },
    );
    await Promise.all(
      pages.map((p) =>
        p.waitForFunction(() =>
          window.__voiceTest.pcs
            .filter((p) => p.connectionState !== "closed")
            .every((p) => p.connectionState === "connected" && p.signalingState === "stable"),
        ),
      ),
    );
    await a.waitForTimeout(1500);
    diagnostics.capture = await a.evaluate(() =>
      window.__voiceTest.displays
        .at(-1)
        .getAudioTracks()
        .map((t) => ({
          settings: t.getSettings(),
          constraints: t.getConstraints(),
          contentHint: t.contentHint,
        })),
    );
    diagnostics.first = await Promise.all(pages.map((p) => audioStats(p)));
    await a.waitForTimeout(6000);
    diagnostics.measured = await Promise.all(
      pages.map((p, i) => audioStats(p, diagnostics.first[i])),
    );
    assert.ok(
      diagnostics.measured[0].some(
        (s) => s.direction === "outbound" && s.bytes > 0 && s.bitsPerSecond > 0,
      ),
    );
    assert.ok(
      diagnostics.measured[1].some(
        (s) => s.direction === "inbound" && s.bytes > 0 && s.bitsPerSecond > 0,
      ),
    );
    if (!process.argv.includes("--baseline")) {
      const capture = diagnostics.capture[0],
        sender = diagnostics.measured[0].find((s) => s.direction === "outbound");
      assert.equal(capture.contentHint, "music");
      for (const option of ["echoCancellation", "noiseSuppression", "autoGainControl"])
        assert.equal(capture.settings[option], false);
      assert.equal(capture.settings.channelCount, 2);
      assert.equal(sender.codec.mimeType, "audio/opus");
      assert.equal(sender.parameters.encodings[0].maxBitrate, 192000);
    }
    check(
      "Screen audio: native display audio sent/received separately from microphone; codec, capture channels, real sender parameters and interval bitrate measured",
    );
    diagnostics.microphoneAfter = await a.evaluate(() => ({
      settings: window.__voiceTest.streams.at(-1).getAudioTracks()[0].getSettings(),
      parameters: window.__voiceTest.pcs
        .find((p) => p.connectionState === "connected")
        .getSenders()
        .find((s) => s.track?.id === window.__voiceTest.streams.at(-1).getAudioTracks()[0].id)
        .getParameters(),
    }));
    assert.deepEqual(diagnostics.microphoneBefore.settings, diagnostics.microphoneAfter.settings);
    assert.deepEqual(
      diagnostics.microphoneBefore.parameters.encodings,
      diagnostics.microphoneAfter.parameters.encodings,
    );
    const ids = await a.evaluate(() => ({
      mic: window.__voiceTest.streams.at(-1).getAudioTracks()[0].id,
      screen: window.__voiceTest.displays.at(-1).getAudioTracks()[0].id,
      senderIds: window.__voiceTest.pcs
        .find((p) => p.connectionState === "connected")
        .getSenders()
        .filter((s) => s.track?.kind === "audio")
        .map((s) => s.track.id),
      localMuted: document.querySelector(".spacevoice video").muted,
    }));
    assert.notEqual(ids.mic, ids.screen);
    assert.deepEqual(new Set(ids.senderIds), new Set([ids.mic, ids.screen]));
    assert.equal(ids.localMuted, true);
    check(
      "Screen audio: microphone settings/encoding untouched; two independent audio senders and always-muted local preview",
    );
    await a.getByRole("button", { name: "[ parar tela ]", exact: true }).click();
    await b.waitForFunction(() => !document.querySelector(".spacevoice video"));
    await Promise.all(pages.map((p) => meshConnected(p, 1)));
    check("Screen audio: share stop removes screen playback and preserves voice/connected peers");
    diagnostics.clients = await Promise.all(pages.map(snapshot));
    fs.writeFileSync(
      path.join(output, "audio-diagnostics.json"),
      JSON.stringify(diagnostics, null, 2),
    );
    for (const page of pages) await leave(page);
    await Promise.all(pages.map(clean));
  } catch (error) {
    diagnostics.failure = await Promise.all(pages.map((p) => audioStats(p)));
    throw error;
  } finally {
    for (const context of contexts) await context.close();
  }
};
