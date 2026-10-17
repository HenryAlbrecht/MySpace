const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync("dist/desktop/desktop-online.js", "utf8");
const MusicModel = require("../../dist/music/music-model.js");
const seed = { kind: "artist", catalogId: "ytmusic:artist:UCseedArtist123", title: "Seed Artist" };
const related = { kind: "artist", catalogId: "ytmusic:artist:UCrelatedArtist123", title: "Related Artist", image: "https://lh3.googleusercontent.com/related" };
const similar = { kind: "artist", catalogId: "ytmusic:artist:UCsimilarArtist123", title: "Similar Artist", image: "https://lh3.googleusercontent.com/similar" };

function fixture({ configured = false, failure = false, ambiguous = false, offline = false, ui = false, timeout = false } = {}) {
  const calls = [];
  const window = {
    __TAURI__: { core: { invoke: async (command, args) => {
      calls.push([command, args]);
      if (command === "lastfm_configured") return timeout ? new Promise(() => {}) : configured;
      if (command === "save_lastfm_key") { configured = !!args.key; return configured; }
      if (command === "translate_desktop_summary") return { responseStatus: 200, responseData: { translatedText: "Texto traduzido" } };
      if (command === "request_lastfm") {
        if (failure) throw Error("Last.fm indisponível");
        if (args.method === "artist.getSimilar") return { similarartists: { artist: [{ name: similar.title }] } };
        if (args.method === "artist.getInfo") return { artist: { bio: { summary: "Editorial" }, tags: { tag: [{ name: "rock" }] } } };
      }
      throw Error("Unexpected command");
    } } },
    LastfmClient: require("../../dist/music/lastfm-client.js"),
    TranslationClient: require("../../dist/music/translation-client.js"),
    createMusicRecommendations: require("../../dist/music/music-recommendations.js"),
    MusicRecommendationRanking: require("../../dist/music/music-recommendation-ranking.js"),
    MusicModel,
    Catalog: {
      prefetchCore: async () => ({ ...seed, relatedArtists: [related] }),
      peekCore: () => null,
      search: async () => ambiguous ? [similar, { ...similar, catalogId: "ytmusic:artist:UCambiguousArtist123" }] : [similar],
    },
    DesktopMusicBrowse: { details: async () => ({ ...seed, image: "personal-or-canonical-photo", topAlbums: [{ catalogId: "ytmusic:album:MPREfixture" }] }) },
    DesktopMusicRecommendations: { recommendations: async () => [related] },
  };
  const nodes = [];
  class Node {
    constructor(tag) { this.tag = tag; this.children = []; this.value = ""; nodes.push(this); }
    append(...children) { this.children.push(...children); }
    setAttribute() {}
    addEventListener() {}
  }
  const dialog = new Node("dialog"), actions = new Node("nav");
  const document = {
    querySelector: (selector) => ui ? selector === ".desktop-poc" ? dialog : actions : null,
    createElement: (tag) => new Node(tag),
  };
  vm.runInNewContext(source, { window, document, navigator: { onLine: !offline }, AbortController, DOMException, setTimeout: (fn, ms) => setTimeout(fn, timeout && ms === 18000 ? 1 : ms), clearTimeout });
  return { window, calls, nodes };
}

test("desktop online bridge is inert on web and does not request anything at boot", () => {
  vm.runInNewContext(source, { window: {} });
  assert.deepEqual(fixture().calls, []);
});

test("Last.fm is optional, canonical YouTube recommendations survive missing key and provider failures", async () => {
  for (const options of [{}, { configured: true, failure: true }]) {
    const { window, calls } = fixture(options);
    const result = await window.DesktopMusicRecommendations.recommendations(seed, { localPool: true });
    assert.equal(result[0].catalogId, related.catalogId);
    assert.equal(result.resolution.status, options.failure ? "partial" : "complete");
    if (!options.configured) assert.equal(calls.some(([command]) => command === "request_lastfm"), false);
  }
});

test("shared Last.fm suggestions resolve to unique canonical IDs and preserve provenance", async () => {
  const { window } = fixture({ configured: true });
  const rows = await window.DesktopMusicRecommendations.recommendations(seed, { localPool: true });
  assert.deepEqual(Array.from(rows, (row) => row.catalogId), [related.catalogId, similar.catalogId]);
  assert.equal(rows[1].recommendationSource, "Last.fm");
  assert.ok(rows.every((row) => MusicModel.validCatalogId("artist", row.catalogId)));
  const ambiguous = await fixture({ configured: true, ambiguous: true }).window.DesktopMusicRecommendations.recommendations(seed, { localPool: true });
  assert.equal(ambiguous.length, 1);
});

test("personal key save/remove uses only native config, invalidates recommendation revision, never reads key back", async () => {
  const { window, calls } = fixture();
  const key = "abcdef0123456789abcdef0123456789";
  assert.equal(await window.DesktopOnlineSettings.saveLastfmKey(key), true);
  assert.equal(window.DesktopMusicRecommendations.revision, 1);
  assert.equal(await window.DesktopOnlineSettings.saveLastfmKey(""), false);
  assert.deepEqual(calls.map(([command]) => command), ["save_lastfm_key", "save_lastfm_key"]);
  assert.equal(source.includes("localStorage"), false);
  assert.equal(source.includes("console."), false);
});

test("editorial preserves canonical photo, identity and partial page content; core skips Last.fm", async () => {
  const { window, calls } = fixture({ configured: true });
  await window.DesktopMusicBrowse.details("artist", "UCseedArtist123", { phase: "core" });
  assert.equal(calls.length, 0);
  const detail = await window.DesktopMusicBrowse.details("artist", "UCseedArtist123");
  assert.equal(detail.catalogId, seed.catalogId);
  assert.equal(detail.image, "personal-or-canonical-photo");
  assert.equal(detail.summarySource, "Last.fm");
  assert.equal(detail.topAlbums.length, 1);
  const failed = await fixture({ configured: true, failure: true }).window.DesktopMusicBrowse.details("artist", "UCseedArtist123");
  assert.equal(failed.image, detail.image);
  assert.equal(failed.topAlbums.length, 1);
});

test("translation is on demand and cached; offline/abort terminate without native requests", async () => {
  const { window, calls } = fixture();
  assert.equal((await window.DesktopTranslation.translate("Original text", "en")).text, "Texto traduzido");
  await window.DesktopTranslation.translate("Original text", "en");
  assert.equal(calls.length, 1);
  await assert.rejects(window.DesktopTranslation.translate("text", "unsupported"));
  await assert.rejects(fixture({ offline: true }).window.DesktopMusicRecommendations.recommendations(seed), /Sem conexão/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(window.DesktopMusicRecommendations.recommendations(seed, { signal: controller.signal }), { name: "AbortError" });
});

test("settings UI saves/removes a personal key and immediately clears the password field", async () => {
  const { calls, nodes } = fixture({ ui: true });
  const input = nodes.find((node) => node.type === "password");
  const save = nodes.find((node) => node.textContent === "Salvar chave");
  const remove = nodes.find((node) => node.textContent === "Remover chave");
  const key = "abcdef0123456789abcdef0123456789";
  input.value = key;
  const task = save.onclick();
  assert.equal(input.value, "");
  await task;
  assert.equal(calls[0][1].key, key);
  assert.ok(nodes.every((node) => !String(node.textContent || "").includes(key)));
  await remove.onclick();
  assert.equal(calls[1][1].key, "");
  input.value = "invalid";
  save.onclick();
  assert.equal(calls.length, 2);
});

test("native timeout preserves valid YouTube results without retries", async () => {
  const { window, calls } = fixture({ timeout: true });
  const rows = await window.DesktopMusicRecommendations.recommendations(seed, { localPool: true });
  assert.equal(rows[0].catalogId, related.catalogId);
  assert.equal(rows.resolution.status, "partial");
  assert.deepEqual(calls.map(([command]) => command), ["lastfm_configured"]);
});

test("translation shares concurrent requests, retains language and does not cache quota errors", async () => {
  const { createTranslationClient } = require("../../dist/music/translation-client.js");
  let requests = 0, quota = true;
  const client = createTranslationClient({ requester: async (text, source) => {
    requests++;
    assert.equal(text, "日本語");
    assert.equal(source, "ja");
    return quota ? { responseStatus: 429, quotaFinished: true } : { responseStatus: 200, responseData: { translatedText: "Japonês" } };
  } });
  await assert.rejects(client.translate("日本語", "ja"), /limite/);
  quota = false;
  const [left, right] = await Promise.all([client.translate("日本語", "ja"), client.translate("日本語", "ja")]);
  assert.equal(left.text, "Japonês");
  assert.equal(right.text, left.text);
  assert.equal(requests, 2);
});

test("Catalog description translation selects the Desktop bridge and preserves the web endpoint", async () => {
  const discovery = fs.readFileSync("dist/catalog/catalog-discovery.js", "utf8");
  for (const desktop of [true, false]) {
    const calls = [];
    const Catalog = {};
    const window = desktop ? { DesktopTranslation: { translate: async (text, source) => { calls.push([text, source]); return { text: "Tradução" }; } } } : {};
    vm.runInNewContext(discovery, {
      window, Catalog, TextEncoder, URLSearchParams,
      fetch: async (url) => { calls.push(url); return { ok: true, json: async () => ({ text: "Tradução" }) }; },
    });
    assert.equal(await Catalog.translateSummary("Description", "en"), "Tradução");
    assert.equal(calls.length, 1);
    if (desktop) assert.equal(calls[0][1], "en");
    else assert.match(calls[0], /^\/api\/translation\?/);
  }
});
