(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.TranslationClient = api;
})(typeof globalThis === "object" ? globalThis : this, (root) => {
  function createTranslationClient({ fetcher = root.fetch, requester } = {}) {
    const cache = new Map();
    const pending = new Map();
    return {
      translate: async (text, source = "en") => {
        if (
          typeof text !== "string" ||
          !text ||
          new TextEncoder().encode(text).length > 500 ||
          !["en", "ja", "es", "fr", "de", "it"].includes(source)
        ) {
          const error = Error("Trecho ou idioma inválido.");
          error.status = 400;
          throw error;
        }
        const key = source + ":" + text;
        if (cache.has(key)) return cache.get(key);
        if (pending.has(key)) return pending.get(key);
        const task = (async () => {
        const response = requester ? null : await fetcher(
          "https://api.mymemory.translated.net/get?" +
            new URLSearchParams({ q: text, langpair: source + "|pt-BR" }),
          { signal: AbortSignal.timeout(10000) },
        );
        if (response && !response.ok) throw Error("Serviço de tradução indisponível.");
        const payload = requester ? await requester(text, source) : await response.json();
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
        })().finally(() => pending.delete(key));
        pending.set(key, task);
        return task;
      },
    };
  }
  return { createTranslationClient };

});
