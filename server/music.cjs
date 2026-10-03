function createMusicClient({ fetcher = fetch, recommendationInterval = 750 } = {}) {
  const cache = new Map(), pending = new Map();
  let recommendationQueue=Promise.resolve(),nextRecommendation=0;
  function normalize(row, kind) {
    const album = kind === 'album';
    const albumType = /(?:^|[-–—(])\s*EP\s*\)?\s*$/i.test(row.collectionName || '') ? 'ep' : /(?:^|[-–—(])\s*Single\s*\)?\s*$/i.test(row.collectionName || '') ? 'single' : 'album';
    if(kind==='artist') return {kind,catalogId:'itunes:'+row.artistId,source:'iTunes',title:row.artistName||'',artist:row.artistName||'',url:row.artistLinkUrl||row.artistViewUrl||'',image:'',genres:row.primaryGenreName?[row.primaryGenreName]:[],description:'Artista · iTunes',summary:''};
    return { catalogId: 'itunes:' + (album ? row.collectionId : row.trackId), kind, ...(album ? {albumType} : {}), source: 'iTunes', artistCatalogId: row.artistId ? 'itunes:' + row.artistId : '', albumCatalogId: row.collectionId ? 'itunes:' + row.collectionId : '', albumTitle: row.collectionName || '', title: (album ? row.collectionName : row.trackName) || '', image: (row.artworkUrl100 || '').replace(/100x100bb/, '600x600bb'), url: (album ? row.collectionViewUrl : row.trackViewUrl) || '', artist: row.artistName || '', description: [row.artistName, row.releaseDate?.slice(0,10)].filter(Boolean).join(' · '), genres: row.primaryGenreName ? [row.primaryGenreName] : [], summary: '', total: album ? row.trackCount || 0 : 0, unit: album ? 'faixas' : 'audições', trackDuration: row.trackTimeMillis ? Math.round(row.trackTimeMillis / 1000) : 0, previewUrl: row.previewUrl || '', releaseDate: row.releaseDate?.slice(0,10) || '' };
  }
  async function request(path, params, paced=false) {
    const key = path + new URLSearchParams(params);
    const pendingKey=(paced?'recommendation:':'foreground:')+key;
    const found=cache.get(key);if(found?.expires>Date.now())return found.value;
    if(pending.has(pendingKey))return pending.get(pendingKey);
    const run=async()=>{
    if(paced){const delay=Math.max(0,nextRecommendation-Date.now());if(delay)await new Promise(r=>setTimeout(r,delay));nextRecommendation=Date.now()+recommendationInterval;}
    const refreshed=cache.get(key);if(refreshed?.expires>Date.now())return refreshed.value;
    let response;
    try{response=await fetcher('https://itunes.apple.com/' + path + '?' + new URLSearchParams({ country: 'BR', ...params }), { signal: AbortSignal.timeout(8000) });}
    catch(cause){const e=Error('Catálogo de música indisponível.');e.providerFailure={type:['TimeoutError','AbortError'].includes(cause.name)?'timeout':'network'};throw e;}
    if (!response.ok) {const e=Error('Catálogo de música indisponível.');e.providerFailure={type:response.status===429?'rate-limit':'http',httpStatus:response.status};throw e;}
    const payload = await response.json(); if (cache.size > 60) cache.clear(); cache.set(key, {value:payload,expires:Date.now()+900000}); return payload;
    };
    const task=(paced?recommendationQueue.catch(()=>{}).then(run):run()).finally(()=>pending.delete(pendingKey));if(paced)recommendationQueue=task;pending.set(pendingKey,task);return task;
  }
  return {
    artistTracks: async id => {
      if(!/^[1-9]\d{0,15}$/.test(String(id)))return [];
      const payload=await request('lookup',{id,entity:'song',limit:24});
      return (payload.results||[]).filter(row=>row.kind==='song'&&String(row.artistId)===String(id)).map(row=>normalize(row,'music'));
    },
    resolveRecommendation: async (suggestion,{lookups=new Map()}={}) => {
      const {kind,title,artist}=suggestion;
      if(!['music','album','artist'].includes(kind)||typeof title!=='string'||!title.trim()||title.length>200)throw Error('Sugestão musical inválida.');
      const key=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
      const sharedRequest=(path,params)=>{const k=path+new URLSearchParams(params);if(!lookups.has(k))lookups.set(k,request(path,params,true));return lookups.get(k);};
      if(kind==='album'&&typeof artist==='string'&&artist.trim()){
        // Share one discography lookup across recommendations of the same artist.
        const artists=await sharedRequest('search',{term:artist,media:'music',entity:'musicArtist',limit:12});
        const exact=(artists.results||[]).filter(row=>row.artistId&&key(row.artistName)===key(artist));
        const ids=[...new Set(exact.map(row=>row.artistId))];
        if(ids.length===1){
          const albums=await sharedRequest('lookup',{id:ids[0],entity:'album',limit:200});
          const rows=(albums.results||[]).filter(row=>row.wrapperType==='collection');
          const match=rows.find(row=>key(row.collectionName)===key(title)&&key(row.artistName)===key(artist));
          if(match)return normalize(match,kind);
          if(rows.length<200)return null;
        }
      }
      // Catalog resolution has no artist expansion or 12-card UI truncation.
      const terms=kind==='artist'?[title]:[title+' '+artist,title];
      for(const term of new Set(terms)){
        const payload=await sharedRequest('search',{term,media:'music',entity:{music:'song',album:'album',artist:'musicArtist'}[kind],limit:50});
        const row=(payload.results||[]).find(row=>key(kind==='artist'?row.artistName:kind==='album'?row.collectionName:row.trackName)===key(title)&&(kind==='artist'||key(row.artistName)===key(artist)));
        if(row)return normalize(row,kind);
      }
      return null;
    },
    search: async (kind, term) => {
      if (!['music','album','artist'].includes(kind) || String(term || '').trim().length < 2 || String(term).length > 120) { const error = Error('Busca de música inválida.'); error.status = 400; throw error; }
      const params={term:term.trim(),media:'music',entity:{music:'song',album:'album',artist:'musicArtist'}[kind],limit:24};
      const payloads=await Promise.all([request('search',params),...(kind==='artist'?[]:[request('search',{term:term.trim(),media:'music',entity:'musicArtist',limit:12}).catch(()=>({results:[]}))])]);
      const clean=v=>String(v||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');
      const seen=new Set(),needle=clean(term);
      const distance=(a,b)=>{let previous=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const current=[i];for(let j=1;j<=b.length;j++)current[j]=Math.min(current[j-1]+1,previous[j]+1,previous[j-1]+(a[i-1]===b[j-1]?0:1));previous=current;}return previous[b.length];};
      const relevant=row=>{const title=clean(kind==='artist'?row.artistName:kind==='album'?row.collectionName:row.trackName),artist=clean(row.artistName);return title.startsWith(needle)||artist.startsWith(needle)||distance(title,needle)<=1;};
      if(!(payloads[0].results||[]).some(relevant)){
        const tokens=term.trim().split(/\s+/),broader=tokens.length>1?tokens.slice(0,-1).join(' '):term.trim().slice(0,-1);
        if(broader.length>=3){const fallback=await request('search',{...params,term:broader,limit:200}).catch(()=>({results:[]}));payloads[0]={results:[...(payloads[0].results||[]),...(fallback.results||[]).filter(relevant)]};}
      }
      const titleMatch=kind!=='artist'&&(payloads[0].results||[]).some(row=>{const title=clean(kind==='album'?row.collectionName:row.trackName);return title.startsWith(needle)||distance(title,needle)<=1;});
      const matchingArtist=kind==='artist'||titleMatch?null:payloads[1]?.results?.find(row=>row.artistId&&clean(row.artistName)===needle);
      const relatedPayload=matchingArtist?await request('lookup',{id:matchingArtist.artistId,entity:kind==='music'?'song':'album',limit:24}).catch(()=>({results:[]})):{results:[]};
      const rows=[...(payloads[0].results||[]).filter(row=>!titleMatch||clean(kind==='album'?row.collectionName:row.trackName).startsWith(needle)||distance(clean(kind==='album'?row.collectionName:row.trackName),needle)<=1),...(relatedPayload.results||[]).filter(row=>kind==='music'?row.kind==='song':row.wrapperType==='collection')].map(row=>({...normalize(row,kind),artistCatalogId:row.artistId?'itunes:'+row.artistId:'',albumCatalogId:row.collectionId?'itunes:'+row.collectionId:'',albumTitle:row.collectionName||'',previewSource:'iTunes'})).filter(row=>{const key=kind==='artist'?row.catalogId:clean(row.title)+':'+clean(row.artist);if(!row.title||row.catalogId.endsWith('undefined')||seen.has(key))return false;seen.add(key);return true;});
      const score=row=>clean(row.title)===needle?6:clean(row.title).startsWith(needle)?5:distance(clean(row.title),needle)<=1?4:clean(row.artist)===needle?3:clean(row.artist).startsWith(needle)?2:1;
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
