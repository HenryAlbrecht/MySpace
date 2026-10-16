/* Discovery metadata and authorized stream handles. Playback/queue remain in SPACEAMP. */
window.createDesktopMusicLibrary = function ({ onChange, openFile, checkFile, closeFile, sourceUrl, artworkUrl, loadCache, saveCache } = {}) {
  const sources = new Map();
  let revision = 0;
  const fileNameOnly = (value) => typeof value === "string" ? value.split(/[\\/]/).pop().slice(0, 512) : "Sem título";
  function persist() {
    if (!saveCache) return;
    const snapshots = Object.create(null);
    for (const [id, source] of sources) {
      const rows = [...source.rows.values()].map((track) => ({
        file_id: track.id.slice("desktop:music:".length),
        file_name: fileNameOnly(track.fileName),
        format: track.format,
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration_seconds: track.duration,
      }));
      if (rows.length) snapshots[id] = rows;
    }
    try { saveCache(snapshots); } catch {}
  }
  function restore() {
    let snapshots = {};
    try { snapshots = loadCache?.() || {}; } catch {}
    if (!snapshots || typeof snapshots !== "object" || Array.isArray(snapshots)) return;
    for (const [id, tracks] of Object.entries(snapshots)) {
      if (!id || id.length > 128 || !Array.isArray(tracks)) continue;
      const rows = new Map();
      for (const track of tracks.slice(0, 1000)) {
        if (typeof track?.file_id !== "string" || track.file_id.length > 64 || !/^[0-9]+:[0-9]+:[0-9]+$/.test(track.file_id) || !["MP3", "FLAC"].includes(track.format)) continue;
        const fileName = fileNameOnly(track.file_name);
        const rowId = "desktop:music:" + track.file_id;
        rows.set(rowId, {
          id: rowId,
          fileName,
          title: typeof track.title === "string" ? track.title.slice(0, 512) : fileName,
          artist: typeof track.artist === "string" ? track.artist.slice(0, 512) : "",
          album: typeof track.album === "string" ? track.album.slice(0, 512) : "",
          duration: Number.isFinite(track.duration_seconds) && track.duration_seconds > 0 && track.duration_seconds <= 86400 ? track.duration_seconds : null,
          format: track.format,
          state: "unverified",
        });
      }
      if (rows.size) sources.set(id, { token: 0, rows, available: false, availability: "unverified" });
    }
  }
  restore();
  function grants(folders) {
    const allowed = new Set(folders.map((folder) => folder.id));
    let dirty = false;
    for (const id of sources.keys()) {
      if (!allowed.has(id)) { sources.delete(id); dirty = true; }
    }
    for (const folder of folders) {
      if (!sources.has(folder.id)) {
        sources.set(folder.id, { token: 0, rows: new Map(), available: false, availability: folder.state === "available" ? "unverified" : "unavailable" });
      }
      const source = sources.get(folder.id);
      if (folder.state !== "available" && (source.available || source.availability !== "unavailable")) {
        source.available = false;
        source.availability = "unavailable";
        dirty = true;
      }
    }
    if (dirty) persist();
    onChange?.();
  }
  function begin(id) {
    const source = sources.get(id);
    if (!source) return null;
    source.token = ++revision;
    return source.token;
  }
  function fail(id, token) {
    const source = sources.get(id);
    if (!source || source.token !== token) return;
    source.available = false;
    source.availability = "unavailable";
    persist();
    onChange?.();
  }
  function complete(id, token, report) {
    const source = sources.get(id);
    if (!source || token === null || source.token !== token) return;
    if (!["complete", "partial"].includes(report.state)) return fail(id, token);
    const isComplete = report.state === "complete" && !report.errors?.length && report.timed_out !== true;
    if (!isComplete) {
      for (const [key, row] of source.rows) {
        source.rows.set(key, { ...row, state: "unverified" });
      }
    } else {
      source.rows.clear();
    }
    for (const track of report.tracks || []) {
      if (!/^[0-9]+:[0-9]+:[0-9]+$/.test(track.file_id) || !["MP3", "FLAC"].includes(track.format)) continue;
      const key = "desktop:music:" + track.file_id;
      source.rows.set(key, {
        id: key,
        fileName: fileNameOnly(track.file_name),
        title: track.title || track.file_name || "Sem título",
        artist: track.artist || "",
        album: track.album || "",
        duration: Number.isFinite(track.duration_seconds) && track.duration_seconds > 0 ? track.duration_seconds : null,
        format: track.format,
        state: track.state === "invalid-or-limited" ? "invalid-or-limited" : "available",
      });
    }
    source.available = true;
    source.availability = "available";
    persist();
    onChange?.();
  }
  function unavailable() {
    for (const source of sources.values()) {
      source.available = false;
      source.availability = "unavailable";
    }
    onChange?.();
  }
  function tracks() {
    const result = new Map();
    const rank = { available: 4, "invalid-or-limited": 3, unverified: 2, missing: 1, unavailable: 0 };
    for (const source of sources.values()) {
      for (const [key, track] of source.rows) {
        const row = { ...track, state: source.available ? track.state : source.availability || "unavailable" };
        row.image = row.state === "available" && artworkUrl ? artworkUrl(key.slice("desktop:music:".length), source.token) : "";
        if (!result.has(key) || rank[row.state] > rank[result.get(key).state]) result.set(key, row);
      }
    }
    return [...result.values()];
  }
  const isTrack = (item) => /^desktop:music:[0-9]+:[0-9]+:[0-9]+$/.test(item?.id || "");
  function queueTrack(item) {
    const row = tracks().find((row) => row.id === item.id) || item;
    return { ...row, kind: "music", desktopMusic: true, album: row.image || "", albumTitle: row.albumTitle || row.album || "", trackDuration: row.duration, url: "", playbackSource: null };
  }
  async function open(id) {
    const track = tracks().find((row) => row.id === id);
    if (!track || track.state !== "available" || !openFile) throw Error("Arquivo local não disponível.");
    const token = await openFile(id.slice("desktop:music:".length));
    return { url: sourceUrl(token), check: () => checkFile(token), close: () => closeFile(token) };
  }
  return { grants, begin, complete, fail, unavailable, tracks, isTrack, queueTrack, open };
};
