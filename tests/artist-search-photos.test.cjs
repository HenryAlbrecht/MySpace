const {test}=require('node:test'),assert=require('node:assert/strict');
const {createDeezerClient}=require('../server/deezer.cjs'),{createMusicCatalog}=require('../server/music-catalog.cjs');
test('artist search returns correctly bound photos and fan counts with one request, preserving homonyms',async()=>{
 let calls=0;const deezer=createDeezerClient({fetcher:async url=>{calls++;assert.equal(new URL(url).pathname,'/search/artist');return{ok:true,json:async()=>({data:[{id:1,name:'Oasis',nb_fan:10,picture_xl:'https://cdn.test/other.jpg'},{id:927,name:'Oasis',nb_fan:1000000,picture_xl:'https://cdn.test/oasis.jpg'},{id:3,name:'Oasis',nb_fan:1}]})};}});
 const forbidden={search:async()=>{throw Error('unexpected secondary search');}};
 const catalog=createMusicCatalog({deezer,itunes:forbidden,lastfm:forbidden});
 const {items}=await catalog.search('artist','Oasis');assert.equal(calls,1);assert.equal(items.length,3);assert.equal(items[0].catalogId,'deezer:927');assert.equal(items[0].image,'https://cdn.test/oasis.jpg');assert.match(items[0].description,/fãs/);assert.equal(items[1].image,'https://cdn.test/other.jpg');assert.equal(items[2].image,'');
 await catalog.search('artist','Oasis');assert.equal(calls,1);
});
test('artist catalog failure does not silently switch providers',async()=>{
 const c=createMusicCatalog({deezer:{searchCatalog:async()=>{throw Error('offline');}},itunes:{search:()=>{throw Error('wrong provider');}}});await assert.rejects(c.search('artist','Oasis'),/offline/);
});
