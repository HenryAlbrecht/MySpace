const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const Collection = require("../dist/collection.js");
const MusicModel = require("../dist/music-model.js");
const MediaEmbeds = require("../dist/media-embeds.js");

function backupValidator() {
  const context = { MusicModel, MediaEmbeds, TitlePreferences: { validate: (value) => value } };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("dist/backup-validation.js", "utf8"), context);
  const dependencies = {
    emptyData: () => ({ history: [], featuredVideo: {} }),
    normalizeSectionOrder: (value) => value || {},
    validateItem: Collection.validateItem,
    kinds: Collection.kinds,
    defaults: { name: "Default", bio: "" },
    safeUrl: (value) => (/^https:\/\//.test(value || "") ? value : ""),
  };
  return (payload) => context.validateProfileBackup(payload, dependencies);
}

function payload() {
  return {
    format: "myspace-backup",
    version: 1,
    profile: { name: "Saved" },
    extras: {
      items: [],
      favorites: [],
      badges: [],
      photos: [],
      blocks: [],
      tracks: [],
    },
  };
}

test("backup validation preserves legacy preference absence and catalog identities", () => {
  const validate = backupValidator();
  const input = payload();
  input.extras.items.push({
    id: "legacy",
    kind: "music",
    title: "Track",
    artist: "Artist",
    catalogId: "deezer:7",
    status: "planned",
  });
  const result = validate(input);
  assert.equal(result.next.items[0].catalogId, "deezer:7");
  assert.equal(result.profile.name, "Saved");
  assert.equal(result.titlePreferences, null);
});

test("backup validation rejects duplicate IDs, nested arbitrary objects and invalid images before writes", () => {
  const validate = backupValidator();
  let input = payload();
  input.extras.tracks = [
    { id: "same", title: "A" },
    { id: "same", title: "B" },
  ];
  assert.throws(() => validate(input), /IDs repetidos/);
  input = payload();
  input.extras.items = [{ id: "a", title: "A", extra: { executable: true } }];
  assert.throws(() => validate(input), /Item inválido/);
  input = payload();
  input.extras.photos = [{ id: "a", image: "javascript:alert(1)" }];
  assert.throws(() => validate(input), /Foto inválida/);
  input = payload();
  input.version = 2;
  assert.throws(() => validate(input), /não é um backup/);
});

test("source lookup shares work and ignores a stale title without saving a suggested source", async () => {
  let resolveResponse,
    requests = 0;
  let item = { id: "track", title: "Original", artist: "Artist" };
  const writes = [];
  const context = {
    MusicModel,
    AbortSignal,
    URLSearchParams,
    fetch: () => {
      requests++;
      return new Promise((resolve) => {
        resolveResponse = resolve;
      });
    },
    CollectionActions: {
      getItems: () => [item],
      updateItem: (id, patch) => {
        writes.push(patch);
        item = { ...item, ...patch };
      },
      saveMusic: () => {
        throw Error("Suggestions must be manually confirmed");
      },
    },
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("dist/music-source-link.js", "utf8"), context);
  const first = context.MusicSourceLink.autoLink(item);
  assert.equal(context.MusicSourceLink.autoLink(item), first);
  item = { ...item, title: "Edited" };
  resolveResponse({ ok: true, json: async () => ({ items: [{ url: "https://example.com/audio.mp3" }] }) });
  await first;
  assert.equal(requests, 1);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].playbackLookup, "searching");
  assert.equal(item.playbackSource, undefined);
});

test("classic script dependencies precede their consumers and are loaded only once", () => {
  const html = fs.readFileSync("dist/index.html", "utf8");
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(scripts).size, scripts.length);
  for (const [dependency, consumer] of [
    ["music-source-link.js", "music-bridge.js"],
    ["spaceamp-global-ui.js", "music-bridge.js"],
    ["profile-appearance.js", "extras.js"],
    ["backup-validation.js", "extras.js"],
    ["party-chat-ui.js", "spacevoice.js"],
    ["title-gallery.js", "title-pages.js"],
  ]) {
    assert.ok(scripts.indexOf(dependency) >= 0, dependency);
    assert.ok(scripts.indexOf(dependency) < scripts.indexOf(consumer), consumer);
  }
});
