const assert = require("node:assert/strict");
const { createMediaClient } = require("../../server/media.cjs");
const { createServer } = require("../../server.cjs");
(async () => {
  let calls = 0;
  const media = createMediaClient({
    fetchImpl: async (url) => {
      calls++;
      assert.ok(
        url.startsWith("https://www.youtube.com/oembed?") ||
          url.startsWith("https://open.spotify.com/oembed?"),
      );
      return {
        ok: true,
        text: async () =>
          JSON.stringify({
            title: "Fixture song",
            author_name: url.includes("youtube") ? "Artist - Topic" : "Spotify",
            thumbnail_url: "https://example.com/cover.jpg",
          }),
      };
    },
  });
  const youtube = await media.metadata("https://music.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(youtube.artist, "Artist");
  await media.metadata("https://youtu.be/dQw4w9WgXcQ");
  assert.equal(calls, 1);
  const spotify = await media.metadata("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC");
  assert.equal(spotify.title, "Fixture song");
  assert.equal(spotify.artist, "");
  await assert.rejects(media.metadata("http://127.0.0.1/private"), /inválido/);
  const server = createServer({ media });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const base = "http://127.0.0.1:" + server.address().port;
    const response = await fetch(
      base + "/api/media/metadata?url=" + encodeURIComponent("https://youtu.be/dQw4w9WgXcQ"),
    );
    assert.equal(response.status, 200);
    assert.equal((await response.json()).title, "Fixture song");
    const invalid = await fetch(base + "/api/media/metadata?url=http://localhost/private");
    assert.equal(invalid.status, 400);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  console.log(
    "Media metadata: canonical URLs, cache, no fabricated Spotify artist and HTTP route OK.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
