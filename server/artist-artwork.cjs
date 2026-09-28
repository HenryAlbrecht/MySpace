// The public Last.fm page still provides artist photos omitted by its API.
function createArtistArtworkClient({ fetcher = fetch } = {}) {
  const cache = new Map(), pending = new Map();
  async function lookup(name) {
    if (typeof name !== 'string' || !name.trim() || name.length > 200) return '';
    const found = cache.get(name);
    if (found && found.expires > Date.now()) return found.image;
    if (pending.has(name)) return pending.get(name);
    const task = (async () => {
      let image = '';
      try {
        const response = await fetcher('https://www.last.fm/music/' + encodeURIComponent(name), { signal: AbortSignal.timeout(6000), headers: { Accept: 'text/html' } });
        if (!response.ok) throw Error('Photo unavailable');
        const html = (await response.text()).slice(0, 1000000);
        for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
          if (!/\bproperty\s*=\s*["']og:image["']/i.test(tag)) continue;
          const value = tag.match(/\bcontent\s*=\s*["']([^"']+)["']/i)?.[1]?.replaceAll('&amp;', '&');
          if (!value) continue;
          const url = new URL(value);
          if (url.protocol === 'https:' && url.hostname === 'lastfm-img.freetls.fastly.net' && !['2a96cbd8b46e442fc41c2b86b821562f','753c0e5b1b3e0c92deaed5f9a7d36552'].some(hash => url.pathname.includes(hash))) image = url.href;
          break;
        }
      } catch { /* Missing photos never prevent artist navigation. */ }
      if (!image) {
        try {
          const response = await fetcher('https://api.deezer.com/search/artist?' + new URLSearchParams({ q: name, limit: 5 }), { signal: AbortSignal.timeout(6000) });
          if (response.ok) {
            const payload = await response.json();
            const clean = text => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
            const artist = payload.data?.find(row => clean(row.name) === clean(name));
            if (artist?.picture_big) {
              const url = new URL(artist.picture_big);
              if (url.protocol === 'https:' && (url.hostname === 'dzcdn.net' || url.hostname.endsWith('.dzcdn.net'))) image = url.href;
            }
          }
        } catch { /* Leave an honest placeholder when both sources lack a photo. */ }
      }
      if (cache.size >= 100) cache.delete(cache.keys().next().value);
      cache.set(name, { image, expires: Date.now() + (image ? 3600000 : 60000) });
      return image;
    })().finally(() => pending.delete(name));
    pending.set(name, task); return task;
  }
  return { lookup };
}
module.exports = { createArtistArtworkClient };
