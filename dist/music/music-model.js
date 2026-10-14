/* Library references are metadata, never inferred playback. */
(function (root) {
  function url(value) {
    try {
      const u = new URL(value);
      return ["https:", "http:"].includes(u.protocol) &&
        !u.username &&
        !u.password &&
        u.href.length <= 2048
        ? u.href
        : "";
    } catch {
      return "";
    }
  }
  function source(value) {
    if (value == null) return null;
    if (typeof value !== "object" || Array.isArray(value))
      throw Error("Fonte de reprodução inválida.");
    if (
      value.type === "local" &&
      typeof value.fileRef === "string" &&
      /^[\w-]{1,128}$/.test(value.fileRef)
    )
      return { type: "local", fileRef: value.fileRef };
    if (value.type === "youtube") {
      const link = url(
        value.url || (value.videoId ? "https://www.youtube.com/watch?v=" + value.videoId : ""),
      );
      if (link) {
        const u = new URL(link),
          host = u.hostname.replace(/^www\./, ""),
          id =
            host === "youtu.be"
              ? u.pathname.slice(1)
              : ["youtube.com", "music.youtube.com", "m.youtube.com"].includes(host)
                ? u.searchParams.get("v") || u.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1]
                : "";
        if (/^[\w-]{11}$/.test(id || "")) return { type: "youtube", url: link, videoId: id };
      }
    }
    if (value.type === "audio" && url(value.url)) return { type: "audio", url: url(value.url) };
    throw Error("Use um vídeo YouTube/YouTube Music ou arquivo local válido.");
  }
  function references(item) {
    const input = item.metadataSources || {},
      result = {};
    for (const key of [
      "lastfmUrl",
      "catalogId",
      "artistCatalogId",
      "albumCatalogId",
    ]) {
      const value = input[key] ?? item[key];
      if (typeof value === "string" && value.length <= 2048)
        result[key] = key.endsWith("Url") ? url(value) : value;
    }
    if (/^[\w-]{11}$/.test(input.youtubeMusicId || ""))
      result.youtubeMusicId = input.youtubeMusicId;
    const link = url(item.url);
    if (link) {
      const host = new URL(link).hostname.replace(/^www\./, "");
      if (host === "last.fm") result.lastfmUrl = link;
    }
    return result;
  }
  function recordingIsrc(item) {
    const value = String(item.isrc || item.metadataSources?.isrc || "")
      .trim()
      .toUpperCase()
      .replace(/[-\s]/g, "");
    return /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(value) ? value : "";
  }
  function library(item) {
    return {
      ...item,
      isrc: recordingIsrc(item),
      metadataSources: references(item),
      playbackSource: source(item.playbackSource),
    };
  }
  function queueTrack(item) {
    const s = source(item.playbackSource);
    if (!s) throw Error("Vincule uma fonte de reprodução antes de tocar.");
    return {
      id: String(item.id || item.catalogId || s.fileRef || s.videoId || ""),
      title: item.title,
      artist: item.artist || "",
      album: item.image || item.artwork || "",
      albumTitle: item.albumTitle || "",
      catalogId: item.catalogId || "",
      trackDuration: item.trackDuration,
      isrc: recordingIsrc(item),
      isrcSource: item.isrcSource || "",
      isrcLookupVersion: item.isrcLookupVersion,
      metadataSources: references(item),
      playbackSource: s,
      collectionId: item.id || "",
      url: s.type === "local" ? "" : s.url,
      local: s.type === "local",
      fileRef: s.fileRef || "",
    };
  }
  function sameItem(a, b) {
    return (
      a.kind === b.kind &&
      !!((a.id && a.id === b.id) || (a.catalogId && a.catalogId === b.catalogId))
    );
  }
  function validCatalogId(kind, id) {
    return (
      ["music", "album", "artist"].includes(kind) &&
      (kind === "music"
        ? /^ytmusic:video:[\w-]{11}$/
        : kind === "album"
          ? /^ytmusic:album:MPRE[\w-]{4,120}$/
          : /^ytmusic:artist:UC[\w-]{8,80}$/
      ).test(id || "")
    );
  }
  const recordingKey = (value) =>
    String(value || "")
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  function recordingMatch(a, b) {
    if (a.kind !== "music" || b.kind !== "music") return 0;
    let sa, sb;
    try {
      sa = source(a.playbackSource);
      sb = source(b.playbackSource);
    } catch {
      return 0;
    }
    if (
      sa &&
      sb &&
      sa.type === sb.type &&
      (sa.type === "youtube"
        ? sa.videoId === sb.videoId
        : sa.type === "local"
          ? sa.fileRef === sb.fileRef
          : sa.url === sb.url)
    )
      return 3;
    const variants = (value) =>
      [
        "live",
        "remix",
        "acoustic",
        "unplugged",
        "demo",
        "instrumental",
        "karaoke",
        "sped up",
        "slowed",
        "nightcore",
        "remaster",
        "radio edit",
        "extended",
        "cover",
      ]
        .filter((marker) =>
          new RegExp("(?:^| )" + marker + "(?: |$)").test(
            recordingKey(value.title + " " + (value.albumTitle || "")).replace(
              /remastered/g,
              "remaster",
            ),
          ),
        )
        .join("|");
    if (variants(a) !== variants(b)) return 0;
    const ia = recordingIsrc(a),
      ib = recordingIsrc(b);
    if (ia && ib) return ia === ib ? 2 : 0;
    if (
      !recordingKey(a.title) ||
      recordingKey(a.title) !== recordingKey(b.title) ||
      !recordingKey(a.artist) ||
      recordingKey(a.artist) !== recordingKey(b.artist)
    )
      return 0;
    const da = a.trackDuration,
      db = b.trackDuration;
    return Number.isFinite(da) &&
      da > 0 &&
      Number.isFinite(db) &&
      db > 0 &&
      Math.abs(da - db) <= 3 &&
      !!recordingKey(a.albumTitle) &&
      recordingKey(a.albumTitle) === recordingKey(b.albumTitle)
      ? 1
      : 0;
  }
  function findRecording(items, item) {
    const provider = (id) => String(id || "").split(":")[0];
    const ranked = items
      .filter(
        (row) =>
          row.catalogId !== item.catalogId &&
          (provider(row.catalogId) !== provider(item.catalogId) || sameReleaseTrack(row, item)),
      )
      .map((row) => ({ row, rank: recordingMatch(row, item) }));
    for (const rank of [3, 2, 1]) {
      const matches = ranked.filter((result) => result.rank === rank);
      if (matches.length) return matches.length === 1 ? matches[0].row : null;
    }
    return null;
  }
  function sameReleaseTrack(a, b) {
    return a.kind === "music" && b.kind === "music" &&
      !!a.albumCatalogId && a.albumCatalogId === b.albumCatalogId &&
      !!recordingKey(a.title) && recordingKey(a.title) === recordingKey(b.title) &&
      !!recordingKey(a.artist) && recordingKey(a.artist) === recordingKey(b.artist) &&
      Number.isFinite(a.trackDuration) && Number.isFinite(b.trackDuration) &&
      Math.abs(a.trackDuration - b.trackDuration) <= 3 &&
      !(a.trackNumber && b.trackNumber && a.trackNumber !== b.trackNumber) &&
      recordingMatch(a, b) > 0;
  }
  function findAlbumTrack(album, item) {
    const tracks = album.albumTracks || [];
    const exact = tracks.find((track) => sameItem(track, item));
    if (exact) return exact;
    const matches = tracks.filter((track) => sameReleaseTrack(track, item));
    return matches.length === 1 ? matches[0] : null;
  }
  function sameWork(a, b) {
    const key = (v) =>
      String(v || "")
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim();
    return (
      sameItem(a, b) ||
      (a.kind === b.kind &&
        ["music", "album", "artist"].includes(a.kind) &&
        !!key(a.title) &&
        key(a.title) === key(b.title) &&
        (a.kind === "artist" || (!!key(a.artist) && key(a.artist) === key(b.artist))))
    );
  }

  root.MusicModel = {
    url,
    source,
    references,
    library,
    queueTrack,
    sameItem,
    sameWork,
    validCatalogId,
    recordingMatch,
    findRecording,
    sameReleaseTrack,
    findAlbumTrack,
  };
  if (typeof module !== "undefined") module.exports = root.MusicModel;
})(globalThis);
