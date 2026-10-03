// Visual enrichment only: no Deezer catalog identities escape this adapter.
function createArtistArtworkClient({ fetcher = fetch } = {}) {
  const cache=new Map(),pending=new Map();
  const exact=v=>String(v||'').normalize('NFC').trim().toLowerCase().replace(/\s+/g,' ');
  const folded=v=>exact(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  async function lookup(name){
    if(typeof name!=='string'||!name.trim()||name.length>200)return '';
    const key=exact(name),found=cache.get(key);if(found?.expires>Date.now())return found.image;if(pending.has(key))return pending.get(key);
    const task=(async()=>{
      let image='';
      try{
        const response=await fetcher('https://api.deezer.com/search/artist?'+new URLSearchParams({q:name.trim(),limit:24}),{signal:AbortSignal.timeout(2500)});
        if(!response.ok)throw Error('Photo unavailable');const data=(await response.json()).data||[];
        const exactMatches=data.filter(row=>exact(row.name)===key);
        let matches=exactMatches.length?exactMatches:data.filter(row=>folded(row.name)===folded(name));
        // A name alone cannot disambiguate two catalog artists.
        if(new Set(matches.map(row=>row.id)).size>1)matches=[];
        for(const row of matches){
          const candidate=row.picture_xl||row.picture_big||row.picture_medium;
          if(!candidate)continue;const url=new URL(candidate);
          if(url.protocol==='https:'&&(url.hostname==='dzcdn.net'||url.hostname.endsWith('.dzcdn.net'))){image=url.href;break;}
        }
      }catch{ /* Optional image failure never changes Apple identity. */ }
      if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(key,{image,expires:Date.now()+(image?3600000:60000)});return image;
    })().finally(()=>pending.delete(key));pending.set(key,task);return task;
  }
  return {lookup};
}
module.exports={createArtistArtworkClient};
