// Verify an edition against public lrc.red metadata; never choose by provider availability alone.
function createIsrcEditionResolver({fetcher=fetch}={}) {
 const cache=new Map(),pending=new Map();
 const clean=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 const artists=value=>String(value||'').split(/\s*(?:\/|,|;|&| · )\s*/).map(clean).filter(Boolean).sort().join('|');
 async function metadata(code){
  if(cache.has(code))return cache.get(code);if(pending.has(code))return pending.get(code);
  const task=(async()=>{try{const response=await fetcher('https://lrc.red/s/'+code+'.json',{signal:AbortSignal.timeout(5000)});if(!response.ok)return null;const data=await response.json();if(data.isrc!==code)return null;if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(code,data);return data;}catch{return null;}})().finally(()=>pending.delete(code));pending.set(code,task);return task;
 }
 return async (track,candidates,artistAliases=[],{localizedAlbumFallback=false}={})=>{
  if(!track.albumTitle||!track.artist||!track.title||!Number.isFinite(track.trackDuration)||track.trackDuration<=0)return null;
  if(!candidates){try{const response=await fetcher(localizedAlbumFallback ? 'https://lrc.red/match.json?'+new URLSearchParams({track:track.title,artist:track.artist,duration:String(track.trackDuration)}) : 'https://lrc.red/search.json?'+new URLSearchParams({q:track.title}),{signal:AbortSignal.timeout(5000)});if(!response.ok)return null;let result=await response.json();
   if(localizedAlbumFallback && !(result.hits||[]).length){
    for(const alias of artistAliases.slice(0,4)){
     const alternate=await fetcher('https://lrc.red/match.json?'+new URLSearchParams({track:track.title,artist:alias,duration:String(track.trackDuration)}),{signal:AbortSignal.timeout(5000)});
     if(alternate.ok){const found=await alternate.json();if((found.hits||[]).length){result=found;break;}}
    }
   }
   if(localizedAlbumFallback && artistAliases.length && !(result.hits||[]).length){const search=await fetcher('https://lrc.red/search.json?'+new URLSearchParams({q:clean(track.title)+' '+clean(track.artist)}),{signal:AbortSignal.timeout(5000)});if(!search.ok)return null;result=await search.json();}if(result.next)return null;candidates=(result.hits||[]).map(row=>row.isrc);}catch{return null;}}
  const acceptedArtists=new Set([...artists(track.artist).split('|'),...artistAliases.map(clean)]);
  const compatibleArtists=value=>{const names=artists(value).split('|');return names.length>0&&names.every(name=>acceptedArtists.has(name));};
  const codes=[...new Set(candidates||[])];if(!codes.length||codes.length>8||codes.some(c=>!/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(c)))return null;
  const rows=await Promise.all(codes.map(metadata));
  const matches=rows.filter(row=>row&&clean(row.title)===clean(track.title)&&(artistAliases.length?compatibleArtists(row.artist):artists(row.artist)===artists(track.artist))&&(localizedAlbumFallback||clean(row.album)===clean(track.albumTitle))&&Number.isFinite(row.duration)&&Math.abs(row.duration-track.trackDuration)<=1.5);
  const albumMatches=matches.filter(row=>clean(row.album)===clean(track.albumTitle));
  const verified=albumMatches.length?albumMatches:matches;
  return verified.length===1?verified[0].isrc:null;
 };
}
module.exports={createIsrcEditionResolver};
