const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { createMusicBrainzClient } = require("../../server/music/musicbrainz.cjs"),
  { createMusicCatalog } = require("../../server/music/music-catalog.cjs");
const row = {
  id: "ca8578d9-7db9-477e-82f2-74cbbf91ef27",
  title: "It's Going Down Now",
  length: 186093,
  isrcs: ["JPK652300130"],
  "artist-credit": [
    { name: "Lotus Juice", artist: { name: "Lotus Juice" } },
    {
      name: "高橋あず美",
      artist: { name: "高橋あず美", aliases: [{ name: "Azumi Takahashi" }] },
    },
  ],
};
const song = {
  kind: "music",
  catalogId: "itunes:1733408557",
  source: "iTunes",
  title: row.title,
  artist: "Azumi Takahashi / Lotus Juice / ATLUS Sound Team / ATLUS GAME MUSIC",
  trackDuration: 186,
};
test("unique recording ISRC is replaced only by a verified compatible release edition", async () => {
  const calls = [];
  const make = (edition) =>
    createMusicCatalog({
      youtubeMusic: {
        details: async () => ({
          kind: "music",
          catalogId: "ytmusic:video:LnOts74hPhU",
          title: "Dance!",
          artist: "Shihoko Hirata · Lotus Juice",
          albumTitle: "Album",
          trackDuration: 209,
        }),
      },
      musicbrainz: { recordingIsrc: async () => ({ isrc: "JPK651500201" }) },
      isrcEdition: async (track, codes) => {
        calls.push(codes);
        return codes ? null : edition;
      },
      lastfm: { summary: async () => ({}) },
    });
  assert.equal(
    (await make("JPK651669301").details("music", "ytmusic:video:LnOts74hPhU")).isrc,
    "JPK651669301",
  );
  assert.deepEqual(calls, [["JPK651500201"], undefined]);
  assert.equal(
    (await make(null).details("music", "ytmusic:video:LnOts74hPhU")).isrc,
    "JPK651500201",
  );
});
function resolver(rows, count = rows.length) {
  return createMusicBrainzClient({
    interval: 0,
    fetcher: async () => ({
      ok: true,
      json: async () => ({ recordings: rows, count }),
    }),
  });
}
test("recording identifier requires exact title, every credited artist/alias, compatible duration and unique code", async () => {
  const r = await resolver([row]).recordingIsrc(song);
  assert.equal(r.isrc, "JPK652300130");
  for (const bad of [
    { ...row, title: row.title + " (Live)" },
    { ...row, length: 190000 },
    { ...row, disambiguation: "live" },
    { ...row, "artist-credit": [{ name: "Someone else" }] },
  ])
    assert.equal(await resolver([bad]).recordingIsrc(song), null);
  assert.deepEqual(
    (await resolver([row, { ...row, isrcs: ["JPVI02500637"] }]).recordingIsrc(song)).candidates,
    ["JPK652300130", "JPVI02500637"],
  );
  assert.equal(await resolver([row], 101).recordingIsrc(song), null);
  assert.equal(await resolver([row]).recordingIsrc({ ...song, trackDuration: 0 }), null);
});
test("enrichment preserves canonical Apple identity and falls back when lookup fails", async () => {
  const make = (musicbrainz) =>
    createMusicCatalog({
      itunes: { details: async () => ({ ...song }) },
      lastfm: { summary: async () => ({}) },
      musicbrainz,
    });
  const item = await make(resolver([row])).details("music", "1733408557");
  assert.equal(item.catalogId, song.catalogId);
  assert.equal(item.source, "iTunes");
  assert.equal(item.isrc, row.isrcs[0]);
  const fallback = await make({
    recordingIsrc: async () => {
      throw Error("offline");
    },
  }).details("music", "1733408557");
  assert.equal(fallback.isrc, undefined);
  assert.equal(fallback.isrcLookupVersion, 11);
});
test("ambiguous recording codes require a confirmed edition before enriching the catalog", async () => {
  const candidates = ["GBCRL1300378", "GBCRL0800305"];
  const make = (code) =>
    createMusicCatalog({
      itunes: { details: async () => ({ ...song }) },
      lastfm: { summary: async () => ({}) },
      musicbrainz: { recordingIsrc: async () => ({ candidates }) },
      isrcEdition: async (track, codes) => {
        assert.equal(track.catalogId, song.catalogId);
        assert.deepEqual(codes, candidates);
        return code;
      },
    });
  assert.equal((await make(candidates[0]).details("music", "1733408557")).isrc, candidates[0]);
  assert.equal((await make(null).details("music", "1733408557")).isrc, undefined);
});
test("soundtrack label does not hide the recording and missing codes preserve verified aliases", async () => {
  const result = await resolver([{ ...row, isrcs: [] }]).recordingIsrc({
    ...song,
    title: song.title + " (Soundtrack)",
  });
  assert.ok(result.artistAliases.includes("Azumi Takahashi"));
  assert.equal(result.isrc, undefined);
  assert.equal(
    await resolver([{ ...row, isrcs: [] }]).recordingIsrc({
      ...song,
      title: song.title + " (Live)",
    }),
    null,
  );
});

test("artist aliases require a unique exact identity and official artist-name aliases", async () => {
  const artist = {
    id: row.id,
    name: "Avril Lavigne",
    aliases: [
      { name: "艾薇儿", type: "Artist name" },
      { name: "Guess", type: "Search hint" },
    ],
  };
  const make = (artists) =>
    createMusicBrainzClient({
      interval: 0,
      fetcher: async () => ({
        ok: true,
        json: async () => ({ count: artists.length, artists }),
      }),
    });
  assert.deepEqual(await make([artist]).artistAliases("Avril Lavigne"), ["艾薇儿"]);
  assert.deepEqual(
    await make([artist, { ...artist, id: "0103c1cc-4a09-4a5d-a344-56ad99a77193" }]).artistAliases(
      "Avril Lavigne",
    ),
    [],
  );
  assert.deepEqual(
    await make([{ ...artist, name: "Other singer" }]).artistAliases("Avril Lavigne"),
    [],
  );
});

test("CV aliases verify character/voice pairing before composing localized credits", async () => {
  const character = {
    id: row.id,
    type: "Character",
    name: "涼宮ハルヒ",
    aliases: [
      { name: "Haruhi Suzumiya", type: "Artist name" },
      { name: "涼宮ハルヒ(C.V.平野 綾)" },
    ],
  };
  const voice = {
    id: "0103c1cc-4a09-4a5d-a344-56ad99a77193",
    name: "平野綾",
    aliases: [{ name: "Aya Hirano", type: "Artist name" }],
  };
  const client = createMusicBrainzClient({
    interval: 0,
    fetcher: async (url) => {
      const q = new URL(url).searchParams.get("query");
      const artists =
        q === 'artist:"涼宮ハルヒ"' ? [character] : q === 'artist:"平野綾"' ? [voice] : [];
      return {
        ok: true,
        json: async () => ({ count: artists.length, artists }),
      };
    },
  });
  assert.deepEqual(await client.artistAliases("涼宮ハルヒ(CV.平野綾)"), [
    "Haruhi Suzumiya (CV: Aya Hirano)",
  ]);
  assert.deepEqual(await client.artistAliases("涼宮ハルヒ(CV.別人)"), []);
});

test("common recording titles are searched with artist constraints, preserving original duration checks", async () => {
  const original = {
    id: "7d5f3abe-3906-4420-baea-ede37df6931f",
    title: "Nobody’s Fool",
    length: 237333,
    isrcs: ["USAR10200232"],
    "artist-credit": [{ name: "Avril Lavigne", artist: { name: "Avril Lavigne" } }],
  };
  const client = createMusicBrainzClient({
    interval: 0,
    fetcher: async (url) => {
      const q = new URL(url).searchParams.get("query");
      const narrowed = q.includes('artist:"Avril Lavigne"');
      return {
        ok: true,
        json: async () => ({
          count: narrowed ? 14 : 140,
          recordings: [original],
        }),
      };
    },
  });
  const track = {
    title: "Nobody's Fool",
    artist: "Avril Lavigne",
    trackDuration: 237,
  };
  assert.equal((await client.recordingIsrc(track)).isrc, "USAR10200232");
  assert.equal(await client.recordingIsrc({ ...track, trackDuration: 240 }), null);
  assert.equal(await client.recordingIsrc({ ...track, artist: "Other singer" }), null);
});
