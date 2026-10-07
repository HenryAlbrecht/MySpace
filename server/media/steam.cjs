const { parseStorePage } = require("./steam-page.cjs");
const STORE = "https://store.steampowered.com/api/";

class SteamError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

function createSteamClient({ fetcher = fetch, now = Date.now } = {}) {
  const cache = new Map();
  const pending = new Map();
  async function cached(key, load) {
    const found = cache.get(key);
    if (found && found.expires > now()) return found.value;
    if (pending.has(key)) return pending.get(key);
    const task = load()
      .then((value) => {
        if (cache.size >= 60) cache.delete(cache.keys().next().value);
        cache.set(key, { value, expires: now() + 15 * 60 * 1000 });
        return value;
      })
      .finally(() => pending.delete(key));
    pending.set(key, task);
    return task;
  }
  async function request(endpoint, params) {
    let response;
    try {
      response = await fetcher(STORE + endpoint + "?" + new URLSearchParams(params), {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new SteamError("Não consegui conectar à Steam. Tente novamente.");
    }
    if (response.status === 429)
      throw new SteamError(
        "A Steam limitou as consultas. Aguarde um pouco e tente novamente.",
        429,
      );
    if (!response.ok) throw new SteamError("A loja Steam está indisponível agora.");
    try {
      return await response.json();
    } catch {
      throw new SteamError("A Steam retornou uma resposta inválida.");
    }
  }
  async function search(query) {
    const term = String(query || "").trim();
    if (term.length < 2 || term.length > 120)
      throw new SteamError("Digite entre 2 e 120 caracteres.", 400);
    return cached("search:" + term.toLowerCase(), async () => {
      const payload = await request("storesearch/", { term, l: "brazilian", cc: "BR" });
      if (!Array.isArray(payload.items))
        throw new SteamError("A Steam retornou uma resposta inválida.");
      return {
        items: payload.items
          .filter((i) => i.type === "app" && Number.isSafeInteger(i.id) && i.id > 0)
          .slice(0, 12)
          .map((i) => ({
            id: i.id,
            name: i.name,
            tiny_image: i.tiny_image,
          })),
      };
    });
  }
  async function details(value) {
    const id = String(value || "");
    if (!/^[1-9]\d{0,9}$/.test(id)) throw new SteamError("Identificador de jogo inválido.", 400);
    return cached("game:" + id, async () => {
      const payload = await request("appdetails", { appids: id, l: "brazilian", cc: "BR" });
      // Confere o ID do aplicativo; não aceita informações de outro jogo.
      const row = Object.values(payload || {}).find(
        (i) => i?.success && String(i.data?.steam_appid) === id,
      );
      if (!row) throw new SteamError("Este título não está disponível na loja Steam.", 404);
      const data = row.data;
      let cover = data.header_image || "";
      const vertical =
        "https://cdn.akamai.steamstatic.com/steam/apps/" + id + "/library_600x900.jpg";
      try {
        const image = await fetcher(vertical, {
          method: "HEAD",
          signal: AbortSignal.timeout(2000),
        });
        if (image.ok && image.headers.get("content-type")?.startsWith("image/")) cover = vertical;
      } catch {
        /* A imagem oficial da loja continua disponível como alternativa. */
      }
      let banner = data.screenshots?.[0]?.path_full || data.header_image || "";
      const hero = "https://cdn.akamai.steamstatic.com/steam/apps/" + id + "/library_hero.jpg";
      try {
        const result = await fetcher(hero, { method: "HEAD", signal: AbortSignal.timeout(2000) });
        if (result.ok && result.headers.get("content-type")?.startsWith("image/")) banner = hero;
      } catch {
        /* Only landscape store assets are used as alternatives. */
      }
      let storeFields = { drm_notice: "", related_ids: [] };
      try {
        const page = await fetcher("https://store.steampowered.com/app/" + id + "/?l=english", {
          signal: AbortSignal.timeout(3500),
          headers: { Accept: "text/html" },
        });
        if (page.ok && typeof page.text === "function")
          storeFields = parseStorePage(await page.text(), id);
      } catch {
        /* Store HTML is optional; never infer DRM absence. */
      }
      return {
        ...storeFields,
        banner_image: banner,
        detailed_description: data.about_the_game || data.detailed_description || "",
        supported_languages: data.supported_languages || "",
        metacritic: data.metacritic || null,
        dlc: (data.dlc || []).filter(Number.isSafeInteger).slice(0, 100),
        package_names: (data.package_groups || [])
          .flatMap((group) => (group.subs || []).map((sub) => sub.option_text || group.title))
          .filter(Boolean)
          .slice(0, 30),
        screenshots: (data.screenshots || [])
          .slice(0, 10)
          .map((image) => image.path_full || image.path_thumbnail),
        categories: (data.categories || []).map((category) => category.description).filter(Boolean),
        pc_requirements: data.pc_requirements || {},
        website: data.website || "",
        steam_appid: data.steam_appid,
        name: data.name,
        short_description: data.short_description || "",
        cover_image: cover,
        vertical_image: cover === vertical ? vertical : "",
        horizontal_image: data.header_image || "",
        header_image: data.header_image || "",
        developers: data.developers || [],
        publishers: data.publishers || [],
        genres: data.genres || [],
        genre_ids: (data.genres || [])
          .map((genre) => String(genre.id || ""))
          .filter((id) => /^[1-9]\d*$/.test(id)),
        release_date: data.release_date || {},
        platforms: data.platforms || {},
      };
    });
  }
  async function recommendations(value) {
    const game = await details(value);
    return cached("recommendations:" + value, async () => {
      const params = {
        category1: "998",
        l: "brazilian",
        cc: "BR",
        ...(game.tag_ids?.[0] ? { tags: game.tag_ids[0] } : { genre: game.genre_ids?.[0] || "" }),
      };
      if (!params.tags && !params.genre && !game.related_ids?.length) return { items: [] };
      if (game.related_ids?.length) {
        const items = [];
        for (const id of game.related_ids.slice(0, 6)) {
          try {
            const row = await details(id);
            items.push({ id: row.steam_appid, name: row.name, tiny_image: row.header_image });
          } catch {}
        }
        return { items };
      }
      const response = await fetcher(
        "https://store.steampowered.com/search/?" + new URLSearchParams(params),
        { signal: AbortSignal.timeout(8000) },
      );
      if (!response.ok) throw new SteamError("Sugestões Steam indisponíveis.");
      const html = await response.text();
      const items = [];
      for (const match of html.matchAll(
        /<a\b([^>]*class="[^"]*search_result_row[^>]*")([^>]*)>([\s\S]*?)<\/a>/gi,
      )) {
        const attrs = match[1] + match[2];
        const id = attrs.match(/data-ds-appid="([1-9]\d{0,9})"/)?.[1];
        const name = match[3]
          .match(/<span[^>]*class="title"[^>]*>([\s\S]*?)<\/span>/)?.[1]
          ?.replace(/<[^>]*>/g, "")
          .trim();
        if (id && id !== String(value) && name && !items.some((row) => row.id === Number(id)))
          items.push({ id: Number(id), name, tiny_image: "" });
        if (items.length >= 12) break;
      }
      return { items };
    });
  }
  return { search, details, recommendations };
}

module.exports = { createSteamClient, SteamError };
