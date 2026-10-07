// Read-only public metadata diagnostic. No lyrics, cookies or credentials are logged.
try {
  process.loadEnvFile(".env");
} catch {}
const fs = require("fs"),
  { createLastfmClient } = require("../../server/lastfm.cjs"),
  { createYouTubeMusicClient } = require("../../server/music/youtube-music.cjs");
(async () => {
  const calls = [],
    lastfm = createLastfmClient({
      fetcher: async (url, options) => {
        calls.push(new URL(url).searchParams.get("method"));
        return fetch(url, options);
      },
    }),
    yt = createYouTubeMusicClient(),
    report = [];
  for (const target of [
    {
      kind: "music",
      query: "Kokudouslope Kinokoteikoku",
      needle: "kokudouslope",
    },
    {
      kind: "album",
      type: "album",
      catalogId: "ytmusic:album:MPREb_PJa845tpmfI",
      query: "Hokorobi Beachside talks",
    },
    {
      kind: "album",
      type: "ep",
      query: "Kasukani Soumatou tokenainamae",
      needle: "kasukani",
    },
    {
      kind: "album",
      type: "single",
      catalogId: "ytmusic:album:MPREb_pnNS2ekfHeB",
      query: "Mado Beachside talks",
    },
    {
      kind: "album",
      type: "single",
      catalogId: "ytmusic:album:MPREb_OoAIskjvZsS",
      query: "Next Chance to Move On Shihoko Hirata",
    },
  ]) {
    const entry = { ...target };
    try {
      const found = target.catalogId ? null : await yt.search(target.kind, target.query),
        row = target.catalogId
          ? { catalogId: target.catalogId }
          : found.items.find((item) => item.title.toLowerCase().includes(target.needle));
      if (!row) {
        entry.error = "No unambiguous title found";
        report.push(entry);
        continue;
      }
      const core = await yt.details(target.kind, row.catalogId.split(":")[2]);
      entry.title = core.title || row.title;
      entry.artist = core.artist || row.artist;
      entry.catalogId = row.catalogId;
      entry.albumType = core.albumType || row.albumType;
      if (target.type && entry.albumType !== target.type) {
        entry.error = "Subtype not confirmed";
        report.push(entry);
        continue;
      }
      let own = {};
      try {
        own = await lastfm.summary(target.kind, entry.artist, entry.title);
      } catch {
        entry.directUnavailable = true;
      }
      entry.directGenres = own.genres || [];
      entry.fallback = false;
      if (!entry.directGenres.length) {
        entry.fallback = true;
        let artist = {};
        try {
          artist = await lastfm.summary("artist", entry.artist, entry.artist);
        } catch {
          entry.artistUnavailable = true;
        }
        entry.genres = artist.genres || [];
        entry.genresSource = entry.genres.length ? "Last.fm · artista" : "";
      } else {
        entry.genres = entry.directGenres;
        entry.genresSource = "Last.fm";
      }
    } catch {
      entry.error = "Public metadata unavailable";
    }
    report.push(entry);
  }
  fs.mkdirSync("artifacts/music-ux-genres", { recursive: true });
  fs.writeFileSync(
    "artifacts/music-ux-genres/live-genres.json",
    JSON.stringify({ report, requests: calls }, null, 2),
  );
  console.log(JSON.stringify({ report, requests: calls }));
})().catch(() => {
  console.error("Metadata diagnostic failed");
  process.exitCode = 1;
});
