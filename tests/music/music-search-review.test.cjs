const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { createMusicCatalog } = require("../../server/music-catalog.cjs"),
  { createMusicBrainzClient } = require("../../server/music/musicbrainz.cjs");
test("official video beyond first three MusicBrainz results is inspected", async () => {
  const ids = Array.from({ length: 5 }, (_, i) => `12345678-1234-1234-1234-123456789ab${i}`),
    calls = [];
  const versions = [
    "360 Reality Audio mix",
    "DJ mix",
    "live",
    "official music video",
    "album version",
  ];
  const rows = ids.map((id, i) => ({
    id,
    title: "Oops!…I Did It Again",
    disambiguation: versions[i],
    "artist-credit": [{ name: "Britney Spears" }],
  }));
  const c = createMusicBrainzClient({
    interval: 0,
    fetcher: async (url) => {
      calls.push(url);
      const index = ids.findIndex((id) => url.includes("/" + id));
      return {
        ok: true,
        json: async () =>
          index < 0
            ? { recordings: rows }
            : {
                ...rows[index],
                relations:
                  index === 3
                    ? [
                        {
                          "target-type": "url",
                          url: {
                            resource: "https://www.youtube.com/watch?v=CduA0TULnow",
                          },
                        },
                      ]
                    : [],
              },
      };
    },
  });
  const r = await c.playbackSource("Oops!...I Did It Again", "Britney Spears");
  assert.equal(r.source.videoId, "CduA0TULnow");
  assert.ok(calls.some((u) => u.includes(ids[3])));
});
