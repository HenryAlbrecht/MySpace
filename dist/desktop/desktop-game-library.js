/* Transient projection of authorized Steam discovery into existing game rows. No storage. */
window.createDesktopGameLibrary = function ({ normalize, onChange }) {
  const sources = new Map();
  let sequence = 0;
  const steamId = (item) => {
    return [item.catalogId, item.metadataSources?.catalogId]
      .find((id) => typeof id === "string" && /^steam:[1-9]\d{0,9}$/.test(id)) || null;
  };
  function changed() { onChange?.(); }
  function grants(folders) {
    const allowed = new Set(folders.map((folder) => folder.id));
    let dirty = false;
    for (const id of sources.keys()) {
      if (!allowed.has(id)) { sources.delete(id); dirty = true; }
    }
    for (const folder of folders) {
      const source = sources.get(folder.id);
      if (!source) sources.set(folder.id, { token: 0, rows: [], available: folder.state === "available" });
      else if (source.available !== (folder.state === "available")) {
        if (folder.state !== "available") {
          source.available = false;
          dirty = true;
        }
      }
    }
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
      changed();
      return;
    }
    const rows = new Map(report.state === "limited" || report.errors?.length
      ? source.rows.map((row) => [row.catalogId, { ...row, localState: "unverified" }]) : []);
    for (const game of report.games || []) {
      const appid = Number(game.appid);
      if (!Number.isSafeInteger(appid) || appid <= 0 || appid > 4294967295 || !game.name) continue;
      const item = normalize("game", { items: [{ id: appid, name: game.name }] })[0];
      if (!item) continue;
      // Existing catalog identity/labels, without remote artwork or native filesystem paths.
      rows.set(item.catalogId, {
        ...item, id: "desktop:" + item.catalogId, image: "", imageFallback: "",
        verticalImage: "", horizontalImage: "", platform: "Steam", status: "planned",
        localState: game.state === "present" ? "present" : "missing",
      });
    }
    source.rows = [...rows.values()];
    source.available = true;
    changed();
  }
  function fail(id, token) {
    const source = sources.get(id);
    if (!source || source.token !== token) return;
    source.available = false;
    changed();
  }
  function merge(items) {
    const local = new Map();
    const rank = { present: 3, missing: 2, unverified: 1, unavailable: 0 };
    for (const source of sources.values()) {
      for (const row of source.rows) {
        const state = source.available ? row.localState : "unavailable";
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
      Object.defineProperty(row, "desktopLocal", { value: { state: discovered.state, only: false } });
      result.push(row);
      local.delete(id);
    }
    for (const { row: source, state } of local.values()) {
      if (seen.has(source.catalogId)) continue;
      const { localState, ...row } = source;
      Object.defineProperty(row, "desktopLocal", { value: { state, only: true } });
      result.push(row);
    }
    return result;
  }
  return { grants, begin, complete, fail, merge };
};
