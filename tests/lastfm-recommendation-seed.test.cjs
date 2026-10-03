const {test}=require('node:test'),assert=require('node:assert/strict');const {createLastfmClient}=require('../server/lastfm.cjs');
test('empty mastered seed uses base Last.fm recording and exposes its source',async()=>{
 const calls=[];const c=createLastfmClient({env:{LASTFM_API_KEY:'fixture'},interval:0,fetcher:async url=>{const track=new URL(url).searchParams.get('track');calls.push(track);return{ok:true,json:async()=>({similartracks:{track:track==='Weirdo'?[{name:'Isolation',artist:{name:'Joy Division'}}]:[]}})};}});
 const r=await c.recommendations('music','New Order','Weirdo (2024 Digital Master)');assert.equal(r.items.length,1);assert.equal(r.seedTitle,'Weirdo');assert.equal(r.seedFallback,true);assert.deepEqual(calls,['Weirdo (2024 Digital Master)','Weirdo']);
});
test('nonempty exact recording is preferred and failures do not trigger fallback',async()=>{
 let calls=0;const c=createLastfmClient({env:{LASTFM_API_KEY:'fixture'},interval:0,fetcher:async()=>{calls++;return{ok:true,json:async()=>({similartracks:{track:[{name:'Song',artist:{name:'Artist'}}]}})};}});const r=await c.recommendations('music','Artist','Song (Remastered)');assert.equal(calls,1);assert.equal(r.seedFallback,false);
 const offline=createLastfmClient({env:{LASTFM_API_KEY:'fixture'},interval:0,fetcher:async()=>{throw Error('offline');}});await assert.rejects(offline.recommendations('music','Artist','Song (Remastered)'),/conectar/);
});
test('live, remix and acoustic qualifiers are not removed',async()=>{
 for(const title of ['Song (Live)','Song (Remix)','Song (Acoustic)','Song (2024 Digital Master Live)']){const calls=[];const c=createLastfmClient({env:{LASTFM_API_KEY:'fixture'},interval:0,fetcher:async url=>{calls.push(new URL(url).searchParams.get('track'));return{ok:true,json:async()=>({similartracks:{track:[]}})};}});await c.recommendations('music','Artist',title);assert.deepEqual(calls,[title]);}
});
