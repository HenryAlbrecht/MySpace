(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.createMusicRecommendations = api;
})(typeof globalThis === "object" ? globalThis : this, () => {
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
  function createMusicRecommendations({ youtubeMusic, lastfm, MusicModel, rankCandidates, releaseRecommendations, state = {} }) {
    const recommendationStates = state.recommendationStates ||= new Map(),
      recommendationPending = state.recommendationPending ||= new Map();
    async function resolveSuggestion(suggestion, lookups = new Map()) {
      const query =
        suggestion.kind === "artist" ? suggestion.title : suggestion.title + " " + suggestion.artist;
      const key = suggestion.kind + ":" + query;
      if (!lookups.has(key)) lookups.set(key, youtubeMusic.search(suggestion.kind, query));
      const found = await lookups.get(key);
      const matches = new Map(
        found.items
          .filter(
            (row) =>
              row.kind === suggestion.kind &&
              MusicModel.validCatalogId(row.kind, row.catalogId) &&
              matchesRecommendationNames(row, suggestion),
          )
          .map((row) => [row.catalogId, row]),
      );
      return matches.size === 1 ? [...matches.values()][0] : null;
    }
    async function recommendations(
        kind,
        artist,
        title,
        {
          reserve = false,
          force = false,
          localPool = false,
          videoId = "",
          albumId = "",
          artistId = "",
        } = {},
      ) {
        if (kind === "artist" && artistId) {
          const key = "contextual-artist:" + artistId + ":" + localPool;
          if (recommendationPending.has(key)) return recommendationPending.get(key);
          const task = (async () => {
            const detail = await youtubeMusic.details("artist", artistId);
            if (!localPool) {
              const seen = new Set(["ytmusic:artist:" + artistId]);
              return {
                items: (detail.relatedArtists || [])
                  .filter(
                    (row) =>
                      row.kind === "artist" &&
                      MusicModel.validCatalogId("artist", row.catalogId) &&
                      !seen.has(row.catalogId) &&
                      seen.add(row.catalogId),
                  )
                  .slice(0, 12)
                  .map((row) => ({ ...row, recommendationSource: "YouTube Music" })),
                reserveAvailable: false,
                basis: "Artistas relacionados no YouTube Music",
              };
            }
            const items = [],
              seen = new Set(["ytmusic:artist:" + artistId]),
              names = new Set([nameKey(detail.title || artist)]),
              budget = { lastfmSignals: 0, artistSearches: 0 };
            const append = (row) => {
              const name = nameKey(row.title);
              if (
                row.kind !== "artist" ||
                !MusicModel.validCatalogId("artist", row.catalogId) ||
                seen.has(row.catalogId) ||
                !name ||
                names.has(name)
              )
                return;
              seen.add(row.catalogId);
              names.add(name);
              items.push({
                ...row,
                source: "YouTube Music",
                recommendationSource: row.recommendationSource || "YouTube Music",
              });
            };
            for (const row of detail.relatedArtists || []) append(row);
            let failed = false;
            if (localPool && items.length < 18) {
              budget.lastfmSignals++;
              try {
                const signals = await lastfm.recommendations(
                    "artist",
                    artist || detail.title,
                    artist || detail.title,
                  ),
                  lookups = new Map();
                const suggestions = (signals.items || [])
                  .filter((row) => row.kind === "artist" && !names.has(nameKey(row.title)))
                  .filter(
                    (row, index, rows) =>
                      rows.findIndex((other) => nameKey(other.title) === nameKey(row.title)) ===
                      index,
                  )
                  .slice(0, 6);
                for (let i = 0; i < suggestions.length && items.length < 18; i += 2) {
                  const resolved = await Promise.all(
                    suggestions.slice(i, i + 2).map(async (row) => {
                      budget.artistSearches++;
                      try {
                        return await resolveSuggestion(row, lookups);
                      } catch {
                        failed = true;
                        return null;
                      }
                    }),
                  );
                  for (const row of resolved)
                    if (row) append({ ...row, recommendationSource: "Last.fm" });
                }
              } catch {
                failed = true;
              }
            }
            const pool = items.slice(0, localPool ? 24 : 12);
            return {
              items: pool,
              reserveAvailable: localPool && (pool.length > 12 || failed),
              sourceExhausted: !failed,
              requestBudget: budget,
              resolution: { status: failed ? "partial" : "complete", failures: failed ? 1 : 0 },
              basis: "Artistas relacionados no YouTube Music",
            };
          })().finally(() => recommendationPending.delete(key));
          recommendationPending.set(key, task);
          return task;
        }
        if (kind === "album" && albumId) {
          const key = "contextual-v2:album:" + albumId + ":" + force + ":" + localPool;
          if (recommendationPending.has(key)) return recommendationPending.get(key);
          const task = releaseRecommendations(youtubeMusic, lastfm, resolveSuggestion, albumId, {
            force,
            limit: localPool ? 24 : 12,
          }).finally(() => recommendationPending.delete(key));
          recommendationPending.set(key, task);
          return task;
        }
        if (kind === "music" && videoId) {
          const result = await youtubeMusic.radio(videoId, { force });
          const seed = {
            ...youtubeMusic.peek?.("music", videoId),
            kind: "music",
            catalogId: "ytmusic:video:" + videoId,
            ...(artist ? { artist } : {}),
            ...(artistId ? { artistCatalogId: "ytmusic:artist:" + artistId } : {}),
          };
          return {
            ...result,
            ...rankCandidates(
              seed,
              result.items.map((row) => ({
                ...row,
                recommendationSource: "YouTube Music",
                recommendationSignal: "radio",
              })),
              localPool ? 24 : 12,
            ),
          };
        }
        const key = JSON.stringify([kind, artist, title]);
        if (recommendationPending.has(key)) {
          const previous = await recommendationPending.get(key);
          return reserve && previous.reserveAvailable
            ? recommendations(kind, artist, title, { reserve })
            : previous;
        }
        const task = (async () => {
          let state = recommendationStates.get(key);
          if (force || !state || state.expires < Date.now()) {
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
                if (outcomes[index] && outcomes[index].status !== "failed") continue;
                try {
                  const match = await resolveSuggestion(suggestion, lookups);
                  if (match)
                    items[index] = { ...match, recommendationSource: "Last.fm" };
                  outcomes[index] = { status: items[index] ? "resolved" : "unmatched" };
                } catch (error) {
                  outcomes[index] = {
                    status: "failed",
                    ...(error.providerFailure || { type: "unknown" }),
                  };
                }
              }
            }),
          );
          const failed = outcomes.filter((o) => o.status === "failed"),
            failures = failed.length,
            unmatched = outcomes.filter((o) => o.status === "unmatched").length;
          if (limit && failures === limit) {
            const error = Error(
              "Não foi possível consultar o YouTube Music para identificar as recomendações. Tente novamente.",
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
      }
    return { recommendations, resolveSuggestion };
  }
  return Object.assign(createMusicRecommendations, { nameKey, matchesRecommendationNames });
});
