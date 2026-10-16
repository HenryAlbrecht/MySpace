const { test } = require("node:test");
const assert = require("node:assert/strict");
const Catalog = require("../../dist/catalog/catalog.js");
test("searchPage shares first-page cache with array search and isolates continuation pages", async () => {
  const calls = [];
  const fetcher = async (url) => {
    calls.push(String(url));
    const cursor = new URL(url, "http://localhost").searchParams.get("cursor");
    return {
      ok: true,
      json: async () => ({
        items: [
          {
            kind: "album",
            catalogId: cursor ? "ytmusic:album:MPREnext" : "ytmusic:album:MPREfirst",
            title: "Search",
            image: "",
          },
        ],
        next: cursor ? null : "opaque+=token",
      }),
    };
  };
  const options = { fetcher };
  const initial = await Catalog.searchPage("album", "Page compatibility unique", options);
  assert.equal(initial.next, "opaque+=token");
  const array = await Catalog.search("album", "Page compatibility unique", options);
  assert.ok(Array.isArray(array));
  assert.deepEqual(array, initial.items);
  assert.equal(calls.length, 1);
  const page = await Catalog.searchPage("album", "Page compatibility unique", {
    ...options,
    cursor: initial.next,
  });
  assert.equal(page.next, null);
  assert.equal(page.items[0].catalogId, "ytmusic:album:MPREnext");
  assert.equal(new URL(calls[1], "http://localhost").searchParams.get("cursor"), initial.next);
  assert.equal(
    (await Catalog.search("album", "Page compatibility unique", options))[0].catalogId,
    "ytmusic:album:MPREfirst",
  );
  assert.equal(calls.length, 2);
});
test("Desktop music search uses the native bridge with the existing Catalog page contract", async () => {
  const previousBridge = global.DesktopMusicSearch;
  const calls = [];
  global.DesktopMusicSearch = {
    async search(...args) {
      calls.push(args);
      const cursor = args[2];
      return {
        provider: "YouTube Music",
        items: [
          {
            catalogId: cursor ? "ytmusic:video:nativepage2" : "ytmusic:video:nativepage1",
            title: "Native bridge track",
            description: "Fixture result",
            artist: "Fixture artist",
            image: "https://lh3.googleusercontent.com/native_search_art_123=w800-h800-rj",
            kind: "music",
            source: "YouTube Music",
          },
        ],
        next: cursor
          ? null
          : args[1].startsWith("Invalid")
            ? "\0invalid-cursor"
            : "native-cursor",
      };
    },
  };
  try {
    const fetcher = async () => {
      throw Error("Desktop should not use the HTTP server");
    };
    const first = await Catalog.searchPage("music", "Native bridge catalog contract", { fetcher });
    assert.equal(first.next, "native-cursor");
    assert.equal(first.items[0].catalogId, "ytmusic:video:nativepage1");
    assert.equal(
      first.items[0].image,
      "https://lh3.googleusercontent.com/native_search_art_123=w800-h800-rj",
    );
    assert.deepEqual(
      await Catalog.search("music", "Native bridge catalog contract", { fetcher }),
      first.items,
    );
    const second = await Catalog.searchPage("music", "Native bridge catalog contract", {
      fetcher,
      cursor: first.next,
    });
    assert.equal(second.next, null);
    assert.equal(second.items[0].catalogId, "ytmusic:video:nativepage2");
    assert.deepEqual(calls.map(([kind, query, cursor]) => [kind, query, cursor]), [
      ["music", "Native bridge catalog contract", undefined],
      ["music", "Native bridge catalog contract", "native-cursor"],
    ]);
    const invalidCursorPage = await Catalog.searchPage("music", "Invalid native cursor", { fetcher });
    assert.equal(invalidCursorPage.next, null);
  } finally {
    if (previousBridge === undefined) delete global.DesktopMusicSearch;
    else global.DesktopMusicSearch = previousBridge;
  }
});
test("artist details retain the search photo as primary instead of swapping it for a banner", async () => {
  const item = {
    kind: "artist",
    catalogId: "ytmusic:artist:UCvalid_artist_123",
    title: "Artist",
    image: "https://lh3.googleusercontent.com/search_photo_123=w800-h800-rj",
  };
  for (const image of ["", "https://lh3.googleusercontent.com/banner_photo_123=w2880-h1200-rj"]) {
    const row = await Catalog.details(item, {
      force: true,
      fetcher: async () => ({
        ok: true,
        json: async () => ({ ...item, image }),
      }),
    });
    assert.equal(row.image, item.image);
    if (image) assert.equal(row.imageFallback, image);
  }
});

test("an old artist banner does not override the refreshed catalog photo", async () => {
  const item = {
    kind: "artist",
    catalogId: "ytmusic:artist:UCbanner_artist_123",
    title: "Artist",
    image: "https://lh3.googleusercontent.com/banner_photo_123=w2880-h1200-rj",
  };
  const image = "https://lh3.googleusercontent.com/search_photo_123=w800-h800-rj";
  const row = await Catalog.details(item, {
    force: true,
    fetcher: async () => ({ ok: true, json: async () => ({ ...item, image }) }),
  });
  assert.equal(row.image, image);
});

test("Desktop artist and album details use the typed browse bridge without HTTP fallback", async () => {
  const previousBridge = global.DesktopMusicBrowse;
  const calls = [];
  global.DesktopMusicBrowse = {
    async details(kind, browseId, options) {
      calls.push([kind, browseId, options.phase]);
      return {
        kind,
        catalogId: "ytmusic:" + kind + ":" + browseId,
        title: kind === "artist" ? "Native artist" : "Native album",
        source: "YouTube Music",
        ...(kind === "album" ? { albumTracks: [{ title: "Native track" }] } : {}),
      };
    },
  };
  try {
    const fetcher = async () => {
      throw Error("Desktop must not require the local server for YT Music browse details");
    };
    const artist = await Catalog.details(
      { kind: "artist", catalogId: "ytmusic:artist:UCfixtureArtist123", title: "Artist" },
      { fetcher, force: true, phase: "core" },
    );
    const album = await Catalog.details(
      { kind: "album", catalogId: "ytmusic:album:MPREfixtureAlbum123", title: "Album" },
      { fetcher, force: true },
    );
    assert.equal(artist.title, "Native artist");
    assert.equal(album.albumTracks[0].title, "Native track");
    assert.deepEqual(calls, [
      ["artist", "UCfixtureArtist123", "core"],
      ["album", "MPREfixtureAlbum123", "full"],
    ]);
  } finally {
    if (previousBridge === undefined) delete global.DesktopMusicBrowse;
    else global.DesktopMusicBrowse = previousBridge;
  }
});

test("Search encodes user input without creating extra query parameters", () => {
  const url = new URL(Catalog.request("book", "Berserk &limit=999"));
  assert.equal(url.searchParams.get("limit"), "8");
  assert.equal(url.searchParams.get("q"), "Berserk &limit=999");
  assert.throws(() => Catalog.request("game", "x"));
});
test("Anime imports metadata but never imports a public score as the user's rating", () => {
  const [item] = Catalog.normalize("anime", {
    data: {
      Page: {
        media: [
          {
            id: 1,
            title: { english: "Anime" },
            episodes: 26,
            score: 9.9,
            siteUrl: "https://example.com/anime",
            coverImage: { extraLarge: "https://example.com/cover.jpg" },
          },
        ],
      },
    },
  });
  assert.equal(item.total, 26);
  assert.equal(item.unit, "episódios");
  assert.equal(item.score, undefined);
  assert.equal(item.image, "https://example.com/cover.jpg");
});
test("Unsafe remote image and page URLs are rejected", () => {
  const [item] = Catalog.normalize("manga", {
    data: {
      Page: {
        media: [
          {
            id: 2,
            title: { romaji: "Manga" },
            siteUrl: "javascript:alert(1)",
            coverImage: { large: "data:image/svg+xml,bad" },
          },
        ],
      },
    },
  });
  assert.equal(item.url, "");
  assert.equal(item.image, "");
});
test("Books include author, cover and page count", () => {
  const [item] = Catalog.normalize("book", {
    docs: [
      {
        key: "/works/OL1W",
        title: "Book",
        author_name: ["Author"],
        cover_i: 123,
        number_of_pages_median: 310,
      },
    ],
  });
  assert.equal(item.total, 310);
  assert.equal(item.unit, "páginas");
  assert.ok(item.image.endsWith("123-L.jpg"));
  assert.equal(item.description, "Author");
});
test("Catalog outages use Wikipedia with the correct source attribution", async () => {
  let calls = 0;
  const rows = await Catalog.search("anime", "Outage fixture", {
    fetcher: async () => {
      calls++;
      return calls === 1
        ? { ok: false, status: 504 }
        : {
            ok: true,
            json: async () => ({
              query: {
                pages: [
                  {
                    pageid: 1,
                    title: "Found anime",
                    fullurl: "https://en.wikipedia.org/wiki/Test",
                    thumbnail: { source: "https://example.com/image.jpg" },
                  },
                ],
              },
            }),
          };
    },
  });
  assert.equal(calls, 2);
  assert.equal(rows[0].source, "Wikipedia");
  assert.equal(rows[0].unit, "episódios");
});
test("Failed or aborted searches do not invent results", async () => {
  await assert.rejects(() =>
    Catalog.search("game", "Failure fixture", {
      fetcher: async () => ({ ok: false, status: 503 }),
    }),
  );
  await assert.rejects(() =>
    Catalog.search("anime", "Abort fixture", {
      fetcher: async () => {
        const error = Error("aborted");
        error.name = "AbortError";
        throw error;
      },
    }),
  );
});
