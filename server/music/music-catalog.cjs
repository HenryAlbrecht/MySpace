const createMusicRecommendations = require("../../dist/music/music-recommendations.js");
const { nameKey, matchesRecommendationNames } = createMusicRecommendations;
const { rankCandidates, releaseRecommendations } = require("./music-recommendation-ranking.cjs");
const { createIsrcEditionResolver } = require("./isrc-edition.cjs");
const { createLastfmClient } = require("./lastfm.cjs");
const { createMusicBrainzClient } = require("./musicbrainz.cjs");
const { createYouTubeMusicClient } = require("./youtube-music.cjs");
const { matchPlayback } = require("./music-playback-matcher.cjs");
const MusicModel = require("../../dist/music/music-model.js");
function createMusicCatalog({
  lastfm = createLastfmClient(),
  musicbrainz = createMusicBrainzClient(),
  isrcEdition = createIsrcEditionResolver(),
  youtubeMusic = createYouTubeMusicClient(),
} = {}) {
  const { recommendations, resolveSuggestion } = createMusicRecommendations({
    youtubeMusic, lastfm, MusicModel, rankCandidates, releaseRecommendations,
  });
  return {
    tag: async (tag, section = "info", page = 1) => {
      const result = await lastfm.tag(tag, section, page);
      if (!["music", "album", "artist"].includes(section)) return result;
      const items = [],
        outcomes = [];
      let index = 0;
      await Promise.all(
        Array.from({ length: 2 }, async () => {
          while (index < result.items.length) {
            const position = index++,
              suggestion = result.items[position];
            try {
              const found = await youtubeMusic.search(
                section,
                section === "artist"
                  ? suggestion.title
                  : suggestion.title + " " + suggestion.artist,
              );
              const unique = new Map(
                found.items
                  .filter(
                    (row) =>
                      MusicModel.validCatalogId(section, row.catalogId) &&
                      matchesRecommendationNames(row, suggestion),
                  )
                  .map((row) => [row.catalogId, row]),
              );
              if (unique.size === 1) items[position] = [...unique.values()][0];
              else outcomes.push("unmatched");
            } catch {
              outcomes.push("failed");
            }
          }
        }),
      );
      return {
        ...result,
        items: [...new Map(items.filter(Boolean).map((row) => [row.catalogId, row])).values()],
        partial: outcomes.length > 0,
      };
    },
    summary: async (kind, artist, title) => lastfm.summary(kind, artist, title),
    artistPhoto: async (name, catalogId = "") => {
      const result = await youtubeMusic.search("artist", name);
      const matches = result.items.filter((row) =>
        catalogId ? row.catalogId === catalogId : nameKey(row.title) === nameKey(name),
      );
      return { image: matches.length === 1 ? matches[0].image || "" : "" };
    },
    search: async (kind, query, provider = "auto", options = {}) => {
      if (
        !["auto", "ytmusic"].includes(provider) ||
        !["music", "album", "artist"].includes(kind) ||
        typeof query !== "string" ||
        query.trim().length < 2 ||
        query.length > 200
      ) {
        const e = Error("Busca musical inválida.");
        e.status = 400;
        throw e;
      }
      const result = await youtubeMusic.search(kind, query, options);
      if (kind !== "artist") return result;
      const items = result.items.slice();
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
      for (const row of items)
        if (names.get(artistNameKey(row.title)) > 1)
          row.description = [
            ...(row.genres || []),
            "Artistas homônimos · YouTube Music " + row.catalogId.split(":")[2],
          ].join(" · ");
      return { ...result, items };
    },
    details: async (kind, id, hint = {}) => {
      let row;
      if (String(id).startsWith("ytmusic:")) {
        const match = String(id).match(/^ytmusic:(video|album|artist):([\w-]+)$/);
        if (!match || (kind === "music" ? "video" : kind) !== match[1]) {
          const error = Error("Identidade musical inválida.");
          error.status = 400;
          throw error;
        }
        // Resolve only the requested YouTube entity; playback may reference its audio version.
        row = await youtubeMusic.details(kind, match[2], hint);
        if (
          kind === "music" &&
          /^ytmusic:album:MPRE[\w-]{4,120}$/.test(row.albumCatalogId || "")
        ) {
          const albumId = row.albumCatalogId.split(":")[2],
            album =
              youtubeMusic.peek?.("album", albumId) ||
              ((!row.releaseDate || !row.image || (hint.phase !== "core" && !row.trackNumber))
                ? await youtubeMusic.details("album", albumId).catch(() => null)
                : null);
          if (album) {
            const track = MusicModel.findAlbumTrack(album, row);
            row = {
              ...row,
              image: album.image || row.image,
              imageFallback: album.imageFallback || album.image || row.imageFallback,
              ...(row.releaseDate || !album.releaseDate ? {} : { releaseDate: album.releaseDate }),
              albumContext: album,
              ...(track?.trackNumber ? { trackNumber: track.trackNumber } : {}),
              ...(track?.albumArtist ? { albumArtist: track.albumArtist } : {}),
            };
          }
        }
      } else {
        throw Object.assign(Error("Identidade musical inválida."), { status: 400 });
      }
      if (hint.phase === "core" && String(id).startsWith("ytmusic:")) return row;
      const discographyTask =
        kind === "artist" && row.catalogId?.startsWith("ytmusic:") && youtubeMusic.artistDiscography
          ? youtubeMusic.artistDiscography(row, { force: hint.force === true }).catch(() => null)
          : Promise.resolve(null);
      const editorialTask = (async () => {
        const editorial = await lastfm
          .summary(kind, kind === "artist" ? row.title : row.artist, row.title)
          .catch(() => ({ unavailable: true }));
        if (
          !row.genres?.length &&
          !editorial.genres?.length &&
          ["music", "album"].includes(kind) &&
          row.artist
        ) {
          const inherited = await lastfm
            .summary("artist", row.artist, row.artist)
            .catch(() => ({}));
          if (inherited.genres?.length)
            return { ...editorial, genres: inherited.genres, genresSource: "Last.fm · artista" };
        }
        return editorial;
      })();
      if (kind === "music" && !row.isrc) {
        let identifier = await musicbrainz.recordingIsrc?.(row).catch(() => null);
        if (identifier?.isrc) {
          // A recording code can identify another release edition. Preserve it
          // unless public metadata verifies a unique compatible catalog edition.
          const exact = await isrcEdition(row, [identifier.isrc]).catch(() => null);
          if (!exact) {
            const edition = await isrcEdition(row, undefined, [], {
              localizedAlbumFallback: true,
            }).catch(() => null);
            if (edition) identifier = { isrc: edition, source: "lrc.red" };
          }
        }
        if (identifier?.candidates || identifier?.artistAliases) {
          const code = await isrcEdition(
            row,
            identifier.candidates,
            identifier.artistAliases,
          ).catch(() => null);
          identifier = code ? { isrc: code, source: "lrc.red" } : null;
        }
        if (!identifier) {
          let code = await isrcEdition(row, undefined, [], { localizedAlbumFallback: true }).catch(
            () => null,
          );
          if (!code && musicbrainz.artistAliases) {
            const aliases = await musicbrainz.artistAliases(row.artist).catch(() => []);
            if (aliases.length)
              code = await isrcEdition(row, undefined, aliases, {
                localizedAlbumFallback: true,
              }).catch(() => null);
          }
          if (code) identifier = { isrc: code, source: "lrc.red" };
        }
        row = {
          ...row,
          isrcLookupVersion: 11,
          ...(identifier
            ? {
                isrc: identifier.isrc,
                isrcSource: identifier.source || "MusicBrainz",
                isrcRecordingId: identifier.recordingId,
              }
            : {}),
        };
      }
      const editorial = await editorialTask;
      const discography = await discographyTask;
      if (discography) {
        row = {
          ...row,
          topAlbums: [
            ...new Map(
              [...(row.topAlbums || []), ...discography.items].map((album) => [
                album.catalogId,
                album,
              ]),
            ).values(),
          ],
          discographyResolution: discography.resolution,
        };
      }
      if (!row.genres?.length && editorial.genres?.length)
        row = {
          ...row,
          genres: editorial.genres,
          genresSource: editorial.genresSource || "Last.fm",
        };
      if (kind === "artist")
        row = {
          ...row,
          listeners: editorial.listeners || row.listeners || "",
          playcount: editorial.playcount || row.playcount || "",
        };
      return editorial.summary
        ? {
            ...row,
            summary: editorial.summary,
            summarySource: "Last.fm",
            summaryStatus: "available",
          }
        : { ...row, summaryStatus: editorial.unavailable ? "unavailable" : "missing" };
    },
    playbackSource: async (title, artist, { album = "", duration } = {}) => {
      if (
        typeof title !== "string" ||
        typeof artist !== "string" ||
        !title.trim() ||
        !artist.trim() ||
        title.length > 200 ||
        artist.length > 200 ||
        typeof album !== "string" ||
        album.length > 300 ||
        (duration != null && (!Number.isFinite(duration) || duration <= 0 || duration > 86400))
      ) {
        const error = Error("Informe título, artista e metadata de reprodução válidos.");
        error.status = 400;
        throw error;
      }
      try {
        const result = matchPlayback(
          { title, artist, albumTitle: album, trackDuration: duration },
          await youtubeMusic.searchTracks({
            title,
            artist,
            albumTitle: album,
            trackDuration: duration,
          }),
        );
        return result;
      } catch {
        return {
          status: "not-found",
          provider: "YouTube Music",
          source: null,
          items: [],
          unavailable: true,
        };
      }
    },
    recommendations,
  };
}
module.exports = { createMusicCatalog };
