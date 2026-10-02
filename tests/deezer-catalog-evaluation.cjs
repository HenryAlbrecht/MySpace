// Live, opt-in evaluation only. Does not change application providers.
const fs=require('node:fs'),{createMusicCatalog}=require('../server/music-catalog.cjs');
const {createMusicClient}=require('../server/music.cjs'),{createDeezerClient}=require('../server/deezer.cjs');
const clean=v=>String(v||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');
const cases=[['music','Wonderwall','Oasis'],['music','Oops!...I Did It Again','Britney Spears'],['music','Oasis','Oasis'],['music','Duvet','bôa'],['album','Oasis','Oasis'],['album',"(What's the Story) Morning Glory?",'Oasis'],['artist','Oasis','Oasis'],['artist','bôa','bôa']];
function measured(fetcher=fetch){let calls=0;return{fetcher:async(...args)=>{calls++;return fetcher(...args);},count:()=>calls};}
function candidate(fetcher){
 const cache=new Map(),pending=new Map();
 async function get(path){if(cache.has(path))return cache.get(path);if(pending.has(path))return pending.get(path);const task=(async()=>{const r=await fetcher('https://api.deezer.com/'+path,{signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('Deezer HTTP '+r.status);const p=await r.json();if(p.error)throw Error('Deezer API error');cache.set(path,p);return p;})().finally(()=>pending.delete(path));pending.set(path,task);return task;}
 const endpoint=(type,q)=>'search/'+type+'?'+new URLSearchParams({q,limit:50,order:'RANKING_DESC'});
 const normalize=(row,kind)=>({kind,catalogId:'deezer:'+row.id,title:kind==='artist'?row.name:[row.title,row.title_version&&!row.title.includes(row.title_version)?row.title_version:''].filter(Boolean).join(' '),artist:kind==='artist'?row.name:row.artist?.name||'',image:kind==='artist'?row.picture_xl||row.picture_big:row.cover_xl||row.cover_big||row.album?.cover_xl||row.album?.cover_big,rank:row.rank||row.nb_fan||0});
 return{search:async(kind,q)=>{
   const type=kind==='music'?'track':'album',quoted='"'+q.replace(/["\\]/g,' ')+'"';
   const titleTask=kind==='artist'?null:Promise.all([get(endpoint(type,type+':'+quoted)),...(kind==='album'?[get('search/album?'+new URLSearchParams({q,limit:24}))]:[Promise.resolve({data:[]})])]);
   const artistPath='search/artist?'+new URLSearchParams({q,limit:24});
   const artistPayload=await get(artistPath);
   const exact=v=>String(v||'').normalize('NFC').toLowerCase().trim();
   const artistRows=(artistPayload.data||[]).sort((a,b)=>Number(exact(b.name)===exact(q))-Number(exact(a.name)===exact(q))||Number(clean(b.name)===clean(q))-Number(clean(a.name)===clean(q))||(b.nb_fan||0)-(a.nb_fan||0));
   if(kind==='artist')return{items:artistRows.slice(0,12).map(row=>normalize(row,kind))};
   const [titles,plain]=await titleTask;
   const artist=artistRows.find(row=>clean(row.name)===clean(q));
   const related=artist?await get('artist/'+artist.id+'/'+(kind==='music'?'top?limit=24':'albums?limit=24')):{data:[]};
   const rows=[...(titles.data||[]),...(plain.data||[]),...(related.data||[]).map(row=>({...row,artist:row.artist||artist}))].map(row=>normalize(row,kind));
   const score=row=>clean(row.title)===clean(q)?4:clean(row.artist)===clean(q)?3:clean(row.title).startsWith(clean(q))?2:1;
   const seen=new Set();const all=rows.sort((a,b)=>score(b)-score(a)||b.rank-a.rank).filter(row=>{const key=clean(row.title)+':'+clean(row.artist);if(seen.has(key))return false;seen.add(key);return true;});
   const items=all.slice(0,12),reserved=all.filter(row=>clean(row.artist)===clean(q)).slice(0,4);for(const row of reserved)if(!items.includes(row)){if(items.length>=12)items.splice(items.findLastIndex(i=>!reserved.includes(i)),1);items.push(row);}return{items};
 }};
}
(async()=>{
 const a=measured(),b=measured();const baseline=createMusicCatalog({itunes:createMusicClient({fetcher:a.fetcher}),deezer:createDeezerClient({fetcher:a.fetcher})}),experiment=candidate(b.fetcher);const report=[];
 for(const round of ['first','cached'])for(const [kind,q,expected] of cases)for(const [name,client,meter] of [['current',baseline,a],['deezer-candidate',experiment,b]]){
   const calls=meter.count(),start=Date.now();try{const r=await client.search(kind,q);const row={round,name,kind,q,ms:Date.now()-start,requests:meter.count()-calls,expectedArtist:expected,expectedPosition:r.items.findIndex(i=>String(i.artist).normalize('NFC').toLowerCase()===expected.normalize('NFC').toLowerCase())+1,photos:r.items.filter(i=>i.image).length,count:r.items.length,top:r.items.slice(0,4).map(({catalogId,title,artist,image})=>({catalogId,title,artist,image}))};report.push(row);console.log(JSON.stringify(row));}catch(e){const row={round,name,kind,q,error:e.message,ms:Date.now()-start};report.push(row);console.log(JSON.stringify(row));}
 }
 fs.mkdirSync('artifacts/deezer-evaluation',{recursive:true});fs.writeFileSync('artifacts/deezer-evaluation/results.json',JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
