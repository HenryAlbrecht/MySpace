const {test}=require('node:test'),assert=require('node:assert/strict');
const {createMusicBrainzClient}=require('../server/musicbrainz.cjs'),{createMusicCatalog}=require('../server/music-catalog.cjs');
const row={id:'ca8578d9-7db9-477e-82f2-74cbbf91ef27',title:"It's Going Down Now",length:186093,isrcs:['JPK652300130'],'artist-credit':[{name:'Lotus Juice',artist:{name:'Lotus Juice'}},{name:'高橋あず美',artist:{name:'高橋あず美',aliases:[{name:'Azumi Takahashi'}]}}]};
const song={kind:'music',catalogId:'itunes:1733408557',source:'iTunes',title:row.title,artist:'Azumi Takahashi / Lotus Juice / ATLUS Sound Team / ATLUS GAME MUSIC',trackDuration:186};
function resolver(rows,count=rows.length){return createMusicBrainzClient({interval:0,fetcher:async()=>({ok:true,json:async()=>({recordings:rows,count})})});}
test('recording identifier requires exact title, every credited artist/alias, compatible duration and unique code',async()=>{
 const r=await resolver([row]).recordingIsrc(song);assert.equal(r.isrc,'JPK652300130');
 for(const bad of [{...row,title:row.title+' (Live)'},{...row,length:190000},{...row,disambiguation:'live'},{...row,'artist-credit':[{name:'Someone else'}]}])assert.equal(await resolver([bad]).recordingIsrc(song),null);
 assert.deepEqual((await resolver([row,{...row,isrcs:['JPVI02500637']}]).recordingIsrc(song)).candidates,['JPK652300130','JPVI02500637']);
 assert.equal(await resolver([row],101).recordingIsrc(song),null);
 assert.equal(await resolver([row]).recordingIsrc({...song,trackDuration:0}),null);
});
test('enrichment preserves canonical Apple identity and falls back when lookup fails',async()=>{
 const make=musicbrainz=>createMusicCatalog({itunes:{details:async()=>({...song})},lastfm:{summary:async()=>({})},musicbrainz});
 const item=await make(resolver([row])).details('music','1733408557');assert.equal(item.catalogId,song.catalogId);assert.equal(item.source,'iTunes');assert.equal(item.isrc,row.isrcs[0]);
 const fallback=await make({recordingIsrc:async()=>{throw Error('offline');}}).details('music','1733408557');assert.equal(fallback.isrc,undefined);assert.equal(fallback.isrcLookupVersion,4);
});
test('ambiguous recording codes require a confirmed edition before enriching the catalog',async()=>{
 const candidates=['GBCRL1300378','GBCRL0800305'];
 const make=code=>createMusicCatalog({itunes:{details:async()=>({...song})},lastfm:{summary:async()=>({})},musicbrainz:{recordingIsrc:async()=>({candidates})},isrcEdition:async(track,codes)=>{assert.equal(track.catalogId,song.catalogId);assert.deepEqual(codes,candidates);return code;}});
 assert.equal((await make(candidates[0]).details('music','1733408557')).isrc,candidates[0]);
 assert.equal((await make(null).details('music','1733408557')).isrc,undefined);
});
test('soundtrack label does not hide the recording and missing codes preserve verified aliases',async()=>{
 const result=await resolver([{...row,isrcs:[]}]).recordingIsrc({...song,title:song.title+' (Soundtrack)'});
 assert.ok(result.artistAliases.includes('Azumi Takahashi'));
 assert.equal(result.isrc,undefined);
 assert.equal(await resolver([{...row,isrcs:[]}]).recordingIsrc({...song,title:song.title+' (Live)'}),null);
});
