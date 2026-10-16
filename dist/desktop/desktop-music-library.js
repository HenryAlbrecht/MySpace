/* Discovery metadata and authorized stream handles. Playback/queue remain in SPACEAMP. */
window.createDesktopMusicLibrary = function ({ onChange, openFile, checkFile, closeFile, sourceUrl, artworkUrl } = {}) {
  const sources = new Map();
  let revision = 0;
  function grants(folders) {
    const allowed = new Set(folders.map((folder) => folder.id));
    for (const id of sources.keys()) {
      if (!allowed.has(id)) sources.delete(id);
    }
    for (const folder of folders) {
      if (!sources.has(folder.id)) sources.set(folder.id, { token: 0, rows: new Map(), available: false });
      if (folder.state !== "available") sources.get(folder.id).available = false;
    }
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
    onChange?.();
  }
  function complete(id, token, report) {
    const source = sources.get(id);
    if (!source || token === null || source.token !== token) return;
    if (!["complete", "partial"].includes(report.state)) return fail(id, token);
    for (const [key, row] of source.rows) {
      source.rows.set(key, { ...row, state: report.state === "complete" ? "missing" : "unverified" });
    }
    for (const track of report.tracks || []) {
      if (!/^[0-9]+:[0-9]+:[0-9]+$/.test(track.file_id) || !["MP3", "FLAC"].includes(track.format)) continue;
      const key = "desktop:music:" + track.file_id;
      source.rows.set(key, {
        id: key,
        title: track.title || track.file_name || "Sem título",
        artist: track.artist || "",
        album: track.album || "",
        duration: Number.isFinite(track.duration_seconds) && track.duration_seconds > 0 ? track.duration_seconds : null,
        format: track.format,
        state: track.state === "invalid-or-limited" ? "invalid-or-limited" : "available",
      });
    }
    source.available = true;
    onChange?.();
  }
  function tracks() {
    const result = new Map();
    const rank = { available: 4, "invalid-or-limited": 3, unverified: 2, missing: 1, unavailable: 0 };
    for (const source of sources.values()) {
      for (const [key, track] of source.rows) {
        const row = { ...track, state: source.available ? track.state : "unavailable" };
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
    if (!isTrack({ id }) || !openFile) throw Error("Arquivo local não disponível.");
    const token = await openFile(id.slice("desktop:music:".length));
    return { url: sourceUrl(token), check: () => checkFile(token), close: () => closeFile(token) };
  }
  return { grants, begin, complete, fail, tracks, isTrack, queueTrack, open };
};
