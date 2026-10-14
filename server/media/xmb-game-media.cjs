class GameMediaSearchError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

const MAX_RESULTS = 50;

function createGameMediaSearch({ music, youtube, canDownload = () => false }) {
  function validate(titleValue, typeValue, queryValue) {
    const title = String(titleValue || "").trim();
    const type = String(typeValue || "");
    const query = String(queryValue || "").trim();
    if (title.length < 2 || title.length > 120)
      throw new GameMediaSearchError("Digite um título entre 2 e 120 caracteres.", 400);
    if (query && (query.length < 2 || query.length > 120))
      throw new GameMediaSearchError("Digite uma busca entre 2 e 120 caracteres.", 400);
    if (!["audio", "video"].includes(type))
      throw new GameMediaSearchError("Tipo de mídia inválido.", 400);
    if (type === "audio" && !music)
      throw new GameMediaSearchError("Busca de trilhas indisponível.", 503);
    if (type === "video" && !youtube)
      throw new GameMediaSearchError("Busca de vídeos do YouTube indisponível.", 503);
    return { title, type, query };
  }

  async function searchOptions(titleValue, typeValue, queryValue) {
    const { title, type, query } = validate(titleValue, typeValue, queryValue);
    if (type === "audio") {
      const result = await music.search(
        "music",
        query || title + " soundtrack",
        "ytmusic",
      );
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

    const result = await youtube.search(query || title, MAX_RESULTS);
    const items = (result?.items || [])
      .filter((item) => /^[\w-]{11}$/.test(item.id || ""))
      .slice(0, MAX_RESULTS)
      .map((item) => {
        const url = "https://www.youtube.com/watch?v=" + item.id;
        return {
          id: item.id,
          kind: "video",
          title: item.title || "Vídeo sem título",
          artist: item.channel || "",
          url,
          thumbnail: item.thumbnail || "https://i.ytimg.com/vi/" + item.id + "/hqdefault.jpg",
          source: "YouTube",
          downloadAllowed: canDownload(url),
        };
      });
    return { items, source: "YouTube" };
  }

  return { searchOptions };
}

module.exports = { createGameMediaSearch, GameMediaSearchError };
