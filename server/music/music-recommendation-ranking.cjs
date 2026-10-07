const normalize = (value) =>
  String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
function artists(row) {
  const entries = Array.isArray(row.artists) ? row.artists : [];
  const ids = new Set(
    [
      row.artistCatalogId,
      ...(row.artistCatalogIds || []),
      ...entries.map((a) => a.catalogId || a.artistCatalogId),
    ].filter(Boolean),
  );
  const names = new Set(
    [
      ...(row.artist ? row.artist.split(/\s*[·;]\s*/) : []),
      ...entries.map((a) => a.name || a.title),
    ]
      .map(normalize)
      .filter(Boolean),
  );
  return { ids, names };
}
function sameArtist(a, b) {
  const left = artists(a),
    right = artists(b);
  const overlap = (x, y) => [...x].some((key) => y.has(key));
  return left.ids.size && right.ids.size
    ? overlap(left.ids, right.ids)
    : overlap(left.names, right.names);
}
function rankCandidates(seed, candidates, limit = 12) {
  const seen = new Set([seed.catalogId]),
    cross = [],
    own = [],
    audit = [];
  const metadata = new Map();
  for (const row of candidates) {
    const previous = metadata.get(row.catalogId) || {};
    metadata.set(row.catalogId, {
      albumType: row.albumType || previous.albumType,
      artistCatalogId: row.artistCatalogId || previous.artistCatalogId,
      artist: row.artist || previous.artist,
    });
  }
  for (const candidate of candidates) {
    const known = metadata.get(candidate.catalogId);
    const row = {
      ...candidate,
      albumType: candidate.albumType || known.albumType,
      artistCatalogId: candidate.artistCatalogId || known.artistCatalogId,
      artist: candidate.artist || known.artist,
    };
    let reason = "";
    if (!row.catalogId || seen.has(row.catalogId)) reason = "duplicate-or-seed";
    else if (row.kind !== seed.kind) reason = "entity-class";
    else if (seed.kind === "album" && seed.albumType && row.albumType !== seed.albumType)
      reason = "release-subtype";
    else if (
      seed.kind === "album" &&
      !row.albumType &&
      (row.recommendationSignal !== "related" || sameArtist(seed, row))
    )
      reason = "unknown-subtype";
    seen.add(row.catalogId);
    if (!reason) (sameArtist(seed, row) ? own : cross).push(row);
    audit.push({
      catalogId: row.catalogId,
      artist: row.artist,
      albumType: row.albumType,
      source: row.recommendationSignal,
      reason: reason || "eligible",
    });
  }
  // Preserve source relevance within proven release subtypes.
  if (seed.kind === "album") cross.sort((a, b) => Number(!a.albumType) - Number(!b.albumType));
  const items = [],
    remaining = cross.slice(),
    counts = new Map();
  while (remaining.length && items.length < limit) {
    const head = remaining[0],
      tier = (row) => [!!row.albumType, row.recommendationSignal].join(":");
    const key = (row) => [...artists(row).ids][0] || [...artists(row).names][0] || "";
    const previous = items.at(-1);
    let selected = 0;
    // Diversify within an equally relevant source tier, never ahead of a
    // stronger explicit relationship or a known release subtype.
    for (let i = 1; i < remaining.length && tier(remaining[i]) === tier(head); i++) {
      const score = (row) =>
        (key(row) && key(row) === key(previous || {}) ? 10 : 0) + (counts.get(key(row)) || 0);
      if (score(remaining[i]) < score(remaining[selected])) selected = i;
    }
    const [row] = remaining.splice(selected, 1);
    items.push(row);
    counts.set(key(row), (counts.get(key(row)) || 0) + 1);
  }
  for (const row of own.slice(0, 2)) {
    if (items.length >= limit) break;
    // When possible, leave a cross-artist item between the two own releases.
    if (items.length > 1 && !items.some((item) => sameArtist(seed, item)))
      items.splice(items.length - 1, 0, row);
    else items.push(row);
  }
  for (const entry of audit) {
    const rank = items.findIndex((row) => row.catalogId === entry.catalogId);
    if (entry.reason === "eligible")
      entry.reason =
        rank >= 0
          ? "included"
          : sameArtist(
                seed,
                candidates.find((row) => row.catalogId === entry.catalogId),
              )
            ? "same-artist-quota"
            : "batch-limit";
    if (rank >= 0) entry.rank = rank + 1;
  }
  return { items, audit };
}
async function releaseRecommendations(
  youtubeMusic,
  lastfm,
  resolve,
  albumId,
  { force = false, limit = 12 } = {},
) {
  const cached = youtubeMusic.peek?.("album", albumId);
  const detailed = await youtubeMusic.details("album", albumId);
  const album = { ...cached, ...detailed, albumType: detailed.albumType || cached?.albumType };
  const seed = { ...album, kind: "album", catalogId: "ytmusic:album:" + albumId };
  const candidates = [],
    failures = [],
    budget = {
      radio: 0,
      currentArtistDetails: 0,
      relatedArtistDetails: 0,
      releaseDetails: 0,
      lastfmSignals: 0,
      artistSearches: 0,
    };
  const unavailable = (stage, fallback) => () => {
    failures.push({ type: "provider", stage });
    return fallback;
  };
  const append = (rows, signal, source = "YouTube Music") => {
    for (const row of rows || [])
      if (row.kind === "album" && /^ytmusic:album:MPRE[\w-]{4,120}$/.test(row.catalogId || ""))
        candidates.push({ ...row, recommendationSignal: signal, recommendationSource: source });
  };
  const desiredTotal = Math.min(limit, limit > 12 ? 20 : 10),
    desiredCross = Math.min(limit, limit > 12 ? 18 : 10);
  const enough = () => {
    const ranked = rankCandidates(seed, candidates, limit).items;
    return (
      ranked.length >= desiredTotal &&
      ranked.filter((row) => !sameArtist(seed, row)).length >= desiredCross
    );
  };
  const hydrated = new Set();
  const hydrateUnknown = async () => {
    const priorities = {
      related: 0,
      radio: 1,
      "related-artist": 2,
      "similar-artist": 3,
      "own-artist": 4,
    };
    const unknown = candidates
      .filter((row) => !row.albumType && !hydrated.has(row.catalogId))
      .sort(
        (a, b) =>
          (priorities[a.recommendationSignal] ?? 5) - (priorities[b.recommendationSignal] ?? 5),
      );
    for (let i = 0; i < unknown.length && budget.releaseDetails < 4 && !enough(); i += 2) {
      const batch = unknown.slice(i, i + Math.min(2, 4 - budget.releaseDetails)).filter((row) => {
        if (hydrated.has(row.catalogId)) return false;
        hydrated.add(row.catalogId);
        return true;
      });
      await Promise.all(
        batch.map(async (row) => {
          budget.releaseDetails++;
          try {
            const detail = await youtubeMusic.details("album", row.catalogId.split(":")[2]);
            if (["album", "ep", "single"].includes(detail.albumType))
              for (const candidate of candidates)
                if (candidate.catalogId === row.catalogId)
                  Object.assign(candidate, {
                    ...detail,
                    kind: row.kind,
                    catalogId: row.catalogId,
                    recommendationSignal: candidate.recommendationSignal,
                    recommendationSource: candidate.recommendationSource,
                  });
          } catch {
            unavailable("release-detail")();
          }
        }),
      );
    }
  };
  append(album.relatedAlbums, "related");
  await hydrateUnknown();
  if (!enough()) {
    const video = album.albumTracks?.find((row) => row.playbackSource?.videoId)?.playbackSource
      .videoId;
    if (video) {
      budget.radio++;
      const radio = await youtubeMusic
        .radio(video, { force })
        .catch(unavailable("radio", { items: [] }));
      const releases = new Map();
      for (const track of radio.items || [])
        if (
          track.albumTitle &&
          /^ytmusic:album:MPRE[\w-]{4,120}$/.test(track.albumCatalogId || "") &&
          track.albumCatalogId !== seed.catalogId
        ) {
          const id = track.albumCatalogId.split(":")[2];
          if (!releases.has(id))
            releases.set(id, {
              kind: "album",
              catalogId: track.albumCatalogId,
              title: track.albumTitle,
              artist: track.artist,
              artistCatalogId: track.artistCatalogId,
              artists: track.artists,
              image: track.image,
              imageFallback: track.imageFallback,
              source: "YouTube Music",
              ...youtubeMusic.peek?.("album", id),
            });
        }
      append([...releases.values()], "radio");
      await hydrateUnknown();
    }
  }
  const currentId = album.artistCatalogId?.split(":")[2];
  let current = currentId ? youtubeMusic.peek?.("artist", currentId) : null;
  if (!Array.isArray(current?.topAlbums)) current = null;
  if (!enough() && !current && currentId) {
    budget.currentArtistDetails++;
    current = await youtubeMusic
      .details("artist", currentId)
      .catch(unavailable("current-artist", null));
  }
  const visited = new Set(currentId ? [currentId] : []);
  const collectArtists = async (rows, signal, source) => {
    const valid = (rows || []).filter(
      (row) =>
        /^ytmusic:artist:UC[\w-]{8,80}$/.test(row.catalogId || "") &&
        !visited.has(row.catalogId.split(":")[2]),
    );
    for (let i = 0; i < valid.length && !enough(); i += 2) {
      const batch = valid.slice(i, i + 2).filter((row) => {
        const id = row.catalogId.split(":")[2];
        if (visited.has(id)) return false;
        visited.add(id);
        return true;
      });
      const details = await Promise.all(
        batch.map(async (row) => {
          const id = row.catalogId.split(":")[2];
          let detail = youtubeMusic.peek?.("artist", id);
          if (!Array.isArray(detail?.topAlbums)) {
            if (budget.relatedArtistDetails >= 3) return null;
            budget.relatedArtistDetails++;
            detail = await youtubeMusic
              .details("artist", id)
              .catch(unavailable("related-artist", null));
          }
          return detail;
        }),
      );
      for (const detail of details) append(detail?.topAlbums, signal, source);
      await hydrateUnknown();
      if (budget.relatedArtistDetails >= 3) break;
    }
  };
  if (!enough())
    await collectArtists(current?.relatedArtists?.slice(0, 2), "related-artist", "YouTube Music");
  if (!enough() && budget.relatedArtistDetails < 3) {
    budget.lastfmSignals++;
    const result = await lastfm
      .recommendations("artist", album.artist || "", album.artist || "")
      .catch(() => ({ items: [] }));
    for (const row of (result.items || []).slice(0, 3)) {
      if (enough() || budget.relatedArtistDetails >= 3) break;
      budget.artistSearches++;
      const match = await resolve(row).catch(() => null);
      if (match) await collectArtists([match], "similar-artist", "Last.fm");
    }
  }
  append(current?.topAlbums, "own-artist");
  await hydrateUnknown();
  const ranked = rankCandidates(seed, candidates, limit);
  return {
    ...ranked,
    requestBudget: budget,
    resolution: {
      status: failures.length ? "partial" : "complete",
      failures: failures.length,
      causes: failures,
    },
    reserveAvailable: false,
    basis: "Lançamentos relacionados",
    strategyVersion: 2,
  };
}
module.exports = { sameArtist, rankCandidates, releaseRecommendations };
