const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { createMusicBrainzClient } = require("../../server/musicbrainz.cjs");
const id = "12345678-1234-1234-1234-123456789abc";
function client({
  artist = "Artist",
  title = "Song",
  disambiguation = "",
  links = ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
  failure = false,
} = {}) {
  let calls = 0;
  return {
    get calls() {
      return calls;
    },
    api: createMusicBrainzClient({
      interval: 0,
      fetcher: async (url) => {
        calls++;
        assert.equal(new URL(url).hostname, "musicbrainz.org");
        if (failure) throw Error("offline");
        return {
          ok: true,
          json: async () =>
            url.includes("recording/" + id)
              ? {
                  id,
                  title,
                  disambiguation,
                  "artist-credit": [{ name: artist }],
                  relations: links.map((resource) => ({
                    "target-type": "url",
                    url: { resource },
                  })),
                }
              : {
                  recordings: [
                    {
                      id,
                      title,
                      disambiguation,
                      "artist-credit": [{ name: artist }],
                    },
                  ],
                },
        };
      },
    }),
  };
}
test("keyless lookup returns one exact supported source and caches requests", async () => {
  const c = client();
  const result = await c.api.playbackSource("Song", "Artist");
  assert.equal(result.source.videoId, "dQw4w9WgXcQ");
  assert.equal(result.provider, "MusicBrainz");
  await c.api.playbackSource("Song", "Artist");
  assert.equal(c.calls, 2);
});
test("no fabricated URL for other artist, missing sources, catalog or unsafe URLs", async () => {
  for (const opts of [
    { artist: "Other" },
    { links: [] },
    {
      links: [
        "https://www.deezer.com/track/1",
        "javascript:alert(1)",
        "https://evil.test/watch?v=dQw4w9WgXcQ",
      ],
    },
  ]) {
    const r = await client(opts).api.playbackSource("Song", "Artist");
    assert.equal(r.source, null);
    assert.equal(r.status, "not-found");
  }
});
test("ambiguous sources and versions require manual selection", async () => {
  for (const opts of [
    {
      links: [
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://www.youtube.com/watch?v=M7lc1UVf-VE",
      ],
    },
    { disambiguation: "live version" },
  ]) {
    const r = await client(opts).api.playbackSource("Song", "Artist");
    assert.equal(r.source, null);
    assert.equal(r.status, "choose");
  }
});
test("bad query and network failures propagate without leaking credentials", async () => {
  await assert.rejects(client().api.playbackSource("", "Artist"), {
    status: 400,
  });
  await assert.rejects(client({ failure: true }).api.playbackSource("Song", "Artist"), /offline/);
});
