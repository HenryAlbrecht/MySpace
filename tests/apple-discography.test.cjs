const {test}=require('node:test'),assert=require('node:assert/strict');
const {createMusicClient}=require('../server/music.cjs');
test('legacy Apple artist discography retains Album/EP/Single types and provider IDs',async()=>{
 const releases=['Album','Song - Single','Small Release - EP'].map((collectionName,i)=>({wrapperType:'collection',collectionId:i+2,collectionName,artistId:1,artistName:'Artist'}));
 const client=createMusicClient({fetcher:async url=>({ok:true,json:async()=>({results:new URL(url).searchParams.get('entity')==='song'?[]:[{wrapperType:'artist',artistId:1,artistName:'Artist'},...releases]})})});
 const result=await client.details('artist','1');assert.deepEqual(result.topAlbums.map(row=>row.albumType),['album','single','ep']);
 for(const type of ['album','single','ep'])assert.equal(result.topAlbums.filter(row=>row.albumType===type).length,1);
 assert.equal(result.topAlbums[1].catalogId,'itunes:3');assert.equal(result.topAlbums[1].title,'Song - Single');
});
