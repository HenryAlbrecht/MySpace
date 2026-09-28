function createDeezerClient({ fetcher = fetch } = {}) {
  const cache = new Map(), pending = new Map();
  const types = { music: 'track', album: 'album', artist: 'artist' };
  const https = value => { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; } };
  async function request(path) {
    const found = cache.get(path); if (found && found.expires > Date.now()) return found.value;
    if (pending.has(path)) return pending.get(path);
    const task = (async () => {
      const response = await fetcher('https://api.deezer.com/' + path, { signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json' } });
      if (!response.ok) throw Error('Deezer indisponível agora.');
      const value = await response.json(); if (value.error) throw Error('A Deezer não disponibilizou este título.');
      if (cache.size >= 100) cache.delete(cache.keys().next().value); cache.set(path, { value, expires: Date.now() + 900000 }); return value;
    })().finally(() => pending.delete(path)); pending.set(path, task); return task;
  }
  function normalize(row, kind) {
    const fallback = https(kind === 'artist' ? row.picture_medium || row.picture : row.cover_medium || row.album?.cover_medium || row.cover || row.album?.cover);
    return { kind, catalogId: 'deezer:' + row.id, source: 'Deezer', title: kind === 'artist' ? row.name : [row.title || '', row.title_version && !(row.title || '').includes(row.title_version) ? row.title_version : ''].filter(Boolean).join(' '), version: row.title_version || '', explicit: row.explicit_lyrics === true, artist: kind === 'artist' ? row.name : row.artist?.name || '', artistCatalogId: row.artist?.id ? 'deezer:' + row.artist.id : '', albumCatalogId: row.album?.id ? 'deezer:' + row.album.id : '', albumTitle: row.album?.title || '', albumType: row.record_type || '', image: https(kind === 'artist' ? row.picture_xl || row.picture_big : row.cover_xl || row.cover_big || row.album?.cover_xl || row.album?.cover_big) || fallback, imageFallback: fallback, url: https(row.link) || 'https://www.deezer.com/' + types[kind] + '/' + row.id, previewUrl: https(row.preview), previewSource: 'Deezer', description: kind === 'artist' ? 'Artista · Deezer' : row.artist?.name || '', summary: '', trackDuration: row.duration || 0, releaseDate: row.release_date || '', total: kind === 'album' ? row.nb_tracks || 0 : 0, unit: kind === 'album' ? 'faixas' : 'audições' };
  }
  function validate(kind, value, id = false) {
    if (!types[kind] || (id ? !/^[1-9]\d{0,15}$/.test(String(value)) : typeof value !== 'string' || value.trim().length < 2 || value.length > 120)) { const error = Error('Consulta musical inválida.'); error.status = 400; throw error; }
  }
  return {
    search: async (kind, term) => {
      validate(kind, term); const payload = await request('search/' + types[kind] + '?' + new URLSearchParams({ q: term.trim(), limit: 24 }));
      const seen = new Set(); const items = (payload.data || []).filter(row => Number.isSafeInteger(row.id) && row.id > 0 && !seen.has(row.id) && seen.add(row.id)).map(row => {
        const result = normalize(row, kind);
        result.popularity = Number(row.nb_fan || row.rank || 0);
        if (kind === 'artist' && Number.isFinite(row.nb_fan)) result.description = 'Deezer · ' + row.nb_fan.toLocaleString('pt-BR') + ' fãs';
        return result;
      });
      const clean = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
      const needle = clean(term);
      const exact = value => value.normalize('NFC').toLowerCase().trim();
      const accentSensitive = /\p{M}/u.test(term.normalize('NFD'));
      const relevance = row => kind === 'artist' && accentSensitive && exact(row.title) === exact(term) ? 5 : clean(row.title) === needle ? 4 : clean(row.artist) === needle ? 3 : clean(row.title).startsWith(needle) ? 2 : 1;
      items.sort((a,b) => relevance(b) - relevance(a) || b.popularity - a.popularity);
      const identities = new Set();
      const selected = items.filter(row => {
        const identity = kind === 'artist' ? row.catalogId : clean(row.title) + ':' + clean(row.artist) + ':' + (row.albumCatalogId || '');
        if (identities.has(identity)) return false; identities.add(identity); return true;
      }).slice(0, 12);
      if (kind === 'artist') {
        let next = 0;
        await Promise.all(Array.from({ length: 3 }, async () => {
          while (next < selected.length) {
            const row = selected[next++];
            const tracks = await request('artist/' + row.catalogId.split(':')[1] + '/top?limit=1').catch(() => ({}));
            row.knownTrack = tracks.data?.[0]?.title || '';
            if (row.knownTrack) row.description += ' · Conhecido por: ' + row.knownTrack;
          }
        }));
      }
      if (kind === 'album' || kind === 'music') {
        let next = 0;
        await Promise.all(Array.from({ length: 3 }, async () => {
          while (next < selected.length) {
            const row = selected[next++]; if (row.releaseDate) continue;
            const albumId = kind === 'music' ? row.albumCatalogId : row.catalogId;
            if (!albumId) continue;
            const detail = await request('album/' + albumId.split(':')[1]).catch(() => ({}));
            if ('deezer:' + detail.id === albumId) row.releaseDate = detail.release_date || '';
          }
        }));
      }
      return { items: selected };
    },
    albums: async (id, offset = 0) => {
      validate('artist', id, true);
      if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000) { const error = Error('Página inválida.'); error.status = 400; throw error; }
      const payload = await request('artist/' + id + '/albums?' + new URLSearchParams({ limit: 20, index: offset }));
      return { items: (payload.data || []).map(row => normalize({ ...row, artist: row.artist || { id } }, 'album')), next: payload.next ? offset + 20 : null };
    },
    details: async (kind, id) => {
      validate(kind, id, true); const row = await request(types[kind] + '/' + id); if (String(row.id) !== String(id)) throw Error('Título não encontrado na Deezer.');
      const result = normalize(row, kind);
      if (kind === 'album') { result.trackNames = (row.tracks?.data || []).map(track => track.title); result.albumTracks = (row.tracks?.data || []).map(track => normalize({ ...track, artist: track.artist || row.artist, album: { id: row.id, title: row.title, cover_big: row.cover_big } }, 'music')); result.genres = (row.genres?.data || []).map(genre => genre.name); }
      if (kind === 'artist') {
        const tracks = await request('artist/' + id + '/top?limit=8').catch(() => ({}));
        const albums = await request('artist/' + id + '/albums?limit=20&index=0').catch(() => ({}));
        result.topTracks = (tracks.data || []).map(track => normalize({ ...track, artist: track.artist || row }, 'music'));
        result.topAlbums = (albums.data || []).map(album => normalize({ ...album, artist: row }, 'album'));
        result.discographyNext = albums.next ? 20 : null;
        result.discographyUnavailable = !Array.isArray(albums.data);
      }
      return result;
    }
  };
}
module.exports = { createDeezerClient };
