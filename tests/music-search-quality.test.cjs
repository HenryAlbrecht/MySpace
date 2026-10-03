const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createMusicClient}=require('../server/music.cjs');
const {createMusicCatalog}=require('../server/music-catalog.cjs');
const {createArtistArtworkClient}=require('../server/artist-artwork.cjs');
test('missing recommendation photos can recover without resolving the Apple identity again',async()=>{
 let resolved=0,available=false;const row={kind:'artist',title:'Artist',catalogId:'itunes:1'};
 const c=createMusicCatalog({itunes:{resolveRecommendation:async()=>{resolved++;return row;}},artistArtwork:{lookup:async()=>available?'https://cdn-images.dzcdn.net/recovered.jpg':''},lastfm:{recommendations:async()=>({items:[row]})}});
 assert.equal((await c.recommendations('artist','Seed','Seed')).items[0].image,'');available=true;
 assert.ok((await c.recommendations('artist','Seed','Seed')).items[0].image);assert.equal(resolved,1);
});
test('search and recommendations use canonical Apple track evidence for missing photos',async()=>{
 const artist={kind:'artist',title:'Joy Division',catalogId:'itunes:1'};let calls=0;
 const catalog=createMusicCatalog({itunes:{search:async()=>({items:[artist]}),artistTracks:async id=>{assert.equal(id,'1');calls++;return [{title:'Love Will Tear Us Apart'},{title:'Disorder'}];},resolveRecommendation:async()=>artist},artistArtwork:{lookup:async(name,{tracks})=>tracks.length?'https://cdn-images.dzcdn.net/joy.jpg':''},lastfm:{recommendations:async()=>({items:[artist]})}});
 assert.ok((await catalog.search('artist','Joy Division')).items[0].image);
 assert.ok((await catalog.recommendations('artist','The Smiths','The Smiths')).items[0].image);
 assert.ok((await catalog.artistPhoto('Joy Division','itunes:1')).image);assert.equal(calls,3);
});
test('Apple track evidence disambiguates artist photo; inconclusive and failed comparisons stay blank',async()=>{
 for(const mode of ['match','tie','offline']){
 const client=createArtistArtworkClient({fetcher:async url=>{
 if(url.includes('search/artist'))return {ok:true,json:async()=>({data:[{id:1,name:'The Smiths',picture_xl:'https://cdn-images.dzcdn.net/correct.jpg'},{id:2,name:'The Smiths',picture_xl:'https://cdn-images.dzcdn.net/other.jpg'}]})};
 if(mode==='offline'&&url.includes('/2/'))throw Error('offline');
 return {ok:true,json:async()=>({data:(url.includes('/1/')||mode==='tie'?['This Charming Man','Heaven Knows']:['Other Song']).map(title=>({title,artist:{name:'The Smiths'}}))})};
 }});
 assert.equal(await client.lookup('The Smiths',{tracks:['This Charming Man','Heaven Knows']}),mode==='match'?'https://cdn-images.dzcdn.net/correct.jpg':'');
 assert.equal(await client.lookup('The Smiths'),'');
 }
});
test('ambiguous artist photos are not guessed by popularity and negative results are cached',async()=>{
 let calls=0;const client=createArtistArtworkClient({fetcher:async()=>{calls++;return {ok:true,json:async()=>({data:[{id:1,name:'Frost',nb_fan:100,picture_xl:'https://cdn-images.dzcdn.net/a.jpg'},{id:2,name:'Frost',nb_fan:1,picture_xl:'https://cdn-images.dzcdn.net/b.jpg'}]})};}});
 assert.equal(await client.lookup('Frost'),'');assert.equal(await client.lookup('Frost'),'');assert.equal(calls,1);
});
test('partial artist query widens once, returns only relevant Apple candidates',async()=>{
 const calls=[];const client=createMusicClient({fetcher:async url=>{const u=new URL(url);calls.push(u.searchParams.get('term'));return {ok:true,json:async()=>({results:u.searchParams.get('term')==='frost'?[{artistId:1,artistName:'Frost Children'},{artistId:2,artistName:'Frost'}]:[]})};}});
 const result=await client.search('artist','frost chil');assert.deepEqual(result.items.map(row=>row.title),['Frost Children']);assert.deepEqual(calls,['frost chil','frost']);assert.equal(result.items[0].catalogId,'itunes:1');
});
test('song title match takes priority over an unrelated artist of the same name',async()=>{
 const calls=[];const client=createMusicClient({fetcher:async url=>{const u=new URL(url);calls.push(u.pathname);return {ok:true,json:async()=>({results:u.searchParams.get('entity')==='musicArtist'?[{artistId:2,artistName:'Wonderwall'}]:[{trackId:1,trackName:'Wonderwall',artistName:'Oasis'},{trackId:3,trackName:'Witchcraft',artistName:'Wonderwall'}]})};}});
 const result=await client.search('music','wonderwall');assert.deepEqual(result.items.map(row=>row.title),['Wonderwall']);assert.ok(!calls.includes('/lookup'));
});
test('homonymous Apple IDs survive without falsely sharing a Deezer photo',async()=>{
 let photoCalls=0;const catalog=createMusicCatalog({itunes:{search:async()=>({items:[{kind:'artist',catalogId:'itunes:1',title:'Frost'},{kind:'artist',catalogId:'itunes:2',title:'FROST'}]})},artistArtwork:{lookup:async()=>{photoCalls++;return 'https://example.com/photo';}}});
 const result=await catalog.search('artist','frost');assert.equal(result.items.length,2);assert.equal(photoCalls,0);assert.ok(result.items.every(row=>!row.image&&row.description.includes('homônimos')));assert.notEqual(result.items[0].catalogId,result.items[1].catalogId);
});
