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
    searchCatalog: async (kind, term) => {
      validate(kind,term);term=term.trim();
      const clean=v=>String(v||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');
      const exact=v=>String(v||'').normalize('NFC').toLowerCase().trim();
      const needle=clean(term),quoted='"'+term.replace(/["\\]/g,' ')+'"';
      const artistTask=request('search/artist?'+new URLSearchParams({q:term,limit:24}));
      const titleTask=kind==='artist'?null:Promise.all([
        request('search/'+types[kind]+'?'+new URLSearchParams({q:types[kind]+':'+quoted,limit:50,order:'RANKING_DESC'})),
        kind==='album'?request('search/album?'+new URLSearchParams({q:term,limit:24})):Promise.resolve({data:[]})
      ]);
      const [artists,titles]=await Promise.all([artistTask,titleTask]);
      const artistIds=new Set();
      const artistRows=(artists.data||[]).filter(row=>Number.isSafeInteger(row.id)&&row.id>0&&!artistIds.has(row.id)&&artistIds.add(row.id)).sort((a,b)=>Number(exact(b.name)===exact(term))-Number(exact(a.name)===exact(term))||Number(clean(b.name)===needle)-Number(clean(a.name)===needle)||(b.nb_fan||0)-(a.nb_fan||0));
      if(kind==='artist')return {items:artistRows.slice(0,12).map(row=>({...normalize(row,kind),popularity:row.nb_fan||0,description:'Deezer · '+Number(row.nb_fan||0).toLocaleString('pt-BR')+' fãs'}))};
      const artist=artistRows.find(row=>clean(row.name)===needle);
      const related=artist?await request('artist/'+artist.id+'/'+(kind==='music'?'top?limit=24':'albums?limit=24')):{data:[]};
      const convert=rows=>rows.filter(row=>Number.isSafeInteger(row.id)&&row.id>0).map(row=>({...normalize(row,kind),popularity:row.rank||row.nb_fan||0}));
      const matches=convert(kind==='album'?[...(titles[1].data||[]),...(titles[0].data||[])]:titles[0].data||[]);
      // Ignore edition labels only for ranking; preserve full titles and IDs.
      const rankTitle=v=>clean(String(v).replace(/[([][^\])]*(?:remaster|deluxe|anniversary|expanded)[^\])]*[\])]/gi,''));
      const score=row=>clean(row.title)===needle||kind==='album'&&rankTitle(row.title)===needle?4:clean(row.title).startsWith(needle)?3:1;
      matches.sort((a,b)=>score(b)-score(a)||b.popularity-a.popularity);
      const relatedRows=convert((related.data||[]).map(row=>({...row,artist:row.artist||artist})));
      // Keep the best title first, then expose artist matches without squeezing them out.
      const ordered=[...matches.slice(0,1),...relatedRows.slice(0,4),...matches.slice(1),...relatedRows.slice(4)];
      const seen=new Set();return {items:ordered.filter(row=>{const key=kind==='album'?row.catalogId:clean(row.title)+':'+clean(row.artist);if(seen.has(key))return false;seen.add(key);return true;}).slice(0,12)};
    },
    search: async (kind, term, { enrich = true } = {}) => {
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
      if (kind === 'artist' && enrich) {
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
      if (enrich && (kind === 'album' || kind === 'music')) {
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
