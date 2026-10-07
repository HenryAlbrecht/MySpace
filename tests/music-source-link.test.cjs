const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
const MusicModel = require("../dist/music-model.js");
const source = {
  type: "youtube",
  videoId: "10z6-vQm23w",
  url: "https://www.youtube.com/watch?v=10z6-vQm23w",
};
function setup() {
  class Node {
    constructor(tag) {
      this.tagName = tag;
      this.children = [];
      this.attributes = {};
      this.files = [];
      this.value = "";
    }
    append(...children) {
      for (const child of children) {
        child.parent = this;
        this.children.push(child);
      }
    }
    replaceChildren(...children) {
      this.children = [];
      this.append(...children);
    }
    setAttribute(key, value) {
      this.attributes[key] = value;
    }
    get lastChild() {
      return this.children.at(-1);
    }
    showModal() {
      this.open = true;
    }
    close() {
      this.open = false;
      this.onclose?.();
    }
    remove() {
      if (this.parent) this.parent.children = this.parent.children.filter((n) => n !== this);
    }
  }
  const body = new Node("body"),
    document = {
      body,
      createElement: (tag) => new Node(tag),
      querySelector: () => body.children.find((n) => n.className === "music-link-dialog"),
    };
  let rows = [
      {
        id: "song",
        kind: "music",
        catalogId: "itunes:123",
        title: "Song",
        artist: "Artist",
        albumTitle: "Album",
        trackDuration: 210,
      },
    ],
    requests = 0,
    respond;
  const fetch = async (url) => {
    requests++;
    return new Promise(
      (resolve) => (respond = (result) => resolve({ ok: true, json: async () => result })),
    );
  };
  const window = {
    document,
    MusicModel,
    toast: () => {},
    CollectionActions: {
      getItems: () => rows,
      updateItem: (id, patch) => {
        const index = rows.findIndex((r) => r.id === id);
        if (index < 0) throw Error("deleted");
        return (rows[index] = { ...rows[index], ...patch });
      },
      saveMusic: (item) => {
        const index = rows.findIndex((r) => r.id === item.id);
        if (index < 0) rows.push(item);
        else rows[index] = item;
        return item;
      },
    },
  };
  const context = {
    window,
    document,
    MusicModel,
    fetch,
    URLSearchParams,
    AbortSignal,
    toast: window.toast,
  };
  vm.runInNewContext(fs.readFileSync("dist/music-source-link.js", "utf8"), context);
  return {
    api: window.MusicSourceLink,
    actions: window.CollectionActions,
    document,
    get rows() {
      return rows;
    },
    set rows(value) {
      rows = value;
    },
    get requests() {
      return requests;
    },
    respond: (result) => respond(result),
    allNodes: () => {
      const nodes = [];
      function visit(n) {
        nodes.push(n);
        n.children.forEach(visit);
      }
      visit(body);
      return nodes;
    },
  };
}
test("auto save uses the existing item and validated source; existing source skips all searches", async () => {
  const f = setup(),
    item = f.rows[0],
    task = f.api.autoLink(item);
  assert.equal(f.requests, 1);
  assert.equal(f.rows[0].playbackLookup, "searching");
  assert.equal(f.api.autoLink(item), task, "same flight is reused");
  f.respond({ status: "matched", source, items: [] });
  await task;
  assert.equal(f.rows.length, 1);
  assert.equal(f.rows[0].catalogId, "itunes:123");
  assert.equal(f.rows[0].playbackSource.videoId, source.videoId);
  assert.equal(f.rows[0].playbackLookup, undefined);
  await f.api.autoLink(f.rows[0]);
  assert.equal(f.requests, 1);
});
test("late auto results cannot overwrite manual source, edited metadata or deleted items", async () => {
  for (const mutation of ["manual", "title", "album", "duration", "delete"]) {
    const f = setup(),
      task = f.api.autoLink(f.rows[0]);
    if (mutation === "delete") f.rows = [];
    else
      f.actions.updateItem(
        "song",
        mutation === "manual"
          ? { playbackSource: { type: "local", fileRef: "manual" } }
          : mutation === "title"
            ? { title: "Edited" }
            : mutation === "album"
              ? { albumTitle: "Edited Album" }
              : { trackDuration: 222 },
      );
    f.respond({ status: "matched", source, items: [] });
    await task;
    if (mutation === "delete") assert.equal(f.rows.length, 0);
    else assert.notEqual(f.rows[0].playbackSource?.videoId, source.videoId, mutation);
    if (["title", "album", "duration"].includes(mutation))
      assert.equal(f.rows[0].playbackLookup, undefined, "obsolete search status is cleared");
  }
});
test("metadata request includes album/duration only when available", async () => {
  const f = setup();
  let query;
  // Read the request URL by replacing the VM fetch in a fresh standalone context.
  const window = { MusicModel };
  vm.runInNewContext(fs.readFileSync("dist/music-source-link.js", "utf8"), {
    window,
    document: f.document,
    MusicModel,
    URLSearchParams,
    AbortSignal,
    fetch: async (url) => {
      query = new URL(url, "http://localhost").searchParams;
      return { ok: true, json: async () => ({}) };
    },
  });
  await window.MusicSourceLink.searchSource({
    title: "Song",
    artist: "Artist",
    albumTitle: "Album",
    trackDuration: 210,
  });
  assert.equal(query.get("album"), "Album");
  assert.equal(query.get("duration"), "210");
  await window.MusicSourceLink.searchSource({
    title: "Song",
    artist: "Artist",
  });
  assert.equal(query.has("album"), false);
  assert.equal(query.has("duration"), false);
});
test("ambiguous creation opens cached choices, selection waits for save and preserves manual controls", async () => {
  const f = setup(),
    task = f.api.autoLink(f.rows[0], { openChoose: true });
  f.respond({
    status: "choose",
    source: null,
    items: [
      {
        title: "Song",
        artist: "Artist",
        album: "Album",
        duration: 210,
        ...source,
        image: "https://i.ytimg.com/vi/" + source.videoId + "/default.jpg",
      },
    ],
  });
  await task;
  assert.equal(f.requests, 1);
  assert.equal(f.rows[0].playbackSource, undefined);
  assert.equal(f.document.body.children.length, 1);
  const nodes = f.allNodes(),
    candidate = nodes.find((n) => n.attributes["aria-pressed"] === "false");
  await candidate.onclick({ stopPropagation() {} });
  assert.equal(f.rows[0].playbackSource, undefined);
  assert.ok(nodes.some((n) => n.tagName === "input" && n.type === "file"));
  assert.ok(nodes.some((n) => n.tagName === "a" && n.textContent === "abrir busca no YouTube"));
  const form = nodes.find((n) => n.tagName === "form");
  await form.onsubmit({ preventDefault() {} });
  assert.equal(f.rows[0].playbackSource.videoId, source.videoId);
});
test("malicious automatic results fail without removing saved metadata", async () => {
  for (const invalid of [
    { ...source, videoId: "invalid" },
    { ...source, url: "https://evil.test/watch?v=" + source.videoId },
    { type: "local", fileRef: "unexpected" },
  ]) {
    const f = setup(),
      task = f.api.autoLink(f.rows[0]);
    f.respond({ status: "matched", source: invalid, items: [] });
    await task;
    assert.equal(f.rows[0].playbackSource, undefined);
    assert.equal(f.rows[0].playbackLookup, "failed");
    assert.equal(f.rows[0].catalogId, "itunes:123");
  }
});
