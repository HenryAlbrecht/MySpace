class GameArtSearchError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

const MAX_CANDIDATES = 50;

function createGameArtSearch({ steamgriddb, igdb }) {
  const clean = (value) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();

  function igdbImages(item, slot, presentation) {
    if (slot === "bubble") return [item.verticalImage, item.image];
    if (slot === "background")
      return [
        item.bannerImage,
        ...(item.artworks || []),
        ...(item.screenshots || []),
        item.horizontalImage,
      ];
    if (presentation === "pill")
      return [
        item.horizontalImage,
        item.bannerImage,
        ...(item.artworks || []),
        ...(item.screenshots || []),
      ];
    return [item.verticalImage, item.image, ...(item.localizedCoverImages || [])];
  }

  function validatedSearch(titleValue, slotValue, presentationValue) {
    const title = String(titleValue || "").trim();
    const slot = String(slotValue || "");
    const presentation = presentationValue === "pill" ? "pill" : "vertical";
    if (title.length < 2 || title.length > 120)
      throw new GameArtSearchError("Digite um título entre 2 e 120 caracteres.", 400);
    if (!["bubble", "image", "background"].includes(slot))
      throw new GameArtSearchError("Tipo de imagem inválido.", 400);
    if (!steamgriddb?.configured && !igdb?.configured)
      throw new GameArtSearchError(
        "Configure STEAMGRIDDB_API_KEY ou IGDB_CLIENT_ID e IGDB_CLIENT_SECRET no arquivo .env.",
        503,
      );
    return { title, slot, presentation };
  }

  async function searchOptions(titleValue, slotValue, presentationValue) {
    const { title, slot, presentation } = validatedSearch(
      titleValue,
      slotValue,
      presentationValue,
    );
    const canSearchBoth = steamgriddb?.configured && igdb?.configured;
    const perProviderLimit = canSearchBoth ? Math.ceil(MAX_CANDIDATES / 2) : MAX_CANDIDATES;
    const tasks = await Promise.all([
      steamgriddb?.configured
        ? Promise.resolve()
            .then(async () => ({
              source: "SteamGridDB",
              items: steamgriddb.findAll
                ? await steamgriddb.findAll(title, slot, presentation, MAX_CANDIDATES)
                : [await steamgriddb.find(title, slot, presentation)].filter(Boolean),
            }))
            .catch(() => ({ source: "SteamGridDB", items: [], failed: true }))
        : Promise.resolve({ source: "SteamGridDB", items: [] }),
      igdb?.configured
        ? Promise.resolve()
            .then(async () => {
              const result = await igdb.search(title);
              const items = (result?.items || [])
                .filter((item) => igdbImages(item, slot, presentation).some(Boolean))
                .sort((a, b) => {
                  const aTitle = clean(a.title),
                    bTitle = clean(b.title),
                    target = clean(title);
                  return (
                    (aTitle === target ? 0 : 1) - (bTitle === target ? 0 : 1) ||
                    (aTitle.startsWith(target) ? 0 : 1) -
                      (bTitle.startsWith(target) ? 0 : 1) ||
                    aTitle.length - bTitle.length
                  );
                });
              const candidates = [];
              for (const item of items) {
                for (const url of igdbImages(item, slot, presentation)) {
                  if (!url) continue;
                  candidates.push({ url, source: "IGDB", title: item.title || title });
                  if (candidates.length >= MAX_CANDIDATES) break;
                }
                if (candidates.length >= MAX_CANDIDATES) break;
              }
              return { source: "IGDB", items: candidates };
            })
            .catch(() => ({ source: "IGDB", items: [], failed: true }))
        : Promise.resolve({ source: "IGDB", items: [] }),
    ]);

    const [steam, igdbResults] = tasks;
    const distinct = (items) => {
      const seen = new Set();
      return items.filter((item) => {
        if (!item?.url || seen.has(item.url)) return false;
        seen.add(item.url);
        return true;
      });
    };
    const steamItems = distinct(steam.items || []);
    const igdbItems = distinct(igdbResults.items || []);
    const sources = [
      ...(steamgriddb?.configured ? [steam] : []),
      ...(igdb?.configured ? [igdbResults] : []),
    ];
    const prioritized = canSearchBoth
      ? [
          ...steamItems.slice(0, perProviderLimit),
          ...igdbItems.slice(0, perProviderLimit),
          ...steamItems.slice(perProviderLimit),
          ...igdbItems.slice(perProviderLimit),
        ]
      : [...steamItems, ...igdbItems];
    const items = distinct(prioritized).slice(0, MAX_CANDIDATES);

    if (!items.length && sources.some((source) => source.failed))
      throw new GameArtSearchError(
        "Não consegui buscar imagens no SteamGridDB ou IGDB. Confira a conexão e as credenciais do arquivo .env.",
        502,
      );
    if (!items.length)
      throw new GameArtSearchError("Nenhuma imagem compatível foi encontrada para esse jogo.", 404);

    return {
      items,
      emptySources: sources
        .filter((source) => !source.items?.length)
        .map((source) => source.source),
      failedSources: sources.filter((source) => source.failed).map((source) => source.source),
    };
  }

  return {
    async search(title, slot, presentation) {
      const result = await searchOptions(title, slot, presentation);
      return result.items[0];
    },
    searchOptions,
  };
}

module.exports = { createGameArtSearch, GameArtSearchError };
