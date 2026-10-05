// Apple records to the internal catalog model; preserves editions and canonical IDs.
function normalize(row, kind) {
  const album = kind === "album";
  const albumType = /(?:^|[-–—(])\s*EP\s*\)?\s*$/i.test(row.collectionName || "")
    ? "ep"
    : /(?:^|[-–—(])\s*Single\s*\)?\s*$/i.test(row.collectionName || "")
      ? "single"
      : "album";
  if (kind === "artist")
    return {
      kind,
      catalogId: "itunes:" + row.artistId,
      source: "iTunes",
      title: row.artistName || "",
      artist: row.artistName || "",
      url: row.artistLinkUrl || row.artistViewUrl || "",
      image: "",
      genres: row.primaryGenreName ? [row.primaryGenreName] : [],
      description: "Artista · iTunes",
      summary: "",
    };
  return {
    catalogId: "itunes:" + (album ? row.collectionId : row.trackId),
    kind,
    ...(album ? { albumType } : {}),
    source: "iTunes",
    artistCatalogId: row.artistId ? "itunes:" + row.artistId : "",
    albumCatalogId: row.collectionId ? "itunes:" + row.collectionId : "",
    albumTitle: row.collectionName || "",
    ...(kind === "music" && typeof row.isrc === "string" && row.isrc.trim() ? { isrc: row.isrc.trim().toUpperCase() } : {}),
    title: (album ? row.collectionName : row.trackName) || "",
    image: (row.artworkUrl100 || "").replace(/100x100bb/, "600x600bb"),
    url: (album ? row.collectionViewUrl : row.trackViewUrl) || "",
    artist: row.artistName || "",
    description: [row.artistName, row.releaseDate?.slice(0, 10)].filter(Boolean).join(" · "),
    genres: row.primaryGenreName ? [row.primaryGenreName] : [],
    summary: "",
    total: album ? row.trackCount || 0 : 0,
    unit: album ? "faixas" : "audições",
    trackDuration: row.trackTimeMillis ? Math.round(row.trackTimeMillis / 1000) : 0,
    previewUrl: row.previewUrl || "",
    releaseDate: row.releaseDate?.slice(0, 10) || "",
  };
}

module.exports = { normalizeAppleRecord: normalize };
