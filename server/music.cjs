function createMusicClient({ fetcher = fetch } = {}) {
  const cache = new Map(), pending = new Map();
  function normalize(row, kind) {
    const album = kind === 'album';
    const albumType = /(?:^|[-–—(])\s*EP\s*\)?\s*$/i.test(row.collectionName || '') ? 'ep' : /(?:^|[-–—(])\s*Single\s*\)?\s*$/i.test(row.collectionName || '') ? 'single' : 'album';
    if(kind==='artist') return {kind,catalogId:'itunes:'+row.artistId,source:'iTunes',title:row.artistName||'',artist:row.artistName||'',url:row.artistLinkUrl||row.artistViewUrl||'',image:'',genres:row.primaryGenreName?[row.primaryGenreName]:[],description:'Artista · iTunes',summary:''};
    return { catalogId: 'itunes:' + (album ? row.collectionId : row.trackId), kind, ...(album ? {albumType} : {}), source: 'iTunes', artistCatalogId: row.artistId ? 'itunes:' + row.artistId : '', albumCatalogId: row.collectionId ? 'itunes:' + row.collectionId : '', albumTitle: row.collectionName || '', title: (album ? row.collectionName : row.trackName) || '', image: (row.artworkUrl100 || '').replace(/100x100bb/, '600x600bb'), url: (album ? row.collectionViewUrl : row.trackViewUrl) || '', artist: row.artistName || '', description: [row.artistName, row.releaseDate?.slice(0,10)].filter(Boolean).join(' · '), genres: row.primaryGenreName ? [row.primaryGenreName] : [], summary: '', total: album ? row.trackCount || 0 : 0, unit: album ? 'faixas' : 'audições', trackDuration: row.trackTimeMillis ? Math.round(row.trackTimeMillis / 1000) : 0, previewUrl: row.previewUrl || '', releaseDate: row.releaseDate?.slice(0,10) || '' };
  }
  async function request(path, params) {
    const key = path + new URLSearchParams(params);
    const found=cache.get(key);if(found?.expires>Date.now())return found.value;
    if(pending.has(key))return pending.get(key);
    const task=(async()=>{
    const response = await fetcher('https://itunes.apple.com/' + path + '?' + new URLSearchParams({ country: 'BR', ...params }), { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw Error('Catálogo de música indisponível.');
    const payload = await response.json(); if (cache.size > 60) cache.clear(); cache.set(key, {value:payload,expires:Date.now()+900000}); return payload;
    })().finally(()=>pending.delete(key));pending.set(key,task);return task;
  }
  return {
    search: async (kind, term) => {
      if (!['music','album','artist'].includes(kind) || String(term || '').trim().length < 2 || String(term).length > 120) { const error = Error('Busca de música inválida.'); error.status = 400; throw error; }
      const params={term:term.trim(),media:'music',entity:{music:'song',album:'album',artist:'musicArtist'}[kind],limit:24};
      const payloads=await Promise.all([request('search',params),...(kind==='artist'?[]:[request('search',{term:term.trim(),media:'music',entity:'musicArtist',limit:12})])]);
      const clean=v=>String(v||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');
      const seen=new Set(),needle=clean(term);
      const matchingArtist=kind==='artist'?null:payloads[1]?.results?.find(row=>row.artistId&&clean(row.artistName)===needle);
      const relatedPayload=matchingArtist?await request('lookup',{id:matchingArtist.artistId,entity:kind==='music'?'song':'album',limit:24}):{results:[]};
      const rows=[...(payloads[0].results||[]),...(relatedPayload.results||[]).filter(row=>kind==='music'?row.kind==='song':row.wrapperType==='collection')].map(row=>({...normalize(row,kind),artistCatalogId:row.artistId?'itunes:'+row.artistId:'',albumCatalogId:row.collectionId?'itunes:'+row.collectionId:'',albumTitle:row.collectionName||'',previewSource:'iTunes'})).filter(row=>{const key=kind==='artist'?row.catalogId:clean(row.title)+':'+clean(row.artist);if(!row.title||row.catalogId.endsWith('undefined')||seen.has(key))return false;seen.add(key);return true;});
      const score=row=>clean(row.title)===needle?4:clean(row.artist)===needle?3:clean(row.title).startsWith(needle)?2:1;
      rows.sort((a,b)=>score(b)-score(a));const items=rows.slice(0,12),related=rows.filter(row=>clean(row.artist)===needle).slice(0,6);
      for(const row of related)if(!items.includes(row)){if(items.length>=12){const index=items.findLastIndex(item=>!related.includes(item));if(index>=0)items.splice(index,1);}items.push(row);}
      return {items,provider:'iTunes'};
    },
    details: async (kind, id) => {
      if (!['music','album','artist'].includes(kind) || !/^[1-9]\d{0,15}$/.test(id)) { const error = Error('Identificador de música inválido.'); error.status = 400; throw error; }
      const payload = await request('lookup', { id, ...(kind === 'album' ? { entity: 'song',limit:200 } : kind==='artist'?{entity:'album',limit:50}:{}) });
      const row = payload.results?.find(row => String(kind==='artist'?row.artistId:kind === 'album' ? row.collectionId : row.trackId) === id && (kind !== 'album' || row.wrapperType === 'collection') && (kind!=='artist'||row.wrapperType==='artist'));
      if (!row) { const error = Error('Título musical não encontrado.'); error.status = 404; throw error; }
      const result = normalize(row, kind);
      result.trackNames = kind === 'album' ? payload.results.filter(row => row.kind === 'song').map(row => row.trackName || '') : [];
      result.artistCatalogId=row.artistId?'itunes:'+row.artistId:'';result.albumCatalogId=row.collectionId?'itunes:'+row.collectionId:'';result.albumTitle=row.collectionName||'';
      if(kind==='album')result.albumTracks=payload.results.filter(row=>row.kind==='song').map(row=>normalize(row,'music'));
      if(kind==='artist'){
        result.topAlbums=payload.results.filter(row=>row.wrapperType==='collection').map(row=>normalize(row,'album'));result.discographyNext=null;
        const songs=await request('lookup',{id,entity:'song',limit:24}).catch(()=>({results:[]}));
        result.topTracks=(songs.results||[]).filter(row=>row.kind==='song').map(row=>normalize(row,'music'));
      }
      return result;
    }
  };
}
module.exports = { createMusicClient };
