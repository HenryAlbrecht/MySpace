// Visual enrichment only: no Deezer catalog identities escape this adapter.
function createArtistArtworkClient({ fetcher = fetch } = {}) {
  const cache = new Map(),
    pending = new Map();
  const responses = new Map(),
    requests = new Map();
  async function request(path) {
    const cached = responses.get(path);
    if (cached?.expires > Date.now()) return cached.value;
    if (requests.has(path)) return requests.get(path);
    const task = (async () => {
      const response = await fetcher("https://api.deezer.com/" + path, { signal: AbortSignal.timeout(2500) });
      if (!response.ok) throw Error("Photo unavailable");
      const value = await response.json();
      if (value.error) throw Error("Photo unavailable");
      if (responses.size >= 100) responses.delete(responses.keys().next().value);
      responses.set(path, { value, expires: Date.now() + 60000 });
      return value;
    })().finally(() => requests.delete(path));
    requests.set(path, task);
    return task;
  }
  const exact = (v) =>
    String(v || "")
      .normalize("NFC")
      .trim()
      .toLowerCase()
      .replace(/\s*&\s*/g, " and ")
      .replace(/\s+/g, " ");
  const folded = (v) =>
    exact(v)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  async function lookup(name, { tracks = [], verify = false } = {}) {
    if (typeof name !== "string" || !name.trim() || name.length > 200) return "";
    const titleKey = (value) =>
      exact(value)
        .replace(/\s*\([^)]*(?:remaster|digital master)[^)]*\)/gi, "")
        .trim();
    const evidence = [
      ...new Set(tracks.map((row) => titleKey(typeof row === "string" ? row : row.title)).filter(Boolean)),
    ].sort();
    const nameKey = exact(name),
      key = JSON.stringify([nameKey, evidence, verify]),
      found = cache.get(key);
    if (found?.expires > Date.now()) return found.image;
    if (pending.has(key)) return pending.get(key);
    const task = (async () => {
      let image = "";
      try {
        const data =
          (await request("search/artist?" + new URLSearchParams({ q: name.trim(), limit: 24 }))).data || [];
        const exactMatches = data.filter((row) => exact(row.name) === nameKey);
        let matches = exactMatches.length
          ? exactMatches
          : data.filter((row) => folded(row.name) === folded(name));
        // A name alone cannot disambiguate two catalog artists.
        if (verify || new Set(matches.map((row) => row.id)).size > 1) {
          if (!evidence.length || matches.length > 4) matches = [];
          else {
            const scored = await Promise.all(
              matches.map(async (row) => {
                try {
                  const payload = await request("artist/" + row.id + "/top?limit=10");
                  const titles = new Set(
                    (payload.data || [])
                      .filter((track) => exact(track.artist?.name) === nameKey)
                      .map((track) => titleKey(track.title)),
                  );
                  return { row, score: evidence.filter((title) => titles.has(title)).length };
                } catch {
                  return null;
                }
              }),
            );
            // Every candidate must be checked; a failed lookup is not evidence of absence.
            const ranked = scored.filter(Boolean).sort((a, b) => b.score - a.score);
            matches =
              ranked.length === matches.length &&
              ranked[0]?.score >= 2 &&
              ranked[0].score > (ranked[1]?.score || 0)
                ? [ranked[0].row]
                : [];
          }
        }
        for (const row of matches) {
          const candidate = row.picture_xl || row.picture_big || row.picture_medium;
          if (!candidate) continue;
          const url = new URL(candidate);
          if (
            url.protocol === "https:" &&
            (url.hostname === "dzcdn.net" || url.hostname.endsWith(".dzcdn.net"))
          ) {
            image = url.href;
            break;
          }
        }
      } catch {
        /* Optional image failure never changes Apple identity. */
      }
      if (cache.size >= 100) cache.delete(cache.keys().next().value);
      cache.set(key, { image, expires: Date.now() + (image ? 3600000 : 60000) });
      return image;
    })().finally(() => pending.delete(key));
    pending.set(key, task);
    return task;
  }
  return { lookup };
}
module.exports = { createArtistArtworkClient };
