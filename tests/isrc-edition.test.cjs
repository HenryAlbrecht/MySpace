const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { createIsrcEditionResolver } = require("../server/isrc-edition.cjs");
const track = {
  title: "Heaven Knows I'm Miserable Now",
  artist: "The Smiths",
  albumTitle: "Hatful of Hollow",
  trackDuration: 216,
};
const a = "GBCRL1300378",
  b = "GBCRL0800305";
const metadata = {
  isrc: a,
  title: track.title,
  artist: track.artist,
  album: track.albumTitle,
  duration: 216.44,
};

test("bilingual catalog titles discover transcription metadata, including when fuzzy search returns unrelated hits", async () => {
  const track = {
    title: "国道スロープ - Kokudouslope",
    artist: "Kinokoteikoku",
    albumTitle: "eureka",
    trackDuration: 250,
  };
  const edition = {
    isrc: "JPB451202866",
    title: "Kokudouslope",
    artist: "Kinoko Teikoku",
    album: "Eureka",
    duration: 249.76,
  };
  const queries = [];
  const make = (rows) =>
    createIsrcEditionResolver({
      fetcher: async (url) => {
        const u = new URL(url);
        queries.push(u.searchParams.get("q"));
        return {
          ok: true,
          json: async () =>
            url.includes("/s/")
              ? rows.find((row) => url.includes(row.isrc))
              : u.searchParams.get("q") === "kokudouslope eureka"
                ? { hits: rows, next: null }
                : {
                    hits: [{ ...edition, title: "Unrelated Song" }],
                    next: null,
                  },
        };
      },
    });
  assert.equal(
    await make([edition])(track, undefined, [], {
      localizedAlbumFallback: true,
    }),
    edition.isrc,
  );
  assert.ok(queries.includes("kokudouslope eureka"));
  for (const patch of [
    { artist: "Other Band" },
    { album: "Other Album" },
    { duration: 255 },
    { title: "Kokudouslope (Live)" },
    { title: "Kokudouslope (Remix)" },
  ])
    assert.equal(
      await make([{ ...edition, ...patch }])(track, undefined, [], {
        localizedAlbumFallback: true,
      }),
      null,
    );
  assert.equal(
    await make([edition, { ...edition, isrc: "JPB451202867" }])(track, undefined, [], {
      localizedAlbumFallback: true,
    }),
    null,
  );
  assert.equal(
    await make([edition])(
      { ...track, title: "国道スロープ - Kokudouslope (Live)" },
      undefined,
      [],
      { localizedAlbumFallback: true },
    ),
    null,
  );
  assert.equal(
    await make([edition])({ ...track, title: "Other Song - Kokudouslope" }, undefined, [], {
      localizedAlbumFallback: true,
    }),
    null,
  );
});
test("remaster qualifier on title versus album resolves only the same album; irrelevant match hits do not exceed candidate bound", async () => {
  const track = {
    title: "Wonderwall",
    artist: "Oasis",
    albumTitle: "(What's The Story) Morning Glory? (Remastered)",
    trackDuration: 259,
  };
  const edition = {
    isrc: "GBQCP1400149",
    title: "Wonderwall (Remastered)",
    artist: "Oasis",
    album: "(What's the Story) Morning Glory? [Remastered]",
    duration: 258.773,
  };
  const unrelated = Array.from({ length: 10 }, (_, i) => ({
    ...edition,
    title: "Wonderwall (Live)",
    isrc: "GBQCP14001" + String(i).padStart(2, "0"),
  }));
  const make = (rows) =>
    createIsrcEditionResolver({
      fetcher: async (url) => ({
        ok: true,
        json: async () =>
          url.includes("/s/")
            ? rows.find((row) => url.includes(row.isrc))
            : { hits: rows, next: null },
      }),
    });
  assert.equal(
    await make([edition, ...unrelated])(track, undefined, [], {
      localizedAlbumFallback: true,
    }),
    edition.isrc,
  );
  assert.equal(
    await make([{ ...edition, album: "Another Album" }])(track, undefined, [], {
      localizedAlbumFallback: true,
    }),
    null,
  );
  assert.equal(
    await make([edition])(
      { ...track, albumTitle: "(What's The Story) Morning Glory?" },
      undefined,
      [],
      { localizedAlbumFallback: true },
    ),
    null,
  );
});
function resolver(rows) {
  return createIsrcEditionResolver({
    fetcher: async (url) => {
      const code = url.split("/").pop().replace(".json", "");
      return { ok: !!rows[code], json: async () => rows[code] };
    },
  });
}
test("joined romanized artist finds an album edition without accepting other artists, albums or durations", async () => {
  const track = {
    title: "Thanatos",
    artist: "Kinokoteikoku",
    albumTitle: "Time Lapse",
    trackDuration: 279,
  };
  const original = {
    isrc: "JPPO01803515",
    title: "Thanatos",
    artist: "Kinoko Teikoku",
    album: "Time Lapse",
    duration: 278.28,
  };
  const make = (rows) =>
    createIsrcEditionResolver({
      fetcher: async (url) => ({
        ok: true,
        json: async () =>
          url.includes("match.json")
            ? { hits: [] }
            : url.includes("search.json")
              ? (assert.equal(new URL(url).searchParams.get("q"), "thanatos time lapse"),
                { hits: rows, next: null })
              : rows.find((row) => url.includes(row.isrc)),
      }),
    });
  assert.equal(
    await make([original])(track, undefined, [], {
      localizedAlbumFallback: true,
    }),
    original.isrc,
  );
  for (const patch of [
    { artist: "Other Artist" },
    { album: "Live Album" },
    { duration: 285 },
    { title: "Thanatos (Live)" },
  ])
    assert.equal(
      await make([{ ...original, ...patch }])(track, undefined, [], {
        localizedAlbumFallback: true,
      }),
      null,
    );
  assert.equal(
    await make([original, { ...original, isrc: "JPPO01803516" }])(track, undefined, [], {
      localizedAlbumFallback: true,
    }),
    null,
  );
});
test("chooses the verified album edition rather than the first available lyrics", async () => {
  const resolve = resolver({
    [a]: metadata,
    [b]: { ...metadata, isrc: b, album: "The Sound of The Smiths" },
  });
  assert.equal(await resolve(track, [b, a]), a);
  assert.equal(await resolve({ ...track, albumTitle: "The Sound of the Smiths" }, [a, b]), b);
});
test("rejects incompatible metadata, missing metadata and ambiguous editions", async () => {
  for (const change of [
    { title: "Other song" },
    { artist: "Other artist" },
    { album: "Other album" },
    { duration: 220 },
    { isrc: b },
  ])
    assert.equal(await resolver({ [a]: { ...metadata, ...change } })(track, [a]), null);
  assert.equal(await resolver({})(track, [a]), null);
  assert.equal(
    await resolver({ [a]: metadata, [b]: { ...metadata, isrc: b } })(track, [a, b]),
    null,
  );
  assert.equal(await resolver({ [a]: metadata })({ ...track, albumTitle: "" }, [a]), null);
});
test("missing recording codes can resolve through search with verified artist aliases", async () => {
  const resolve = createIsrcEditionResolver({
    fetcher: async (url) => ({
      ok: true,
      json: async () =>
        url.includes("search.json")
          ? { hits: [{ isrc: a }], next: null }
          : { ...metadata, artist: "Verified Alias" },
    }),
  });
  assert.equal(await resolve(track, undefined, ["Verified Alias"]), a);
  assert.equal(await resolve(track, undefined, ["Different Alias"]), null);
  assert.equal(
    await resolve({ ...track, trackDuration: 230 }, undefined, ["Verified Alias"]),
    null,
  );
});

test("localized album fallback requires unique exact title, artist and duration", async () => {
  const original = {
    isrc: "JPK650900100",
    title: "A Way of Life",
    artist: "Mayumi Fujita",
    album: "ペルソナ3 ポータブル オリジナル・サウンドトラック",
    duration: 140.68,
  };
  const remix = {
    ...original,
    isrc: "JPK650900162",
    title: "A way of Life -Deep inside my mind Remix-",
    duration: 229.333,
  };
  const track = {
    title: original.title,
    artist: original.artist,
    albumTitle: "Persona 3 Portable (Original Soundtrack)",
    trackDuration: 141,
  };
  const make = (rows) =>
    createIsrcEditionResolver({
      fetcher: async (url) => ({
        ok: true,
        json: async () =>
          url.includes("match.json") ? { hits: rows } : rows.find((r) => url.includes(r.isrc)),
      }),
    });
  assert.equal(
    await make([original, remix])(track, undefined, [], {
      localizedAlbumFallback: true,
    }),
    original.isrc,
  );
  assert.equal(
    await make([original, { ...original, isrc: "JPK650900101" }])(track, undefined, [], {
      localizedAlbumFallback: true,
    }),
    null,
  );
  assert.equal(await make([remix])(track, undefined, [], { localizedAlbumFallback: true }), null);
  assert.equal(
    await make([{ ...original, artist: "Other singer" }])(track, undefined, [], {
      localizedAlbumFallback: true,
    }),
    null,
  );
});

test("localized artist fallback normalizes search punctuation and rejects live recording", async () => {
  const track = {
    title: "Nobody's Fool",
    artist: "Avril Lavigne",
    albumTitle: "Let Go (20th Anniversary Edition)",
    trackDuration: 240,
  };
  const rows = [
    {
      isrc: "USAR10200232",
      title: track.title,
      artist: "艾薇儿",
      album: "Let Go",
      duration: 239.751,
    },
    {
      isrc: "USAR10300625",
      title: track.title + " (Live)",
      artist: "艾薇儿",
      album: "Live",
      duration: 245.667,
    },
  ];
  const resolve = createIsrcEditionResolver({
    fetcher: async (url) => ({
      ok: true,
      json: async () =>
        url.includes("match.json")
          ? { hits: [] }
          : url.includes("search.json")
            ? (assert.equal(new URL(url).searchParams.get("q"), "nobody s fool avril lavigne"),
              { hits: rows, next: null })
            : rows.find((r) => url.includes(r.isrc)),
    }),
  });
  assert.equal(
    await resolve(track, undefined, ["艾薇儿"], {
      localizedAlbumFallback: true,
    }),
    "USAR10200232",
  );
  assert.equal(
    await resolve(track, undefined, ["Other artist"], {
      localizedAlbumFallback: true,
    }),
    null,
  );
});

test("God knows CV alias match accepts only original title and duration", async () => {
  const original = {
    isrc: "JPI100601012",
    title: "God knows...",
    artist: "Haruhi Suzumiya (CV: Aya Hirano)",
    album: "Imaginary ENOZ featuring HARUHI - EP",
    duration: 278.909,
  };
  const track = {
    title: original.title,
    artist: "涼宮ハルヒ(CV.平野綾)",
    albumTitle: original.album,
    trackDuration: 279,
  };
  const resolve = createIsrcEditionResolver({
    fetcher: async (url) => ({
      ok: true,
      json: async () =>
        url.includes("/s/")
          ? original
          : {
              hits: new URL(url).searchParams.get("artist") === original.artist ? [original] : [],
            },
    }),
  });
  assert.equal(
    await resolve(track, undefined, [original.artist], {
      localizedAlbumFallback: true,
    }),
    original.isrc,
  );
  assert.equal(
    await resolve({ ...track, title: "God knows... (Live)" }, undefined, [original.artist], {
      localizedAlbumFallback: true,
    }),
    null,
  );
  assert.equal(
    await resolve({ ...track, trackDuration: 296 }, undefined, [original.artist], {
      localizedAlbumFallback: true,
    }),
    null,
  );
});
