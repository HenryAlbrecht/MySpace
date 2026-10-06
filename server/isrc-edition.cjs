// Verify an edition against public lrc.red metadata; never choose by provider availability alone.
function createIsrcEditionResolver({fetcher=fetch}={}) {
 const cache=new Map(),pending=new Map();
 const clean=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 const artists=value=>String(value||'').split(/\s*(?:\/|,|;|&| · )\s*/).map(clean).filter(Boolean).sort().join('|');
 const sameAlbum=(track,row)=>clean(row.album)===clean(track.albumTitle);
 // Catalogs sometimes append a Latin transcription to a Japanese title.
 // Split only mixed-script pairs, never ordinary subtitles or version labels.
 const titles=value=>{
  const result=[clean(value)],parts=String(value||'').split(/\s+[-–—]\s+/);
  if(parts.length===2&&!/\b(?:live|remix|remaster(?:ed)?|instrumental|acoustic|version|edit)\b/i.test(value)){
   const cjk=s=>/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(s);
   if(cjk(parts[0])&&!cjk(parts[1])&&/[a-z]/i.test(parts[1])||cjk(parts[1])&&!cjk(parts[0])&&/[a-z]/i.test(parts[0]))result.push(...parts.map(clean));
  }
  return [...new Set(result)];
 };
 const titleMatches=(track,row)=>titles(track.title).some(title=>titles(row.title).includes(title))||(
  sameAlbum(track,row)&&/\bremaster(?:ed)?\b/i.test(track.albumTitle)&&
  clean(String(row.title).replace(/\s*[([](?:\d{4}\s+)?remaster(?:ed)?(?:\s+\d{4})?[)\]]\s*$/i,''))===clean(track.title)
 );
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
   if(localizedAlbumFallback && artistAliases.length && !(result.hits||[]).length){const search=await fetcher('https://lrc.red/search.json?'+new URLSearchParams({q:clean(track.title)+' '+clean(track.artist)}),{signal:AbortSignal.timeout(5000)});if(!search.ok)return null;result=await search.json();}
   // Catalogs can join a romanized band's words (Kinokoteikoku / Kinoko
   // Teikoku). Discover by title + album, then verify all metadata below.
   if(localizedAlbumFallback && !(result.hits||[]).length){const search=await fetcher('https://lrc.red/search.json?'+new URLSearchParams({q:clean(track.title)+' '+clean(track.albumTitle)}),{signal:AbortSignal.timeout(5000)});if(!search.ok)return null;result=await search.json();}
   // An unrelated fuzzy result must not prevent discovery by transcription.
   if(localizedAlbumFallback && !result.next && !(result.hits||[]).some(row=>titleMatches(track,row)&&(!Number.isFinite(row.duration)||Math.abs(row.duration-track.trackDuration)<=1.5))){
    const hits=[];
    for(const title of titles(track.title).slice(1)){
     const search=await fetcher('https://lrc.red/search.json?'+new URLSearchParams({q:title+' '+clean(track.albumTitle)}),{signal:AbortSignal.timeout(5000)});
     if(!search.ok)continue;const found=await search.json();if(found.next)return null;hits.push(...(found.hits||[]));
    }
    result={hits:[...(result.hits||[]),...hits]};
   }
   if(result.next)return null;candidates=(result.hits||[]).filter(row=>(!row.title||titleMatches(track,row))&&(!Number.isFinite(row.duration)||Math.abs(row.duration-track.trackDuration)<=1.5)).map(row=>row.isrc);}catch{return null;}}
  const acceptedArtists=new Set([...artists(track.artist).split('|'),...artistAliases.map(clean)]);
  const compatibleArtists=value=>{const names=artists(value).split('|');return names.length>0&&names.every(name=>acceptedArtists.has(name));};
  const compact=value=>/^[a-z ]+$/.test(value)?value.replace(/ /g,''):'';
  const compactArtists=new Set([...acceptedArtists].map(compact).filter(Boolean));
  const spacedArtistMatch=row=>clean(row.album)===clean(track.albumTitle)&&artists(row.artist).split('|').every(name=>!!compact(name)&&compactArtists.has(compact(name)));
  const codes=[...new Set(candidates||[])];if(!codes.length||codes.length>8||codes.some(c=>!/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(c)))return null;
  const rows=await Promise.all(codes.map(metadata));
  const matches=rows.filter(row=>row&&titleMatches(track,row)&&((artistAliases.length?compatibleArtists(row.artist):artists(row.artist)===artists(track.artist))||spacedArtistMatch(row))&&(localizedAlbumFallback||sameAlbum(track,row))&&Number.isFinite(row.duration)&&Math.abs(row.duration-track.trackDuration)<=1.5);
  const albumMatches=matches.filter(row=>clean(row.album)===clean(track.albumTitle));
  const verified=albumMatches.length?albumMatches:matches;
  return verified.length===1?verified[0].isrc:null;
 };
}
module.exports={createIsrcEditionResolver};
