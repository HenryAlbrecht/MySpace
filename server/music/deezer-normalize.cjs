// Deezer records to the internal catalog model; no requests, cache or ranking.
const types = { music: "track", album: "album", artist: "artist" };

const https = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
};

function normalize(row, kind) {
  const fallback = https(
    kind === "artist"
      ? row.picture_medium || row.picture
      : row.cover_medium || row.album?.cover_medium || row.cover || row.album?.cover,
  );
  return {
    kind,
    catalogId: "deezer:" + row.id,
    source: "Deezer",
    title:
      kind === "artist"
        ? row.name
        : [
            row.title || "",
            row.title_version && !(row.title || "").includes(row.title_version)
              ? row.title_version
              : "",
          ]
            .filter(Boolean)
            .join(" "),
    version: row.title_version || "",
    explicit: row.explicit_lyrics === true,
    artist: kind === "artist" ? row.name : row.artist?.name || "",
    artistCatalogId: row.artist?.id ? "deezer:" + row.artist.id : "",
    albumCatalogId: row.album?.id ? "deezer:" + row.album.id : "",
    albumTitle: row.album?.title || "",
    ...(kind === "music" && typeof row.isrc === "string" && row.isrc.trim()
      ? { isrc: row.isrc.trim().toUpperCase() }
      : {}),
    albumType: row.record_type || "",
    image:
      https(
        kind === "artist"
          ? row.picture_xl || row.picture_big
          : row.cover_xl || row.cover_big || row.album?.cover_xl || row.album?.cover_big,
      ) || fallback,
    imageFallback: fallback,
    url: https(row.link) || "https://www.deezer.com/" + types[kind] + "/" + row.id,
    previewUrl: https(row.preview),
    previewSource: "Deezer",
    description: kind === "artist" ? "Artista · Deezer" : row.artist?.name || "",
    summary: "",
    trackDuration: row.duration || 0,
    releaseDate: row.release_date || "",
    total: kind === "album" ? row.nb_tracks || 0 : 0,
    unit: kind === "album" ? "faixas" : "audições",
  };
}

module.exports = { normalizeDeezerRecord: normalize, catalogTypes: types };
