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
    artistAliases: async name => {
      if (typeof name !== 'string' || !name.trim() || name.length > 200) return [];
      const clean = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
      const exact = async value => {
        const quoted=value.replace(/[\\"]/g,' ').trim();
        const payload=await request('artist',{query:'artist:"'+quoted+'"',limit:25});
        if(Number(payload.count)>25)return null;
        const matches=(payload.artists||[]).filter(row=>UUID.test(row.id)&&clean(row.name)===clean(value));
        return matches.length===1?matches[0]:null;
      };
      const aliases = row => (row.aliases||[]).filter(a=>a.type==='Artist name').map(a=>a.name).filter(Boolean);
      const direct=await exact(name);if(direct)return aliases(direct);
      // Character credits retain their voice actor: verify both identities and
      // require an official character alias confirming this exact CV pairing.
      const credit=name.normalize('NFKC').match(/^(.+?)\s*\(\s*C\.?\s*V\.?\s*[:：.]?\s*(.+?)\s*\)$/i);
      if(!credit)return [];
      const character=await exact(credit[1].trim());if(character?.type!=='Character')return [];
      const compact=value=>String(value).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
      if(!(character.aliases||[]).some(a=>compact(a.name)===compact(name)))return [];
      const voice=await exact(credit[2].trim());if(!voice)return [];
      return [...new Set(aliases(character).flatMap(characterName=>aliases(voice).map(voiceName=>characterName+' (CV: '+voiceName+')')))].slice(0,8);
    },
    recordingIsrc: async ({title, artist: wantedArtist, trackDuration}) => {
      if (!title || !wantedArtist || !Number.isFinite(trackDuration) || trackDuration <= 0) return null;
      const clean = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
      const names = new Set(wantedArtist.split(/\s*(?:\/|,|;|&| · )\s*/).map(clean).filter(Boolean));
      const recordingTitle = String(title).replace(/\s*\(Soundtrack\)\s*$/i, '');
      const quoted = recordingTitle.replace(/[\\"]/g, ' ').trim();
      const payload = await request('recording', {query:'recording:"'+quoted+'"', limit:100});
      if (Number(payload.count) > 100) return null;
      const matches = (payload.recordings || []).filter(row => {
        if (!UUID.test(row.id) || clean(row.title) !== clean(recordingTitle) || !Number.isFinite(row.length) || Math.abs(row.length - trackDuration * 1000) > 1500) return false;
        if (row.disambiguation && !['album version','single version','original version','studio version'].includes(clean(row.disambiguation))) return false;
        const credits = row['artist-credit'] || [];
        return credits.length > 0 && credits.every(credit => [credit.name, credit.artist?.name, ...(credit.artist?.aliases || []).map(a => a.name)].some(name => names.has(clean(name))));
      });
      if (!matches.length) return null;
      const codes = new Set(matches.flatMap(row => row.isrcs || []).filter(code => /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(code)));
      return codes.size === 1 && !matches.some(row => !row.isrcs?.length) ? {isrc:[...codes][0], recordingId:matches[0].id} : codes.size ? {candidates:[...codes]} : {artistAliases:[...new Set(matches.flatMap(row => row['artist-credit'].flatMap(credit => [credit.name,credit.artist?.name,...(credit.artist?.aliases || []).map(a => a.name)]).filter(Boolean)))]};
    },
    playbackSource: async (title, wantedArtist) => {
      if(typeof title!=='string'||typeof wantedArtist!=='string'||!title.trim()||!wantedArtist.trim()||title.length>200||wantedArtist.length>200){const error=Error('Informe título e artista válidos.');error.status=400;throw error;}
      const clean=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
      const quote=value=>'"'+value.replace(/[\\"]/g,' ').trim()+'"';
      const payload=await request('recording',{query:'recording:'+quote(title)+' AND artist:'+quote(wantedArtist),limit:15});
      const safeVersion=value=>['','official music video','album version','single version','original version'].includes(clean(value));
      const rows=(payload.recordings||[]).filter(row=>UUID.test(row.id)&&clean(row.title)===clean(title)&&clean(artist(row))===clean(wantedArtist)).sort((a,b)=>(clean(b.disambiguation)==='official music video'?2:Number(safeVersion(b.disambiguation)))-(clean(a.disambiguation)==='official music video'?2:Number(safeVersion(a.disambiguation)))).slice(0,4);
      const choices=new Map();
      for(const row of rows){
        const detail=await request('recording/'+row.id,{inc:'url-rels+artist-credits'});
        if(detail.id!==row.id||clean(detail.title)!==clean(title)||clean(artist(detail))!==clean(wantedArtist))continue;
        for(const relation of detail.relations||[]){
          if(relation['target-type']!=='url'||relation.ended===true)continue;
          try{
            const link=relation.url?.resource;
            const direct=['streaming','free streaming','free download'].includes(relation.type)&&/^https:\/\//i.test(link||'')&&/\.(?:mp3|m4a|aac|ogg|oga|wav|flac|opus)(?:[?#]|$)/i.test(link);
            const source=require('../dist/music-model.js').source({type:direct?'audio':'youtube',url:link});
            const key=source.videoId||source.url,existing=choices.get(key);const safe=safeVersion(row.disambiguation)&&safeVersion(detail.disambiguation);
            choices.set(key,{title:detail.title+(detail.disambiguation?' · '+detail.disambiguation:''),channel:artist(detail),url:source.url,videoId:source.videoId,type:source.type,safe:(existing?.safe||safe)});
          }catch{ /* Catalog/streaming pages and previews are not direct playable audio. */ }
        }
      }
      const items=[...choices.values()];const source=items.length===1&&items[0].safe?require('../dist/music-model.js').source({type:items[0].type,url:items[0].url}):null;
      return {status:source?'matched':items.length?'choose':'not-found',items:items.map(({safe,...item})=>item),source,provider:'MusicBrainz'};
    },
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
