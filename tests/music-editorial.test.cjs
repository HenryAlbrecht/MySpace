const {test}=require('node:test'),assert=require('node:assert/strict');
const {createMusicCatalog}=require('../server/music-catalog.cjs');
const {createLastfmClient}=require('../server/lastfm.cjs');
test('discovery keeps already collected musical suggestions without repeating cards',async()=>{
 const Catalog={};require('node:vm').runInNewContext(require('node:fs').readFileSync('dist/catalog-discovery.js','utf8'),{Catalog,fetch:()=>{},TextEncoder,URLSearchParams});
 const seed={kind:'music',title:'Duvet',catalogId:'itunes:1'},known={kind:'music',title:'Other',catalogId:'itunes:2'};
 const r=await Catalog.forCollection([seed,known],{recommend:async()=>[known,known]});assert.equal(r.items.length,1);assert.equal(r.items[0].catalogId,known.catalogId);
});
test('Last.fm descriptions enrich Apple without replacing identity, covers or tracks',async()=>{
 const row={kind:'artist',title:'Lily Chou-Chou',catalogId:'itunes:1',source:'iTunes',topTracks:[{catalogId:'itunes:2'}]};
 const c=createMusicCatalog({itunes:{details:async()=>row},artistArtwork:{lookup:async()=> 'photo'},lastfm:{summary:async(kind,artist)=>{assert.equal(artist,row.title);return{summary:'Biography'};}}});
 const result=await c.details('artist','1');assert.equal(result.summary,'Biography');assert.equal(result.summarySource,'Last.fm');assert.equal(result.source,'iTunes');assert.equal(result.catalogId,'itunes:1');assert.deepEqual(result.topTracks,row.topTracks);
});
test('all three recommendation kinds resolve to Apple and reject unrelated matches',async()=>{
 for(const kind of ['music','album','artist']){
 const row={kind,title:'Example',artist:'Artist',catalogId:'itunes:1',source:'iTunes'};
 const c=createMusicCatalog({itunes:{search:async()=>({items:[row]})},artistArtwork:{lookup:async()=> 'photo'},lastfm:{recommendations:async()=>({items:[{...row,catalogId:'lastfm:x'},{...row,catalogId:'lastfm:duplicate'},{...row,title:'Wrong'}],basis:'Last.fm'})}});
 const r=await c.recommendations(kind,'Artist','Example');assert.equal(r.items.length,1);assert.equal(r.items[0].catalogId,'itunes:1');assert.equal(r.items[0].recommendationSource,'Last.fm');
 }
});
test('editorial failure preserves Apple detail; recommendations expose missing configuration',async()=>{
 const row={kind:'music',title:'Duvet',artist:'bôa',catalogId:'itunes:2'};
 const c=createMusicCatalog({itunes:{details:async()=>row},lastfm:{summary:async()=>{throw Error('offline');},recommendations:async()=>{throw Error('Last.fm não configurado');}}});
 assert.deepEqual(await c.details('music','2'),row);await assert.rejects(c.recommendations('music','bôa','Duvet'),/não configurado/);
});
test('Last.fm summary only requests getInfo and artist recommendations use getSimilar',async()=>{
 const methods=[];const c=createLastfmClient({env:{LASTFM_API_KEY:'fixture'},interval:0,fetcher:async url=>{const method=new URL(url).searchParams.get('method');methods.push(method);return{ok:true,json:async()=>method==='artist.getInfo'?{artist:{bio:{content:'Lily biography'}}}:{similarartists:{artist:[{name:'bôa'}]}}};}});
 assert.equal((await c.summary('artist','Lily Chou-Chou')).summary,'Lily biography');assert.equal((await c.recommendations('artist','Lily Chou-Chou','')).items[0].kind,'artist');assert.deepEqual(methods,['artist.getInfo','artist.getSimilar']);
});
