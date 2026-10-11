class GameArtSearchError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

function createGameArtSearch({ steamgriddb, igdb }) {
  const clean = (value) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();

  function igdbImage(item, slot, presentation) {
    if (slot === "bubble") return item.verticalImage || item.image || "";
    if (slot === "background")
      return item.bannerImage || item.artworks?.[0] || item.screenshots?.[0] || "";
    return presentation === "pill"
      ? item.horizontalImage || item.bannerImage || item.image || ""
      : item.verticalImage || item.image || "";
  }

  return {
    async search(titleValue, slotValue, presentationValue) {
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

      let providerFailed = false;
      if (steamgriddb?.configured) {
        try {
          const result = await steamgriddb.find(title, slot, presentation);
          if (result) return result;
        } catch {
          providerFailed = true;
        }
      }

      if (igdb?.configured) {
        try {
          const result = await igdb.search(title);
          const items = result?.items || [];
          const ranked = items
            .filter((item) => igdbImage(item, slot, presentation))
            .sort((a, b) => {
              const aTitle = clean(a.title),
                bTitle = clean(b.title),
                target = clean(title);
              return (
                (aTitle === target ? 0 : 1) - (bTitle === target ? 0 : 1) ||
                (aTitle.startsWith(target) ? 0 : 1) - (bTitle.startsWith(target) ? 0 : 1) ||
                aTitle.length - bTitle.length
              );
            });
          const item = ranked[0];
          const url = item && igdbImage(item, slot, presentation);
          if (url) return { url, source: "IGDB", title: item.title || title };
        } catch {
          providerFailed = true;
        }
      }

      if (providerFailed)
        throw new GameArtSearchError(
          "Não consegui buscar imagens no SteamGridDB ou IGDB. Confira a conexão e as credenciais do arquivo .env.",
          502,
        );
      throw new GameArtSearchError("Nenhuma imagem compatível foi encontrada para esse jogo.", 404);
    },
  };
}

module.exports = { createGameArtSearch };
