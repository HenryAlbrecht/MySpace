const {test}=require('node:test'),assert=require('node:assert/strict');
const {createMusicCatalog}=require('../server/music-catalog.cjs');
test('a single confidently matched playback link still requires confirmation',async()=>{
 const source={type:'youtube',url:'https://www.youtube.com/watch?v=dQw4w9WgXcQ'};
 const catalog=createMusicCatalog({musicbrainz:{playbackSource:async(title,artist)=>{assert.equal(title,'Song');assert.equal(artist,'Artist');return{items:[{title,channel:artist,...source}],source,status:'matched'};}}});
 const r=await catalog.playbackSource('Song','Artist');assert.equal(r.source,null);assert.equal(r.status,'choose');assert.equal(r.items.length,1);assert.equal(r.provider,'MusicBrainz');assert.equal(r.items[0].catalogId,undefined);
});
test('empty suggestions and provider errors do not change catalog or silently link anything',async()=>{
 const c=createMusicCatalog({musicbrainz:{playbackSource:async()=>({items:[]})}});assert.equal((await c.playbackSource('Song','Artist')).status,'not-found');
 const failed=createMusicCatalog({musicbrainz:{playbackSource:async()=>{throw Error('offline');}}});await assert.rejects(failed.playbackSource('Song','Artist'),/offline/);
});
