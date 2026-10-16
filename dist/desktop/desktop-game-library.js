/* Steam discovery projection for existing game rows; cache is catalog metadata only. */
window.createDesktopGameLibrary = function ({ normalize, onChange, launchSteam, artworkUrl, loadCache, saveCache }) {
  const sources = new Map();
  let sequence = 0;
  let artworkRevision = 0;
  let artworkSignature = "";
  let pendingLaunch = null;
  const steamId = (item) => {
    return [item.catalogId, item.metadataSources?.catalogId]
      .find((id) => typeof id === "string" && /^steam:[1-9]\d{0,9}$/.test(id)) || null;
  };
  function artworkGrants(folders) {
    const signature = JSON.stringify(folders.map(({ id, state }) => ({ id, state })));
    if (signature === artworkSignature) return;
    artworkSignature = signature;
    artworkRevision++;
    changed();
  }
  function refreshArtwork() {
    artworkRevision++;
    changed();
  }
  function localCover(id, kind = "cover") {
    return artworkUrl ? artworkUrl(id.slice(6), sequence + artworkRevision, kind) : "";
  }
  function projectGame(game, cached = false) {
    const appid = Number(game?.appid);
    if (!Number.isSafeInteger(appid) || appid <= 0 || appid > 4294967295 || typeof game.name !== "string" || !game.name.trim()) return null;
    const item = normalize("game", { items: [{ id: appid, name: game.name }] })[0];
    if (!item) return null;
    return {
      ...item, id: "desktop:" + item.catalogId, image: "", imageFallback: "",
      verticalImage: "", horizontalImage: "", platform: "Steam", status: "planned",
      localState: cached
        ? (["present", "missing", "unverified"].includes(game.state) ? game.state : "unverified")
        : game.state === "present" ? "present" : "missing",
    };
  }
  function persist() {
    if (!saveCache) return;
    const snapshots = Object.create(null);
    for (const [id, source] of sources) {
      const rows = source.rows.flatMap((row) => {
        const appid = row.catalogId?.match(/^steam:([1-9]\d{0,9})$/)?.[1];
        return appid ? [{ appid, name: row.title || row.name, state: row.localState }] : [];
      });
      if (rows.length) snapshots[id] = rows;
    }
    try { saveCache(snapshots); } catch {}
  }
  function restore() {
    let snapshots = {};
    try { snapshots = loadCache?.() || {}; } catch {}
    if (!snapshots || typeof snapshots !== "object" || Array.isArray(snapshots)) return;
    for (const [id, games] of Object.entries(snapshots)) {
      if (!id || id.length > 128 || !Array.isArray(games)) continue;
      const rows = games.slice(0, 10000).map((game) => projectGame(game, true)).filter(Boolean);
      if (rows.length) sources.set(id, { token: 0, rows, available: false, availability: "unverified" });
    }
  }
  restore();
  function changed() { onChange?.(); }
  function grants(folders) {
    const allowed = new Set(folders.map((folder) => folder.id));
    let dirty = false;
    for (const id of sources.keys()) {
      if (!allowed.has(id)) { sources.delete(id); dirty = true; }
    }
    for (const folder of folders) {
      const source = sources.get(folder.id);
      if (!source) {
        sources.set(folder.id, { token: 0, rows: [], available: false, availability: folder.state === "available" ? "unverified" : "unavailable" });
      } else if (folder.state !== "available" && (source.available || source.availability !== "unavailable")) {
        source.available = false;
        source.availability = "unavailable";
        dirty = true;
      }
    }
    if (dirty) persist();
    if (dirty) changed();
  }
  function begin(id) {
    const source = sources.get(id);
    if (!source) return null;
    source.token = ++sequence;
    return source.token;
  }
  function complete(id, token, report) {
    const source = sources.get(id);
    if (!source || source.token !== token || token === null) return;
    if (!["complete", "limited"].includes(report.state)) {
      source.available = false;
      source.availability = "unavailable";
      persist();
      changed();
      return;
    }
    const rows = new Map(report.state === "limited" || report.errors?.length
      ? source.rows.map((row) => [row.catalogId, { ...row, localState: "unverified" }]) : []);
    for (const game of report.games || []) {
      const item = projectGame(game);
      if (!item) continue;
      // Existing catalog identity/labels, without remote artwork or native filesystem paths.
      rows.set(item.catalogId, item);
    }
    source.rows = [...rows.values()];
    source.available = true;
    source.availability = "available";
    persist();
    changed();
  }
  function fail(id, token) {
    const source = sources.get(id);
    if (!source || source.token !== token) return;
    source.available = false;
    source.availability = "unavailable";
    persist();
    changed();
  }
  function unavailable() {
    for (const source of sources.values()) {
      source.available = false;
      source.availability = "unavailable";
    }
    changed();
  }
  function merge(items) {
    const local = new Map();
    const rank = { present: 3, missing: 2, unverified: 1, unavailable: 0 };
    for (const source of sources.values()) {
      for (const row of source.rows) {
        const state = source.available ? row.localState : source.availability || "unavailable";
        const prior = local.get(row.catalogId);
        if (!prior || rank[state] > rank[prior.state]) local.set(row.catalogId, { row, state });
      }
    }
    const result = [];
    const seen = new Set();
    for (const item of items) {
      const id = item.kind === "game" ? steamId(item) : null;
      if (id && seen.has(id)) continue;
      if (id) seen.add(id);
      const discovered = id && local.get(id);
      if (!discovered) { result.push(item); continue; }
      const row = { ...item };
      if (!item.image && !item.xmbArt?.image) row.image = localCover(id);
      Object.defineProperty(row, "desktopLocal", { value: { state: discovered.state, only: false, personalImage: item.image || "", vertical: localCover(id, "vertical"), background: localCover(id, "background") } });
      result.push(row);
      local.delete(id);
    }
    for (const { row: source, state } of local.values()) {
      if (seen.has(source.catalogId)) continue;
      const { localState, ...row } = source;
      row.image = localCover(row.catalogId);
      Object.defineProperty(row, "desktopLocal", { value: { state, only: true, vertical: localCover(row.catalogId, "vertical"), background: localCover(row.catalogId, "background") } });
      result.push(row);
    }
    return result;
  }
  function canLaunch(item) {
    const id = steamId(item);
    return !!launchSteam && !!id && [...sources.values()].some((source) =>
      source.available && source.rows.some((row) => row.catalogId === id && row.localState === "present"),
    );
  }
  async function launch(item) {
    if (pendingLaunch) throw Error("Aguarde o pedido de inicialização em andamento.");
    if (!canLaunch(item)) throw Error("Instalação Steam indisponível. Atualize a descoberta no Desktop.");
    const id = steamId(item);
    pendingLaunch = id;
    try {
      return await launchSteam(id.slice("steam:".length));
    } finally {
      pendingLaunch = null;
    }
  }
  return { grants, begin, complete, fail, unavailable, merge, canLaunch, launch, artworkGrants, refreshArtwork };
};
