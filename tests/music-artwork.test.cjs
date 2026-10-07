const {test}=require('node:test'),assert=require('node:assert/strict');
const {createMusicArtwork}=require('../server/music-artwork.cjs');
const link='https://lh3.googleusercontent.com/valid_asset_12345=w800-h800-rj';
test('artwork delivery restricts host/path, shares requests, caches bytes and rejects non-images',async()=>{
 let calls=0;const client=createMusicArtwork({fetcher:async(url,opts)=>{calls++;assert.equal(url,link);assert.equal(opts.redirect,'error');return new Response(Buffer.from([255,216,255]),{headers:{'content-type':'image/jpeg'}});}});
 const [a,b]=await Promise.all([client(link),client(link)]);assert.equal(a.body.length,3);assert.equal(b.type,'image/jpeg');await client(link);assert.equal(calls,1);
 for(const bad of ['http://lh3.googleusercontent.com/valid_asset_12345','https://localhost/valid_asset_12345','https://lh3.googleusercontent.com:444/valid_asset_12345',link+'?redirect=1','https://yt3.googleusercontent.com/short'])await assert.rejects(client(bad),{status:400});
 await assert.rejects(createMusicArtwork({fetcher:async()=>new Response('html',{headers:{'content-type':'text/html'}})})(link),/indisponível/);
 await assert.rejects(createMusicArtwork({fetcher:async()=>new Response('big',{headers:{'content-type':'image/jpeg','content-length':'3000000'}})})(link),/limite/);
});
