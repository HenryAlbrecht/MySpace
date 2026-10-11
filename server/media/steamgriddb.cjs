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

  function selectAsset(assets, slot, presentation) {
    const ratioTarget = slot === "image" && presentation !== "pill" ? 2 / 3 : 2.14;
    return assets
      .filter((asset) => safeImageUrl(asset.url))
      .sort((a, b) => {
        const ratio = (asset) =>
          Number(asset.width) > 0 && Number(asset.height) > 0
            ? Number(asset.width) / Number(asset.height)
            : ratioTarget;
        const distance = (asset) => Math.abs(Math.log(ratio(asset) / ratioTarget));
        return distance(a) - distance(b) || Number(b.score || 0) - Number(a.score || 0);
      })[0];
  }

  return {
    configured: !!apiKey,
    async find(title, slot, presentation = "vertical") {
      if (!apiKey) return null;
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
      for (const game of rankedGames.slice(0, 5)) {
        const assets = await request(endpoint + "/game/" + game.id);
        const asset = selectAsset(assets, slot, presentation);
        if (asset)
          return { url: safeImageUrl(asset.url), source: "SteamGridDB", title: game.name || title };
      }
      return null;
    },
  };
}

module.exports = { createSteamGridDbClient };
