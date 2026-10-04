const {createIsrcEditionResolver} = require('./isrc-edition.cjs');
const { createMusicClient } = require("./music.cjs");
const { createArtistArtworkClient } = require("./artist-artwork.cjs");
const { createLastfmClient } = require("./lastfm.cjs");
const { createMusicBrainzClient } = require("./musicbrainz.cjs");
const nameKey = (value) =>
  String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

function matchesRecommendationNames(row, suggestion) {
  return (
    nameKey(row.title) === nameKey(suggestion.title) &&
    (suggestion.kind === "artist" || nameKey(row.artist) === nameKey(suggestion.artist))
  );
}
function createMusicCatalog({
  itunes = createMusicClient(),
  artistArtwork = createArtistArtworkClient(),
  lastfm = createLastfmClient(),
  musicbrainz = createMusicBrainzClient(),
  isrcEdition = createIsrcEditionResolver(),
} = {}) {
  const recommendationStates = new Map(),
    recommendationPending = new Map();
  async function enrich(row, { verify = false } = {}) {
    if (row.kind !== "artist") return row;
    let tracks = row.topTracks || [];
    if (verify && !tracks.length && itunes.artistTracks)
      tracks = await itunes.artistTracks(row.catalogId.split(":")[1]).catch(() => []);
    if (verify && !tracks.length) return { ...row, image: "", artworkSource: "" };
    let image = await artistArtwork.lookup(row.title, { tracks, verify }).catch(() => "");
    if (!image && !tracks.length && /^itunes:[1-9]\d*$/.test(row.catalogId || "") && itunes.artistTracks) {
      tracks = await itunes.artistTracks(row.catalogId.split(":")[1]).catch(() => []);
      if (tracks.length) image = await artistArtwork.lookup(row.title, { tracks }).catch(() => "");
    }
    return { ...row, image, artworkSource: image ? "Deezer" : "" };
  }
  return {
    summary: async (kind, artist, title) => lastfm.summary(kind, artist, title),
    artistPhoto: async (name, catalogId = "") => ({
      image: (await enrich({ kind: "artist", title: name, catalogId })).image,
    }),
    search: async (kind, query, provider = "auto") => {
      if (!["auto", "itunes"].includes(provider)) {
        const e = Error("O catálogo musical usa Apple/iTunes.");
        e.status = 400;
        throw e;
      }
      const result = await itunes.search(kind, query);
      if (kind !== "artist") return result;
      const items = result.items.slice();
      let next = 0;
      const names = new Map();
      const artistNameKey = (value) =>
        String(value || "")
          .normalize("NFC")
          .trim()
          .toLowerCase();
      for (const row of items) {
        const key = artistNameKey(row.title);
        names.set(key, (names.get(key) || 0) + 1);
      }
      await Promise.all(
        Array.from({ length: Math.min(3, items.length) }, async () => {
          while (next < items.length) {
            const index = next++,
              row = items[index],
              ambiguous = names.get(artistNameKey(row.title)) > 1;
            items[index] = await enrich(row, { verify: ambiguous });
            if (ambiguous)
              items[index].description = [
                ...(row.genres || []),
                "Artistas homônimos · Apple " + row.catalogId.split(":")[1],
              ].join(" · ");
          }
        }),
      );
      return { ...result, items };
    },
    details: async (kind, id) => {
      let row = await enrich(await itunes.details(kind, id));
      if (kind === 'music' && !row.isrc) {
        let identifier = await musicbrainz.recordingIsrc?.(row).catch(() => null);
        if (identifier?.candidates || identifier?.artistAliases) {
          const code = await isrcEdition(row, identifier.candidates, identifier.artistAliases).catch(() => null);
          identifier = code ? {isrc:code} : null;
        }
        if (!identifier) {
          let code = await isrcEdition(row, undefined, [], {localizedAlbumFallback:true}).catch(() => null);
          if (!code && musicbrainz.artistAliases) {
            const aliases = await musicbrainz.artistAliases(row.artist).catch(() => []);
            if (aliases.length) code = await isrcEdition(row, undefined, aliases, {localizedAlbumFallback:true}).catch(() => null);
          }
          if (code) identifier = {isrc:code, source:'lrc.red'};
        }
        row = {...row, isrcLookupVersion:6, ...(identifier ? {isrc:identifier.isrc, isrcSource:identifier.source || 'MusicBrainz', isrcRecordingId:identifier.recordingId} : {})};
      }
      const editorial = await lastfm
        .summary(kind, kind === "artist" ? row.title : row.artist, row.title)
        .catch(() => ({ unavailable: true }));
      return editorial.summary
        ? { ...row, summary: editorial.summary, summarySource: "Last.fm", summaryStatus: "available" }
        : { ...row, summaryStatus: editorial.unavailable ? "unavailable" : "missing" };
    },
    playbackSource: async (title, artist) => {
      const result = await musicbrainz.playbackSource(title, artist);
      // Suggestions are never saved automatically, even for a single exact result.
      return {
        status: result.items.length ? "choose" : "not-found",
        items: result.items,
        source: null,
        provider: "MusicBrainz",
      };
    },
    recommendations: async function recommendations(kind, artist, title, { reserve = false } = {}) {
      const key = JSON.stringify([kind, artist, title]);
      if (recommendationPending.has(key)) {
        const previous = await recommendationPending.get(key);
        return reserve && previous.reserveAvailable
          ? recommendations(kind, artist, title, { reserve })
          : previous;
      }
      const task = (async () => {
        let state = recommendationStates.get(key);
        if (!state || state.expires < Date.now()) {
          const result = await lastfm.recommendations(kind, artist, title);
          state = {
            result,
            rows: result.items.slice(0, 48),
            items: [],
            outcomes: [],
            expires: Date.now() + 300000,
            limit: 0,
          };
          if (recommendationStates.size >= 40)
            recommendationStates.delete(recommendationStates.keys().next().value);
          recommendationStates.set(key, state);
        }
        const { result, rows, items, outcomes } = state,
          lookups = new Map();
        let next = 0;
        state.limit = Math.min(rows.length, state.limit ? state.limit + (reserve ? 6 : 0) : 6);
        const limit = state.limit;
        await Promise.all(
          Array.from({ length: Math.min(2, limit) }, async () => {
            while (next < limit) {
              const index = next++,
                suggestion = rows[index];
              if (outcomes[index] && outcomes[index].status !== "failed") {
                if (items[index]?.kind === "artist" && !items[index].image)
                  items[index] = await enrich(items[index]);
                continue;
              }
              try {
                const found = itunes.resolveRecommendation
                  ? null
                  : await itunes.search(
                      suggestion.kind,
                      suggestion.kind === "artist"
                        ? suggestion.title
                        : suggestion.title + " " + suggestion.artist,
                    );
                const match = itunes.resolveRecommendation
                  ? await itunes.resolveRecommendation(suggestion, { lookups })
                  : found.items.find((row) => matchesRecommendationNames(row, suggestion));
                if (
                  match &&
                  /^itunes:[1-9]\d*$/.test(match.catalogId) &&
                  match.kind === suggestion.kind &&
                  matchesRecommendationNames(match, suggestion)
                )
                  items[index] = { ...(await enrich(match)), recommendationSource: "Last.fm" };
                outcomes[index] = { status: items[index] ? "resolved" : "unmatched" };
              } catch (error) {
                outcomes[index] = { status: "failed", ...(error.providerFailure || { type: "unknown" }) };
              }
            }
          }),
        );
        const failed = outcomes.filter((o) => o.status === "failed"),
          failures = failed.length,
          unmatched = outcomes.filter((o) => o.status === "unmatched").length;
        if (limit && failures === limit) {
          const error = Error(
            "Não foi possível consultar a Apple para identificar as recomendações. Tente novamente.",
          );
          error.status = 503;
          error.resolution = {
            status: "unavailable",
            failures,
            total: limit,
            causes: failed.map(({ status, ...cause }) => cause),
          };
          throw error;
        }
        const seen = new Set(),
          resolution = {
            failures,
            unmatched,
            total: limit,
            status: failures ? "partial" : unmatched === limit && limit ? "unmatched" : "complete",
          };
        if (failures) resolution.causes = failed.map(({ status, ...cause }) => cause);
        return {
          ...result,
          items: items.filter((row) => row && !seen.has(row.catalogId) && seen.add(row.catalogId)),
          resolution,
          reserveAvailable: limit < rows.length,
        };
      })().finally(() => recommendationPending.delete(key));
      recommendationPending.set(key, task);
      return task;
    },
  };
}
module.exports = { createMusicCatalog };
