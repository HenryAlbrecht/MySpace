const assert = require("node:assert/strict");
const { createArtistArtworkClient } = require("../server/artist-artwork.cjs");
(async () => {
  let calls = 0;
  const client = createArtistArtworkClient({
    fetcher: async (url) => {
      calls++;
      assert.equal(new URL(url).hostname, "api.deezer.com");
      return {
        ok: true,
        json: async () => ({
          data: [
            {
              id: 1,
              name: "DJ Radiohead",
              picture_xl: "https://cdn-images.dzcdn.net/wrong.jpg",
            },
            {
              id: 2,
              name: "Radiohead",
              picture_xl: "https://cdn-images.dzcdn.net/correct.jpg",
            },
          ],
        }),
      };
    },
  });
  const results = await Promise.all([client.lookup("Radiohead"), client.lookup("Radiohead")]);
  assert.equal(results[0], "https://cdn-images.dzcdn.net/correct.jpg");
  assert.equal(calls, 1);
  await client.lookup("Radiohead");
  assert.equal(calls, 1);
  const malicious = createArtistArtworkClient({
    fetcher: async () => ({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 1,
            name: "Artist",
            picture_xl: "https://other.example/photo.jpg",
          },
        ],
      }),
    }),
  });
  assert.equal(await malicious.lookup("Artist"), "");
  const offline = createArtistArtworkClient({
    fetcher: async () => {
      throw Error("Offline");
    },
  });
  assert.equal(await offline.lookup("Artist"), "");
  console.log(
    "Deezer photo enrichment: name match, host validation, shared requests, cache and outage fallback OK.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
