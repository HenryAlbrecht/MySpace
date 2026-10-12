class GameMediaSearchError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

const MAX_RESULTS = 50;

function createGameMediaSearch({ music, igdb, canDownload = () => false }) {
  function validate(titleValue, typeValue) {
    const title = String(titleValue || "").trim();
    const type = String(typeValue || "");
    if (title.length < 2 || title.length > 120)
      throw new GameMediaSearchError("Digite um título entre 2 e 120 caracteres.", 400);
    if (!["audio", "video"].includes(type))
      throw new GameMediaSearchError("Tipo de mídia inválido.", 400);
    if (type === "audio" && !music)
      throw new GameMediaSearchError("Busca de trilhas indisponível.", 503);
    if (type === "video" && !igdb?.configured)
      throw new GameMediaSearchError("Configure o IGDB para buscar trailers de jogos.", 503);
    return { title, type };
  }

  async function searchOptions(titleValue, typeValue) {
    const { title, type } = validate(titleValue, typeValue);
    if (type === "audio") {
      const result = await music.search("music", title + " soundtrack", "ytmusic");
      const items = (result?.items || [])
        .filter((item) => /^[\w-]{11}$/.test(item.videoId || ""))
        .slice(0, MAX_RESULTS)
        .map((item) => ({
          id: item.videoId,
          kind: "audio",
          title: item.title || "Faixa sem título",
          artist: item.artist || "",
          url: "https://music.youtube.com/watch?v=" + item.videoId,
          thumbnail: item.image || "",
          source: "YouTube Music",
          downloadAllowed: canDownload("https://music.youtube.com/watch?v=" + item.videoId),
        }));
      return { items, source: "YouTube Music" };
    }

    const result = await igdb.searchVideos(title);
    const items = [];
    const seen = new Set();
    for (const game of result?.items || []) {
      for (let index = 0; index < game.videoIds.length; index++) {
        const id = game.videoIds[index];
        if (seen.has(id)) continue;
        seen.add(id);
        const url = "https://www.youtube.com/watch?v=" + id;
        items.push({
          id,
          kind: "video",
          title: game.videoTitles[index] || "Trailer",
          gameTitle: game.title || title,
          url,
          thumbnail: "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg",
          source: "IGDB · YouTube",
          downloadAllowed: canDownload(url),
        });
        if (items.length >= MAX_RESULTS) break;
      }
      if (items.length >= MAX_RESULTS) break;
    }
    return { items, source: "IGDB" };
  }

  return { searchOptions };
}

module.exports = { createGameMediaSearch, GameMediaSearchError };
