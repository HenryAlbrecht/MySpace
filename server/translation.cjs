function createTranslationClient({ fetcher = fetch } = {}) {
  const cache = new Map();
  return {
    translate: async (text, source = "en") => {
      if (
        !text ||
        Buffer.byteLength(text, "utf8") > 500 ||
        !["en", "ja", "es", "fr", "de", "it"].includes(source)
      ) {
        const error = Error("Trecho ou idioma inválido.");
        error.status = 400;
        throw error;
      }
      const key = source + ":" + text;
      if (cache.has(key)) return cache.get(key);
      const response = await fetcher(
        "https://api.mymemory.translated.net/get?" +
          new URLSearchParams({ q: text, langpair: source + "|pt-BR" }),
        { signal: AbortSignal.timeout(10000) },
      );
      if (!response.ok) throw Error("Serviço de tradução indisponível.");
      const payload = await response.json();
      if (
        Number(payload.responseStatus) !== 200 ||
        payload.quotaFinished ||
        typeof payload.responseData?.translatedText !== "string"
      )
        throw Error("Não foi possível traduzir. O serviço pode ter atingido seu limite de uso.");
      const result = { text: payload.responseData.translatedText };
      if (cache.size >= 120) cache.delete(cache.keys().next().value);
      cache.set(key, result);
      return result;
    },
  };
}
module.exports = { createTranslationClient };
