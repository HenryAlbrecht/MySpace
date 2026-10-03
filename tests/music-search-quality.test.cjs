const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createMusicClient}=require('../server/music.cjs');
const {createMusicCatalog}=require('../server/music-catalog.cjs');
const {createArtistArtworkClient}=require('../server/artist-artwork.cjs');
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
