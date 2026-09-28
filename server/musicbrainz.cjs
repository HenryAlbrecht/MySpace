const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function createMusicBrainzClient({ fetcher = fetch, interval = 1100 } = {}) {
  const cache = new Map(), pending = new Map(); let queue = Promise.resolve(), nextRequest = 0;
  const artist = row => (row['artist-credit'] || []).map(credit => credit.name || credit.artist?.name || '').join(' · ');
  const cover = (id, group = false) => UUID.test(id || '') ? 'https://coverartarchive.org/' + (group ? 'release-group/' : 'release/') + id + '/front-500' : '';
  function normalize(row, kind) {
    const album = kind === 'album'; const release = row.releases?.[0];
    return { catalogId: 'musicbrainz:' + row.id, kind, source: 'MusicBrainz', title: row.title || '', artist: artist(row), image: cover(album ? row.id : release?.id, album), url: 'https://musicbrainz.org/' + (album ? 'release-group/' : 'recording/') + row.id, description: [artist(row), row['first-release-date'] || release?.date, row.disambiguation].filter(Boolean).join(' · '), releaseDate: row['first-release-date'] || release?.date || '', genres: (row.genres || []).map(genre => genre.name), summary: '', total: 0, unit: album ? 'faixas' : 'audições', trackDuration: row.length ? Math.round(row.length / 1000) : 0, musicType: row['primary-type'] || '', previewUrl: '' };
  }
  async function request(path, params = {}) {
    const key = path + '?' + new URLSearchParams({ fmt: 'json', ...params });
    if (cache.has(key)) return cache.get(key);
    if (pending.has(key)) return pending.get(key);
    const task = queue.catch(() => {}).then(async () => {
      const delay = Math.max(0, nextRequest - Date.now()); if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      nextRequest = Date.now() + interval;
      const response = await fetcher('https://musicbrainz.org/ws/2/' + key, { headers: { 'User-Agent': 'MySpacePrivateProfile/1.0', Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw Error('MusicBrainz indisponível agora.');
      const payload = await response.json(); if (cache.size >= 80) cache.delete(cache.keys().next().value); cache.set(key, payload); return payload;
    }).finally(() => pending.delete(key));
    pending.set(key, task); queue = task; return task;
  }
  return {
    search: async (kind, term) => {
      if (!['music','album'].includes(kind) || typeof term !== 'string' || term.trim().length < 2 || term.length > 120) { const error = Error('Busca musical inválida.'); error.status = 400; throw error; }
      const entity = kind === 'album' ? 'release-group' : 'recording';
      const payload = await request(entity, { query: term.trim(), limit: 12 });
      return { items: (payload[kind === 'album' ? 'release-groups' : 'recordings'] || []).filter(row => UUID.test(row.id)).map(row => normalize(row, kind)) };
    },
    details: async (kind, id) => {
      if (!['music','album'].includes(kind) || !UUID.test(id)) { const error = Error('Identificador musical inválido.'); error.status = 400; throw error; }
      const entity = kind === 'album' ? 'release-group' : 'recording';
      const row = await request(entity + '/' + id, { inc: 'artist-credits+releases+genres' });
      if (row.id !== id) throw Error('Registro musical não encontrado.');
      const result = normalize(row, kind);
      if (kind === 'album') {
        const releases = (row.releases || []).filter(release => UUID.test(release.id)).sort((a,b) => (a.date || '9999').localeCompare(b.date || '9999'));
        if (releases.length) {
          const release = await request('release/' + releases[0].id, { inc: 'recordings' });
          result.trackNames = (release.media || []).flatMap(media => (media.tracks || []).map(track => track.title || track.recording?.title || '')).filter(Boolean);
          result.total = result.trackNames.length;
          result.edition = [release.title, release.date, release.country].filter(Boolean).join(' · ');
        }
      }
      return result;
    }
  };
}
module.exports = { createMusicBrainzClient };
