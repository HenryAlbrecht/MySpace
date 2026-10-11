const BASE_URL = "https://www.steamgriddb.com/api/v2/";

function createSteamGridDbClient({ env = process.env, fetcher = fetch } = {}) {
  const apiKey = env.STEAMGRIDDB_API_KEY || "";
  const cache = new Map();

  async function request(path) {
    const cached = cache.get(path);
    if (cached && cached.expires > Date.now()) return cached.value;
    const response = await fetcher(new URL(path, BASE_URL), {
      headers: { Accept: "application/json", Authorization: "Bearer " + apiKey },
      signal: AbortSignal.timeout(8000),
    });
    if (response.status === 401 || response.status === 403)
      throw Object.assign(new Error("A chave do SteamGridDB é inválida."), { status: 503 });
    if (response.status === 429)
      throw Object.assign(new Error("SteamGridDB ocupado. Aguarde e tente novamente."), {
        status: 429,
      });
    if (!response.ok)
      throw Object.assign(new Error("Não consegui consultar o SteamGridDB agora."), {
        status: 502,
      });
    const result = await response.json();
    const value = Array.isArray(result?.data) ? result.data : [];
    if (cache.size >= 60) cache.delete(cache.keys().next().value);
    cache.set(path, { value, expires: Date.now() + 900000 });
    return value;
  }

  const clean = (value) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();

  function safeImageUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && /(^|\.)steamgriddb\.com$/i.test(url.hostname)
        ? url.href
        : "";
    } catch {
      return "";
    }
  }

  function sortAssets(assets, slot, presentation) {
    const ratioTarget =
      slot === "background"
        ? 16 / 9
        : slot === "bubble"
          ? 1
          : presentation === "pill"
            ? 920 / 430
            : 2 / 3;
    return assets
      .filter((asset) => safeImageUrl(asset.url))
      .sort((a, b) => {
        const ratio = (asset) =>
          Number(asset.width) > 0 && Number(asset.height) > 0
            ? Number(asset.width) / Number(asset.height)
            : ratioTarget;
        const distance = (asset) => Math.abs(Math.log(ratio(asset) / ratioTarget));
        const area = (asset) =>
          Math.max(0, Number(asset.width) || 0) * Math.max(0, Number(asset.height) || 0);
        const areaDifference = area(b) - area(a);
        if (slot === "background" && areaDifference) return areaDifference;
        return (
          distance(a) - distance(b) ||
          areaDifference ||
          Number(b.score || 0) - Number(a.score || 0)
        );
      });
  }

  return {
    configured: !!apiKey,
    async findAll(title, slot, presentation = "vertical", limit = 50) {
      if (!apiKey) return [];
      const games = await request("search/autocomplete/" + encodeURIComponent(title));
      const rankedGames = games
        .filter((game) => Number.isSafeInteger(game.id) && game.id > 0)
        .sort((a, b) => {
          const aName = clean(a.name),
            bName = clean(b.name),
            target = clean(title);
          return (
            (aName === target ? 0 : 1) - (bName === target ? 0 : 1) ||
            (aName.startsWith(target) ? 0 : 1) - (bName.startsWith(target) ? 0 : 1) ||
            aName.length - bName.length
          );
        });
      const endpoint =
        slot === "bubble" ? "icons" : slot === "background" ? "heroes" : "grids";
      const results = [];
      const seen = new Set();
      for (const game of rankedGames.slice(0, 5)) {
        const path = endpoint + "/game/" + game.id;
        const pillDimensions =
          slot === "image" && presentation === "pill" ? "?dimensions=920x430,460x215" : "";
        let assets = await request(path + pillDimensions);
        let sortedAssets = sortAssets(assets, slot, presentation);
        if (!sortedAssets.length && pillDimensions) {
          assets = await request(path);
          sortedAssets = sortAssets(assets, slot, presentation);
        }
        for (const asset of sortedAssets) {
          const url = safeImageUrl(asset.url);
          if (!url || seen.has(url)) continue;
          seen.add(url);
          results.push({
            url,
            source: "SteamGridDB",
            title: game.name || title,
            width: Number(asset.width) || null,
            height: Number(asset.height) || null,
          });
          if (results.length >= limit) return results;
        }
      }
      return results;
    },
    async find(title, slot, presentation = "vertical") {
      return (await this.findAll(title, slot, presentation, 1))[0] || null;
    },
  };
}

module.exports = { createSteamGridDbClient };
