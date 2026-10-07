const MediaEmbeds = require("../../dist/media-embeds.js");
function createMediaClient({ fetchImpl = fetch } = {}) {
  const cache = new Map();
  async function metadata(value) {
    const embed = MediaEmbeds.parse(value);
    if (!embed) {
      const error = Error("Link de mídia inválido.");
      error.status = 400;
      throw error;
    }
    const cached = cache.get(embed.url);
    if (cached && cached.expires > Date.now()) return cached.data;
    const endpoint =
      embed.provider === "spotify"
        ? "https://open.spotify.com/oembed"
        : "https://www.youtube.com/oembed";
    const response = await fetchImpl(
      endpoint + "?format=json&url=" + encodeURIComponent(embed.url),
      {
        signal: AbortSignal.timeout(5000),
        redirect: "error",
        headers: { Accept: "application/json" },
      },
    );
    if (!response.ok) throw Error("Não foi possível ler as informações desse link.");
    const text = await response.text();
    if (text.length > 100000) throw Error("Resposta de mídia inválida.");
    const result = JSON.parse(text);
    const data = {
      title: typeof result.title === "string" ? result.title.slice(0, 300) : "",
      artist:
        embed.provider === "youtube" && typeof result.author_name === "string"
          ? result.author_name.slice(0, 200).replace(/ - Topic$/, "")
          : "",
      thumbnail:
        typeof result.thumbnail_url === "string" && /^https:\/\//.test(result.thumbnail_url)
          ? result.thumbnail_url
          : "",
      provider: embed.provider,
    };
    if (cache.size >= 100) cache.delete(cache.keys().next().value);
    cache.set(embed.url, { expires: Date.now() + 3600000, data });
    return data;
  }
  return { metadata };
}
module.exports = { createMediaClient };
