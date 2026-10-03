(() => {
  const translations = new Map();
  Catalog.translateSummary = async (text, source = 'en', { fetcher = fetch } = {}) => {
    const key = source + ':' + text;
    if (translations.has(key)) return translations.get(key);
    if (text.length > 20000) throw Error('Descrição muito longa para este serviço.');
    const encoder = new TextEncoder(); const chunks = []; let chunk = '';
    for (const word of text.match(/\S+\s*|\s+/gu) || []) {
      if (encoder.encode(word).length > 480) {
        if (chunk) { chunks.push(chunk); chunk = ''; }
        for (const character of word) { if (encoder.encode(chunk + character).length > 480) { chunks.push(chunk); chunk = ''; } chunk += character; }
      } else { if (encoder.encode(chunk + word).length > 480) { chunks.push(chunk); chunk = ''; } chunk += word; }
    }
    if (chunk) chunks.push(chunk);
    const translated = [];
    for (const part of chunks) {
      const response = await fetcher('/api/translation?' + new URLSearchParams({ text: part, source }));
      const payload = await response.json();
      if (!response.ok || typeof payload.text !== 'string') throw Error(payload.error || 'Tradução indisponível.');
      translated.push(payload.text);
    }
    const result = translated.join(' '); if (translations.size > 30) translations.clear(); translations.set(key, result); return result;
  };
  Catalog.recommendations = async (item, { fetcher = fetch, reserve = false } = {}) => {
    if (item.kind === 'book' && !item.genres?.length && item.catalogId) item = await Catalog.details(item, { fetcher });
    if (['anime','manga'].includes(item.kind)) {
      const detail = item.recommendationIds?.length ? item : await Catalog.details(item, { fetcher });
      return (detail.recommendationIds || []).map((id,index) => ({ catalogId: id, title: detail.recommendationTitles[index], image: detail.recommendationImages[index], kind: detail.recommendationKinds[index], source: 'AniList' }));
    }
    if (['music','album','artist'].includes(item.kind)) {
      const response = await fetcher('/api/music/recommendations?' + new URLSearchParams({ kind: item.kind, artist: item.kind === 'artist' ? item.title : item.artist || '', title: item.title,...(reserve?{reserve:'1'}:{}) }));
      const payload = await response.json(); if (!response.ok) throw Error(payload.error || 'Recomendações musicais indisponíveis.');
      const items=payload.items || [];Object.defineProperty(items,'reserveAvailable',{value:!!payload.reserveAvailable});if(payload.resolution)Object.defineProperty(items,'resolution',{value:payload.resolution});if(payload.seedFallback)Object.defineProperty(items,'seedTitle',{value:payload.seedTitle});return items;
    }
    if (item.kind === 'book' && item.genres?.length) {
      const subject = item.genres[0].toLowerCase().replace(/\s+/g, '_');
      const response = await fetcher('https://openlibrary.org/subjects/' + encodeURIComponent(subject) + '.json?limit=18');
      if (!response.ok) throw Error('Sugestões indisponíveis.');
      const payload = await response.json();
      return (payload.works || []).filter(row => /^\/works\/OL\d+W$/.test(row.key)).map(row => ({ kind: 'book', catalogId: 'ol:' + row.key, title: row.title, source: 'Open Library', image: row.cover_id ? 'https://covers.openlibrary.org/b/id/' + row.cover_id + '-L.jpg' : '', description: (row.authors || []).map(author => author.name).join(' · '), unit: 'páginas', total: 0 }));
    }
    if (item.kind === 'game') {
      if (item.recommendationIds?.length) return item.recommendationIds.map((id, index) => ({ kind: 'game', catalogId: id, title: item.recommendationTitles[index], image: item.recommendationImages[index], source: 'IGDB', unit: 'horas', total: 0 }));
      if (String(item.catalogId).startsWith('igdb:')) {
        const detail=await Catalog.details(item,{fetcher});
        return (detail.recommendationIds || []).map((id,index)=>({kind:'game',catalogId:id,title:detail.recommendationTitles[index],image:detail.recommendationImages[index],source:'IGDB',unit:'horas',total:0}));
      }
      const response = await fetcher('/api/steam/recommendations/' + String(item.catalogId || '').split(':')[1]);
      if (!response.ok) throw Error('Sugestões indisponíveis.');
      return Catalog.normalize('game', await response.json());
    }
    return [];
  };
  const rawRecommendations=Catalog.recommendations, recommendationCache=new Map(),recommendationPending=new Map();
  Catalog.recommendations=async(item,options={})=>{
    const key=item.kind+':'+item.catalogId;const previous=recommendationCache.get(key);
    if(previous && Date.now()-previous.at<5*60*1000&&!(options.reserve&&previous.items.reserveAvailable))return previous.items;
    // Explicit fetchers/signals belong to their caller; only default requests are shared.
    const pendingKey=key+':'+!!options.reserve,share=!options.fetcher&&!options.signal;
    if(share&&recommendationPending.has(pendingKey))return recommendationPending.get(pendingKey);
    const task=(async()=>{
      const items=await rawRecommendations(item,options);
      if(items.resolution?.failures||items.some(row=>row.kind==='artist'&&!row.image))return items;
      const current=recommendationCache.get(key);
      if((current?.items.resolution?.total||0)>(items.resolution?.total||0))return items;
      if(recommendationCache.size>=40)recommendationCache.delete(recommendationCache.keys().next().value);
      recommendationCache.set(key,{at:Date.now(),items});return items;
    })().finally(()=>{if(share)recommendationPending.delete(pendingKey);});
    if(share)recommendationPending.set(pendingKey,task);return task;
  };
  Catalog.forCollection = async (items, { progress = () => {}, partial = () => {}, shouldContinue = () => true, recommend = Catalog.recommendations, rotation = 0, kind = 'all' } = {}) => {
    const seeds = items.filter(item => item.catalogId && ['game','anime','manga','book','music','album','artist'].includes(item.kind)).slice().sort((a,b) => Number(!!b.featured) - Number(!!a.featured) || (b.score || 0) - (a.score || 0) || (b.updated || 0) - (a.updated || 0));
    const chosen = [], kinds = new Set();
    const offset = Math.max(0,Math.floor(rotation)) % Math.max(1,seeds.length);
    const rotated = [...seeds.slice(offset),...seeds.slice(0,offset)];
    if (kind !== 'all') {
      for (const seed of rotated) if (seed.kind === kind && chosen.length < 6) chosen.push(seed);
    } else {
      for (const seed of rotated) if (!kinds.has(seed.kind) && chosen.length < 6) { chosen.push(seed); kinds.add(seed.kind); }
      for (const seed of rotated) if (!chosen.includes(seed) && chosen.length < 6) chosen.push(seed);
    }
    const saved = new Set(items.map(item => item.kind + ':' + item.catalogId)), seen = new Set(), results = [], pools = [];
    let done = 0, failures = 0;
    for (const seed of chosen.slice(0,6)) {
      if(!shouldContinue())break;
      try {
        let entries = await recommend(seed);
        if(entries.resolution?.failures)failures++;
        const shift = Math.max(0,Math.floor(rotation))*4 % Math.max(1,entries.length); entries=[...entries.slice(shift),...entries.slice(0,shift)];
        const pool = [], localSeen = new Set();
        for (const entry of entries) {
          const key = entry.kind + ':' + entry.catalogId;
          if (!entry.catalogId || saved.has(key) || items.some(item=>globalThis.MusicModel?.sameWork(item,entry)) || localSeen.has(key) || key === seed.kind + ':' + seed.catalogId) continue;
          const shared = (entry.genres || []).filter(genre=>seed.genres?.includes(genre)).slice(0,2);
          localSeen.add(key); pool.push({ ...entry, reason: (seed.featured ? 'Porque você favoritou ' : 'A partir de ') + seed.title + (shared.length ? ' · '+shared.join(', ') : '') + ' · '+(entry.source || seed.source || 'catálogo'), seedTitle: seed.title });
          if (pool.length >= 48) break;
        }
        pools.push(pool);
        partial(pools.flat().filter((entry,index,rows)=>rows.findIndex(row=>row.kind===entry.kind&&row.catalogId===entry.catalogId)===index).slice(0,24));
      } catch { failures++; }
      progress(++done, Math.min(chosen.length,6));
    }
    const longest = Math.max(0,...pools.map(pool=>pool.length));
    for(let position=0;position<longest && results.length<24;position++)for(const pool of pools){
      const entry=pool[position];if(!entry)continue;
      const key=entry.kind+':'+entry.catalogId;if(seen.has(key))continue;
      seen.add(key);results.push(entry);if(results.length===24)break;
    }
    return { items: results, failures, seeds: Math.min(chosen.length,6) };
  };
})();
