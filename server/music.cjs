function createMusicClient({ fetcher = fetch } = {}) {
  const cache = new Map();
  function normalize(row, kind) {
    const album = kind === 'album';
    return { catalogId: 'itunes:' + (album ? row.collectionId : row.trackId), kind, source: 'iTunes', title: (album ? row.collectionName : row.trackName) || '', image: (row.artworkUrl100 || '').replace(/100x100bb/, '600x600bb'), url: row.collectionViewUrl || row.trackViewUrl || '', artist: row.artistName || '', description: [row.artistName, row.releaseDate?.slice(0,10)].filter(Boolean).join(' · '), genres: row.primaryGenreName ? [row.primaryGenreName] : [], summary: '', total: album ? row.trackCount || 0 : 0, unit: album ? 'faixas' : 'audições', trackDuration: row.trackTimeMillis ? Math.round(row.trackTimeMillis / 1000) : 0, previewUrl: row.previewUrl || '', releaseDate: row.releaseDate?.slice(0,10) || '' };
  }
  async function request(path, params) {
    const key = path + new URLSearchParams(params);
    if (cache.has(key)) return cache.get(key);
    const response = await fetcher('https://itunes.apple.com/' + path + '?' + new URLSearchParams({ country: 'BR', ...params }), { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw Error('Catálogo de música indisponível.');
    const payload = await response.json(); if (cache.size > 60) cache.clear(); cache.set(key, payload); return payload;
  }
  return {
    search: async (kind, term) => {
      if (!['music','album'].includes(kind) || String(term || '').trim().length < 2 || String(term).length > 120) { const error = Error('Busca de música inválida.'); error.status = 400; throw error; }
      const payload = await request('search', { term, media: 'music', entity: kind === 'album' ? 'album' : 'song', limit: 12 });
      return { items: (payload.results || []).map(row => normalize(row, kind)).filter(row => row.title) };
    },
    details: async (kind, id) => {
      if (!['music','album'].includes(kind) || !/^[1-9]\d{0,15}$/.test(id)) { const error = Error('Identificador de música inválido.'); error.status = 400; throw error; }
      const payload = await request('lookup', { id, ...(kind === 'album' ? { entity: 'song' } : {}) });
      const row = payload.results?.find(row => String(kind === 'album' ? row.collectionId : row.trackId) === id && (kind !== 'album' || row.wrapperType === 'collection'));
      if (!row) { const error = Error('Título musical não encontrado.'); error.status = 404; throw error; }
      const result = normalize(row, kind);
      result.trackNames = kind === 'album' ? payload.results.filter(row => row.kind === 'song').map(row => row.trackName || '') : [];
      return result;
    }
  };
}
module.exports = { createMusicClient };
