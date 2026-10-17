const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync("dist/media/media-download.js", "utf8");

function fixture(DesktopMusicDownloads) {
  const nodes = [];
  class Node {
    constructor(tag) {
      this.tag = tag;
      this.children = [];
      this.attributes = {};
      this.textContent = "";
      nodes.push(this);
    }
    append(...children) { this.children.push(...children); }
    setAttribute(key, value) { this.attributes[key] = value; }
    removeAttribute(key) { delete this.attributes[key]; }
    addEventListener() {}
    showModal() { this.open = true; }
    close() { this.open = false; }
    remove() { this.removed = true; }
  }
  const document = {
    body: new Node("body"),
    createElement: (tag) => new Node(tag),
  };
  const window = { DesktopMusicDownloads };
  vm.runInNewContext(source, { window, document, AbortController, DOMException, Blob, URL, setTimeout, clearTimeout, crypto });
  return { api: window.MediaDownload, nodes };
}

test("native download reuses progress UI and sends only the explicit user request", async () => {
  const calls = [];
  const { api, nodes } = fixture({
    async start(request) {
      calls.push(["start", request]);
      await new Promise((resolve) => setTimeout(resolve, 450));
      return { folderId: "grant-1", fileName: "track.mp3", bytes: 1234 };
    },
    async progress(id) {
      calls.push(["progress", id]);
      return { phase: "download", percent: 25 };
    },
    async cancel(id) { calls.push(["cancel", id]); },
  });
  const metadata = { title: "Track", artist: "Artist", coverData: "data:image/jpeg;base64,..." };
  const result = await api.downloadToDesktop("https://audio.example.org/track", 120, metadata, "ytmusic:video:abcdefghijk");
  assert.equal(result.folderId, "grant-1");
  assert.equal(calls[0][0], "start");
  assert.equal(calls[0][1].sourceUrl, "https://audio.example.org/track");
  assert.equal(calls[0][1].cooldownSeconds, 120);
  assert.equal(calls[0][1].sourceIdentity, "ytmusic:video:abcdefghijk");
  assert.equal(calls[0][1].metadata, metadata);
  assert.ok(calls.some(([kind]) => kind === "progress"));
  assert.equal(nodes.find((node) => node.tag === "dialog").removed, true);
});

test("aborting a native download kills that job and reports AbortError", async () => {
  let rejectStart;
  const calls = [];
  const { api, nodes } = fixture({
    start: () => new Promise((_, reject) => { rejectStart = reject; }),
    progress: async () => ({ phase: "download" }),
    cancel: async (id) => {
      calls.push(id);
      rejectStart(Error("cancelled"));
    },
  });
  const controller = new AbortController();
  const pending = api.downloadToDesktop("https://audio.example.org/track", 60, {}, "item", { signal: controller.signal });
  await Promise.resolve();
  const cancel = nodes.find((node) => node.textContent === "cancelar download");
  cancel.onclick();
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(calls.length, 1);
  assert.equal(nodes.find((node) => node.tag === "dialog").removed, true);
});

test("web download remains independent of the Tauri bridge", async () => {
  const { api } = fixture(undefined);
  await assert.rejects(
    api.downloadToDesktop("https://audio.example.org/track"),
    /indisponíveis neste Desktop/,
  );
});
