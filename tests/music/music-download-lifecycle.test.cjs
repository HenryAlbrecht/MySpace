const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { EventEmitter } = require("node:events");
const { createAuthorizedMediaDownloader } = require("../../server/media/authorized-media-download.cjs");
const { createServer } = require("../../server.cjs");

test("download parses real progress and cancellation waits for process close before cleanup", async () => {
  const controller = new AbortController();
  const progress = [];
  let directory;
  let started;
  const ready = new Promise((resolve) => { started = resolve; });
  const downloader = createAuthorizedMediaDownloader({
    env: { YTDLP_ALLOWED_HOSTS: "example.org" },
    execute(executable, args, options, callback) {
      assert.equal(options.signal, controller.signal);
      directory = path.dirname(args[args.indexOf("--output") + 1]);
      const child = new EventEmitter();
      child.stdout = new EventEmitter();
      child.exitCode = null;
      child.signalCode = null;
      options.signal.addEventListener("abort", () => {
        callback(Object.assign(Error("aborted"), { name: "AbortError" }));
        setImmediate(() => {
          child.exitCode = 1;
          child.emit("close");
        });
      }, { once: true });
      setImmediate(() => {
        child.stdout.emit("data", "myspace-progress: 25.");
        child.stdout.emit("data", "5%\n");
        started();
      });
      return child;
    },
  });
  const task = downloader.download("https://example.org/audio.mp3", "audio", {}, {
    signal: controller.signal, onProgress: (value) => progress.push(value),
  });
  const rejected = assert.rejects(task, (error) => error.status === 499);
  await ready;
  assert.ok(progress.some((value) => value.percent === 25.5));
  controller.abort();
  await rejected;
  await assert.rejects(fs.access(directory), { code: "ENOENT" });
});

test("HTTP progress is isolated by request ID and abort reaches downloader", async () => {
  let started;
  let stopped;
  const ready = new Promise((resolve) => { started = resolve; });
  const aborted = new Promise((resolve) => { stopped = resolve; });
  const server = createServer({
    mediaDownloader: {
      configured: true,
      isAllowed: () => true,
      download(url, kind, metadata, options) {
        options.onProgress({ phase: "download", percent: 42 });
        started();
        return new Promise((resolve, reject) => {
          options.signal.addEventListener("abort", () => {
            stopped();
            reject(Object.assign(Error("cancelled"), { status: 499 }));
          }, { once: true });
        });
      },
    },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  const id = "11111111-1111-4111-8111-111111111111";
  const controller = new AbortController();
  try {
    const request = fetch(base + "/api/xmb/media-download", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.org/audio", kind: "audio", downloadId: id }),
      signal: controller.signal,
    }).catch((error) => error);
    await ready;
    const progress = await fetch(base + "/api/xmb/media-download-progress?id=" + id);
    assert.deepEqual(await progress.json(), { phase: "download", percent: 42 });
    const other = await fetch(base + "/api/xmb/media-download-progress?id=22222222-2222-4222-8222-222222222222");
    assert.equal(other.status, 404);
    controller.abort();
    assert.equal((await request).name, "AbortError");
    await aborted;
    await new Promise((resolve) => setImmediate(resolve));
    const done = await fetch(base + "/api/xmb/media-download-progress?id=" + id);
    assert.equal(done.status, 404);
  } finally {
    controller.abort();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("cancelling metadata processing stops FFmpeg without cover retry and removes partial files", async () => {
  const controller = new AbortController();
  let started;
  const ready = new Promise((resolve) => { started = resolve; });
  let directory;
  let calls = 0;
  const downloader = createAuthorizedMediaDownloader({
    env: { YTDLP_ALLOWED_HOSTS: "example.org" },
    execute(executable, args, options, callback) {
      calls++;
      if (executable === "yt-dlp") {
        const output = args[args.indexOf("--output") + 1].replace("%(ext)s", "webm");
        directory = path.dirname(output);
        fs.writeFile(output, "fixture").then(() => callback(null), callback);
        return;
      }
      assert.equal(options.signal, controller.signal);
      const child = new EventEmitter();
      child.exitCode = null;
      child.signalCode = null;
      options.signal.addEventListener("abort", () => {
        callback(Object.assign(Error("aborted"), { name: "AbortError" }));
        setImmediate(() => { child.exitCode = 1; child.emit("close"); });
      }, { once: true });
      started();
      return child;
    },
  });
  const task = downloader.download("https://example.org/audio", "audio", {
    title: "Song", coverData: "data:image/jpeg;base64,/9j/",
  }, { signal: controller.signal });
  const rejected = assert.rejects(task, (error) => error.status === 499);
  await ready;
  controller.abort();
  await rejected;
  assert.equal(calls, 2);
  await assert.rejects(fs.access(directory), { code: "ENOENT" });
});
