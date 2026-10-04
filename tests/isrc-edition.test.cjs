const {test}=require('node:test'),assert=require('node:assert/strict');
const {createIsrcEditionResolver}=require('../server/isrc-edition.cjs');
const track={title:"Heaven Knows I'm Miserable Now",artist:'The Smiths',albumTitle:'Hatful of Hollow',trackDuration:216};
const a='GBCRL1300378',b='GBCRL0800305';
const metadata={isrc:a,title:track.title,artist:track.artist,album:track.albumTitle,duration:216.44};
function resolver(rows){return createIsrcEditionResolver({fetcher:async url=>{const code=url.split('/').pop().replace('.json','');return {ok:!!rows[code],json:async()=>rows[code]};}});}
test('chooses the verified album edition rather than the first available lyrics',async()=>{
 const resolve=resolver({[a]:metadata,[b]:{...metadata,isrc:b,album:'The Sound of The Smiths'}});
 assert.equal(await resolve(track,[b,a]),a);
 assert.equal(await resolve({...track,albumTitle:'The Sound of the Smiths'},[a,b]),b);
});
test('rejects incompatible metadata, missing metadata and ambiguous editions',async()=>{
 for(const change of [{title:'Other song'},{artist:'Other artist'},{album:'Other album'},{duration:220},{isrc:b}])assert.equal(await resolver({[a]:{...metadata,...change}})(track,[a]),null);
 assert.equal(await resolver({})(track,[a]),null);
 assert.equal(await resolver({[a]:metadata,[b]:{...metadata,isrc:b}})(track,[a,b]),null);
 assert.equal(await resolver({[a]:metadata})({...track,albumTitle:''},[a]),null);
});
test('missing recording codes can resolve through search with verified artist aliases',async()=>{
 const resolve=createIsrcEditionResolver({fetcher:async url=>({ok:true,json:async()=>url.includes('search.json')?{hits:[{isrc:a}],next:null}:{...metadata,artist:'Verified Alias'}})});
 assert.equal(await resolve(track,undefined,['Verified Alias']),a);
 assert.equal(await resolve(track,undefined,['Different Alias']),null);
 assert.equal(await resolve({...track,trackDuration:230},undefined,['Verified Alias']),null);
});
