const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const Collection = require("../dist/collection.js");
const MusicModel = require("../dist/music-model.js");
const MediaEmbeds = require("../dist/media-embeds.js");

test("static assets revalidate with ETag and HEAD without changing API caching", async () => {
  const path = require("node:path");
  const directory = fs.mkdtempSync(
    path.join(require("node:os").tmpdir(), "myspace-static-"),
  );
  const file = path.join(directory, "asset.js");
  fs.writeFileSync(file, "const value = 1;\n");
  const server = require("../server.cjs").createServer({
    directory,
    music: { search: async () => ({ items: [] }) },
  });
  try {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const origin = "http://127.0.0.1:" + server.address().port;
    const first = await fetch(origin + "/asset.js");
    const etag = first.headers.get("etag");
    const content = await first.text();
    assert.equal(first.status, 200);
    assert.ok(etag);
    assert.equal(first.headers.get("cache-control"), "no-cache");
    const unchanged = await fetch(origin + "/asset.js", {
      headers: { "If-None-Match": '"other", ' + etag },
    });
    assert.equal(unchanged.status, 304);
    assert.equal(await unchanged.text(), "");
    const head = await fetch(origin + "/asset.js", { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(head.headers.get("etag"), etag);
    assert.equal(
      Number(head.headers.get("content-length")),
      Buffer.byteLength(content),
    );
    assert.equal(await head.text(), "");
    const headCached = await fetch(origin + "/asset.js", {
      method: "HEAD",
      headers: { "If-None-Match": etag.replace(/^W\//, "") },
    });
    assert.equal(headCached.status, 304);
    const wildcard = await fetch(origin + "/asset.js", {
      headers: { "If-None-Match": "*" },
    });
    assert.equal(wildcard.status, 304);
    fs.writeFileSync(file, "const value = 2;\n");
    fs.utimesSync(file, new Date(2000000000000), new Date(2000000000000));
    const changed = await fetch(origin + "/asset.js", {
      headers: { "If-None-Match": etag },
    });
    assert.equal(changed.status, 200);
    assert.notEqual(changed.headers.get("etag"), etag);
    assert.equal(await changed.text(), "const value = 2;\n");
    const api = await fetch(origin + "/api/music/search?kind=music&q=test", {
      headers: { "If-None-Match": "*" },
    });
    assert.equal(api.status, 200);
    assert.equal(api.headers.get("etag"), null);
    assert.equal(api.headers.get("cache-control"), "no-store");
    fs.mkdirSync(path.join(directory, "folder.js"));
    const directoryHead = await fetch(origin + "/folder.js", {
      method: "HEAD",
      headers: { "If-None-Match": "*" },
    });
    assert.equal(directoryHead.status, 404);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
function backupValidator() {
  const context = {
    MusicModel,
    MediaEmbeds,
    TitlePreferences: { validate: (value) => value },
  };
  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync("dist/backup-validation.js", "utf8"),
    context,
  );
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
  vm.runInContext(
    fs.readFileSync("dist/music-source-link.js", "utf8"),
    context,
  );
  const first = context.MusicSourceLink.autoLink(item);
  assert.equal(context.MusicSourceLink.autoLink(item), first);
  item = { ...item, title: "Edited" };
  resolveResponse({
    ok: true,
    json: async () => ({ items: [{ url: "https://example.com/audio.mp3" }] }),
  });
  await first;
  assert.equal(requests, 1);
  assert.equal(writes.length, 2);
  assert.equal(writes[0].playbackLookup, "searching");
  assert.equal(writes[1].playbackLookup, undefined);
  assert.equal(item.title, "Edited");
  assert.equal(item.playbackSource, undefined);
});

test("classic script dependencies precede their consumers and are loaded only once", () => {
  const html = fs.readFileSync("dist/index.html", "utf8");
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(
    (match) => match[1],
  );
  assert.equal(new Set(scripts).size, scripts.length);
  for (const [dependency, consumer] of [
    ["music-source-link.js", "music-bridge.js"],
    ["spaceamp-global-ui.js", "music-bridge.js"],
    ["profile-appearance.js", "extras.js"],
    ["profile-extras-view.js", "extras.js"],
    ["backup-validation.js", "extras.js"],
    ["party-chat-ui.js", "spacevoice.js"],
    ["title-gallery.js", "title-pages.js"],
    ["title-artist-view.js", "title-pages.js"],
    ["music-page-ui.js", "music-discovery-view.js"],
    ["music-discovery-view.js", "title-pages.js"],
    ["music-collection-matches.js", "title-pages.js"],
    ["spaceamp-visualizer.js", "spaceamp-now-playing.js"],
    ["spaceamp-lyrics-profile.js", "spaceamp-now-playing.js"],
    ["spaceamp-lyrics-navigation.js", "spaceamp-now-playing-input.js"],
    ["spaceamp-now-playing-input.js", "spaceamp-now-playing.js"],
    ["backup-restoration.js", "extras.js"],
  ]) {
    assert.ok(scripts.indexOf(dependency) >= 0, dependency);
    assert.ok(
      scripts.indexOf(dependency) < scripts.indexOf(consumer),
      consumer,
    );
  }
});

test("extracted views cannot own playback or persistent Collection state", () => {
  for (const file of [
    "music-discovery-view.js",
    "music-collection-matches.js",
    "spaceamp-visualizer.js",
    "spaceamp-lyrics-profile.js",
    "spaceamp-lyrics-navigation.js",
    "spaceamp-now-playing-input.js",
    "profile-extras-view.js",
    "title-artist-view.js",
  ]) {
    const source = fs.readFileSync("dist/" + file, "utf8");
    assert.doesNotMatch(
      source,
      /SpaceAmp\.create|new\s+(?:Audio|YT\.Player)\s*\(|localStorage|indexedDB|\.setItem\(/,
      file,
    );
    assert.doesNotMatch(
      source,
      /amp\.(?:play|pause|stop|next|previous|seek|setVolume)\(/,
      file,
    );
  }
  const profileView = fs.readFileSync("dist/profile-extras-view.js", "utf8");
  assert.doesNotMatch(
    profileView,
    /(?:window\.)?CollectionActions\s*=|createSpaceVoice\s*\(|createVoice(?:Media|Transport)\s*\(|MediaStorage\.(?:put|remove)\s*\(/,
  );
  const artistView = fs.readFileSync("dist/title-artist-view.js", "utf8");
  assert.doesNotMatch(
    artistView,
    /(?:window\.)?TitlePages\s*=|\bfetch\s*\(|Catalog\.(?:details?|details?Core|details?Full|enrich)\s*\(|(?:localStorage|indexedDB)|createProvider\s*\(/,
  );
  const production = fs
    .readdirSync("dist")
    .filter((file) => file.endsWith(".js"));
  const owners = production.filter((file) =>
    /(?:window\.)?SPACEAMP\s*=\s*SpaceAmp\.create/.test(
      fs.readFileSync("dist/" + file, "utf8"),
    ),
  );
  assert.deepEqual(owners, ["app.js"]);
  for (const [file, facade] of [
    ["title-pages.js", "TitlePages"],
    ["extras.js", "CollectionActions"],
    ["spaceamp-now-playing.js", "SpaceAmpNowPlaying"],
  ]) {
    assert.match(
      fs.readFileSync("dist/" + file, "utf8"),
      new RegExp("window\\." + facade + "\\s*="),
    );
  }
});

test("canonical documentation names existing production paths", () => {
  for (const file of [
    "AGENTS.md",
    "docs/architecture.md",
    "docs/module-map.md",
    "docs/contracts.md",
    "docs/music/architecture.md",
  ]) {
    for (const match of fs
      .readFileSync(file, "utf8")
      .matchAll(/`((?:dist|server)\/[^`]+\.(?:js|cjs|css|html))`/g)) {
      if (!match[1].includes("*"))
        assert.ok(fs.existsSync(match[1]), file + ": " + match[1]);
    }
  }
});

function restorationFixture({
  preferenceFailure = false,
  profileFailure = false,
  collectionFailure = false,
} = {}) {
  const calls = [];
  const context = {
    localStorage: {
      getItem: () => "old profile",
      setItem: (key, value) => calls.push(["restoreProfile", key, value]),
      removeItem: () => calls.push("removeProfile"),
    },
    MediaPackage: {
      restore: async (files) => {
        calls.push(["media", files]);
        return async () => calls.push("rollbackMedia");
      },
    },
    TitlePreferences: {
      replace: (value) => {
        calls.push(["preferences", value]);
        if (preferenceFailure) throw Error("preferences failed");
        return () => calls.push("rollbackPreferences");
      },
    },
  };
  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync("dist/backup-restoration.js", "utf8"),
    context,
  );
  return {
    calls,
    run: (preferences = {}) =>
      context.restoreProfileBackup(
        {
          profile: { name: "Next" },
          next: { items: [] },
          titlePreferences: preferences,
          packageData: { files: ["blob"] },
        },
        {
          persist: (profile) => {
            calls.push(["profile", profile]);
            return !profileFailure;
          },
          save: (next, history) => {
            calls.push(["collection", next, history]);
            return !collectionFailure;
          },
        },
      ),
  };
}

test("backup transaction preserves ordering, legacy preferences and rollback on each write failure", async () => {
  let fixture = restorationFixture();
  await fixture.run(null);
  assert.deepEqual(
    fixture.calls.map((call) => call[0]),
    ["media", "profile", "collection"],
  );
  assert.equal(fixture.calls.at(-1)[2], false);
  fixture = restorationFixture({ preferenceFailure: true });
  await assert.rejects(fixture.run(), /preferences failed/);
  assert.equal(fixture.calls.at(-1), "rollbackMedia");
  fixture = restorationFixture({ profileFailure: true });
  await assert.rejects(fixture.run(), /salvar o perfil/);
  assert.deepEqual(fixture.calls.slice(-2), [
    "rollbackPreferences",
    "rollbackMedia",
  ]);
  fixture = restorationFixture({ collectionFailure: true });
  await assert.rejects(fixture.run(), /importar o backup/);
  assert.deepEqual(fixture.calls.slice(-3), [
    ["restoreProfile", "myspace-profile-v1", "old profile"],
    "rollbackPreferences",
    "rollbackMedia",
  ]);
});
