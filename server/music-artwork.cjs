// Restricted image delivery for the music catalog's Google CDN artwork.
function createMusicArtwork({ fetcher = fetch } = {}) {
  const cache = new Map(),
    pending = new Map();
  return async (value) => {
    let url;
    try {
      url = new URL(value);
    } catch {}
    if (
      !url ||
      url.protocol !== "https:" ||
      !["lh3.googleusercontent.com", "yt3.googleusercontent.com"].includes(url.hostname) ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !/^\/[\w-]{10,512}(?:=[\w-]{1,160})?$/.test(url.pathname)
    ) {
      const e = Error("Artwork inválida.");
      e.status = 400;
      throw e;
    }
    const key = url.href,
      found = cache.get(key);
    if (found && Date.now() - found.at < 900000) return found;
    if (pending.has(key)) return pending.get(key);
    const task = (async () => {
      const r = await fetcher(key, {
        signal: AbortSignal.timeout(6000),
        redirect: "error",
        headers: { Accept: "image/jpeg,image/png,image/webp" },
      });
      const type = (r.headers.get("content-type") || "").split(";")[0];
      if (!r.ok || !["image/jpeg", "image/png", "image/webp"].includes(type))
        throw Error("Artwork indisponível.");
      if (Number(r.headers.get("content-length")) > 2097152)
        throw Error("Artwork excede o limite.");
      const parts = [];
      let size = 0;
      for await (const part of r.body) {
        size += part.length;
        if (size > 2097152) {
          await r.body.cancel?.().catch(() => {});
          throw Error("Artwork excede o limite.");
        }
        parts.push(part);
      }
      const result = { body: Buffer.concat(parts), type, at: Date.now() };
      if (cache.size >= 24) cache.delete(cache.keys().next().value);
      cache.set(key, result);
      return result;
    })().finally(() => pending.delete(key));
    pending.set(key, task);
    return task;
  };
}
module.exports = { createMusicArtwork };
