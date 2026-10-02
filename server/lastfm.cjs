const array = value => Array.isArray(value) ? value : value ? [value] : [];
function createLastfmClient({ env = process.env, fetcher = fetch, interval = 300 } = {}) {
  const apiKey = env.LASTFM_API_KEY || ''; const cache = new Map(), pending = new Map(); let queue = Promise.resolve(), nextRequest = 0;
  function validate(kind, artist, title = '') {
    if (!['music','album'].includes(kind) || typeof artist !== 'string' || !artist.trim() || artist.length > 200 || typeof title !== 'string' || title.length > 200) { const error = Error('Consulta musical inválida.'); error.status = 400; throw error; }
  }
  function normalize(row, kind) {
    const artist = typeof row.artist === 'string' ? row.artist : row.artist?.name || '';
    const title = row.name || '';
    const images = array(row.image).map(image => image['#text']).filter(url => typeof url === 'string' && url.startsWith('https://') && !['2a96cbd8b46e442fc41c2b86b821562f','753c0e5b1b3e0c92deaed5f9a7d36552'].some(hash => url.includes(hash)));
    return { kind, catalogId: 'lastfm:' + encodeURIComponent(artist) + ':' + encodeURIComponent(title), source: 'Last.fm', artist, title, image: images.at(-1) || '', url: 'https://www.last.fm/music/' + encodeURIComponent(artist) + (kind === 'music' ? '/_/' : '/') + encodeURIComponent(title), description: artist, summary: row.wiki?.content || row.wiki?.summary || '', genres: array(row.tags?.tag || row.toptags?.tag).map(tag => tag.name).filter(Boolean), total: 0, unit: kind === 'album' ? 'faixas' : 'audições', trackDuration: kind === 'music' && Number(row.duration) > 0 ? Math.round(Number(row.duration) / 1000) : 0, listeners: String(row.listeners || ''), playcount: String(row.playcount || ''), previewUrl: '', releaseDate: '' };
  }
  function artistRow(row) {
    const result = normalize({ ...row, artist: row.name }, 'artist');
    return { ...result, catalogId: 'lastfm-artist:' + encodeURIComponent(row.name), url: 'https://www.last.fm/music/' + encodeURIComponent(row.name), summary: row.bio?.content || row.bio?.summary || '', listeners: String(row.stats?.listeners || ''), playcount: String(row.stats?.playcount || ''), unit: 'audições' };
  }
  async function request(method, params) {
    if (!apiKey) { const error = Error('Last.fm não configurado. Preencha LASTFM_API_KEY no .env e reinicie o servidor.'); error.status = 503; throw error; }
    const key = method + ':' + new URLSearchParams(params); const found = cache.get(key);
    if (found && found.expires > Date.now()) return found.value;
    if (pending.has(key)) return pending.get(key);
    const task = queue.catch(() => {}).then(async () => {
      const delay = Math.max(0, nextRequest - Date.now()); if (delay) await new Promise(resolve => setTimeout(resolve, delay)); nextRequest = Date.now() + interval;
      let response;
      try { response = await fetcher('https://ws.audioscrobbler.com/2.0/?' + new URLSearchParams({ method, ...params, api_key: apiKey, format: 'json' }), { signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json' } }); }
      catch { throw Error('Não consegui conectar ao Last.fm agora.'); }
      if (!response.ok) throw Error('Last.fm indisponível agora.');
      const payload = await response.json();
      if (payload.error) {
        const error = Error([10,26].includes(Number(payload.error)) ? 'A chave Last.fm não foi aceita. Confira LASTFM_API_KEY no .env.' : Number(payload.error) === 29 ? 'Last.fm limitou as consultas. Aguarde um pouco.' : 'O Last.fm não disponibilizou esses dados.');
        error.status = [10,26].includes(Number(payload.error)) ? 503 : Number(payload.error) === 29 ? 429 : 502; throw error;
      }
      if (cache.size >= 100) cache.delete(cache.keys().next().value); cache.set(key, { value: payload, expires: Date.now() + 3600000 }); return payload;
    }).finally(() => pending.delete(key)); pending.set(key, task); queue = task; return task;
  }
  return {
    summary: async (kind, artist, title = '') => {
      validate(kind === 'artist' ? 'music' : kind, artist, title);
      const entity = kind === 'artist' ? 'artist' : kind === 'album' ? 'album' : 'track';
      const payload = await request(entity + '.getInfo', { artist, ...(entity === 'artist' ? {} : {[entity]:title}), autocorrect: 0 });
      const row = payload[entity];
      return {summary: row?.bio?.content || row?.bio?.summary || row?.wiki?.content || row?.wiki?.summary || '', summarySource:'Last.fm'};
    },
    artistArtwork: async artist => {
      validate('music', artist);
      const payload = await request('artist.getInfo', { artist, autocorrect: 0 });
      return payload.artist ? artistRow(payload.artist).image : '';
    },
    search: async (kind, query) => {
      if (kind === 'artist') {
        validate('music', query);
        if (query.trim().length < 2 || query.length > 120) { const error = Error('Busca de artista inválida.'); error.status = 400; throw error; }
        const payload = await request('artist.search', { artist: query.trim(), limit: 12 });
        return { items: array(payload.results?.artistmatches?.artist).filter(row => row.name).map(artistRow) };
      }
      if (!['music','album'].includes(kind) || typeof query !== 'string' || query.trim().length < 2 || query.length > 120) { const error = Error('Busca musical inválida.'); error.status = 400; throw error; }
      const entity = kind === 'album' ? 'album' : 'track'; const payload = await request(entity + '.search', { [entity]: query.trim(), limit: 12 });
      return { items: array(payload.results?.[entity + 'matches']?.[entity]).map(row => normalize(row, kind)).filter(row => row.title && row.artist) };
    },
    details: async (kind, artist, title) => {
      if (kind === 'artist') {
        validate('music', artist);
        const payload = await request('artist.getInfo', { artist, autocorrect: 0 });
        if (!payload.artist) throw Error('Artista não encontrado.');
        const result = artistRow(payload.artist); result.catalogId = 'lastfm-artist:' + encodeURIComponent(artist);
        const albums = await request('artist.getTopAlbums', { artist, limit: 8 }).catch(() => ({}));
        const tracks = await request('artist.getTopTracks', { artist, limit: 8 }).catch(() => ({}));
        const similar = await request('artist.getSimilar', { artist, limit: 8 }).catch(() => ({}));
        result.topAlbums = array(albums.topalbums?.album).map(row => normalize({ ...row, artist: row.artist || artist }, 'album'));
        result.topTracks = array(tracks.toptracks?.track).map(row => normalize({ ...row, artist: row.artist || artist }, 'music'));
        result.similarArtists = array(similar.similarartists?.artist).filter(row => row.name).map(artistRow);
        return result;
      }
      validate(kind, artist, title); if (!title.trim()) { const error = Error('Título musical inválido.'); error.status = 400; throw error; }
      const entity = kind === 'album' ? 'album' : 'track'; const payload = await request(entity + '.getInfo', { artist, [entity]: title, autocorrect: 0 });
      if (!payload[entity]) throw Error('Título musical não encontrado.');
      const result = normalize(payload[entity], kind);
      // Preserve the requested identity; corrections do not create a second saved item.
      result.catalogId = 'lastfm:' + encodeURIComponent(artist) + ':' + encodeURIComponent(title);
      if (kind === 'album') { result.trackNames = array(payload.album.tracks?.track).map(track => track.name).filter(Boolean); result.total = result.trackNames.length; }
      if (!result.image && payload.track?.album?.image) result.image = normalize({ name: title, artist, image: payload.track.album.image }, kind).image;
      return result;
    },
    recommendations: async (kind, artist, title) => {
      if (kind === 'artist') {
        validate('music', artist);
        const payload = await request('artist.getSimilar', {artist, limit:24, autocorrect:0});
        return {items:array(payload.similarartists?.artist).filter(row=>row.name).map(artistRow),basis:'Artistas similares no Last.fm'};
      }
      validate(kind, artist, title);
      if (kind === 'music') { const payload = await request('track.getSimilar', { artist, track: title, limit: 24, autocorrect: 1 }); return { items: array(payload.similartracks?.track).map(row => normalize(row, 'music')), basis: 'Faixas similares no Last.fm' }; }
      const payload = await request('artist.getSimilar', { artist, limit: 4, autocorrect: 1 }); const items = [];
      for (const similar of array(payload.similarartists?.artist).slice(0, 4)) {
        try { const albums = await request('artist.getTopAlbums', { artist: similar.name, limit: 6 }); items.push(...array(albums.topalbums?.album).map(row => normalize(row, 'album'))); } catch {}
      }
      return { items, basis: 'Álbuns populares de artistas similares no Last.fm' };
    }
  };
}
module.exports = { createLastfmClient };
