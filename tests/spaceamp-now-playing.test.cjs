const {test}=require('node:test'),assert=require('node:assert/strict');
const core=require('../dist/spaceamp.js'),api=require('../dist/spaceamp-integrations.js');
test('Core clock reads existing adapter directly; no elapsed wall clock or second player',()=>{
 const a=core.create(),clock={position:34.25,duration:150};
 a.progress({position:9,duration:20});assert.deepEqual(a.getPlaybackTime(),{position:9,duration:20});
 a.configure({getPlaybackTime:()=>clock});assert.equal(a.getPlaybackTime(),clock);
 clock.position=72;assert.equal(a.getPlaybackTime().position,72);
 const t=core.track({title:'Track',album:'cover.png',albumTitle:'Album',isrc:'TEST123'});
 assert.equal(t.albumTitle,'Album');assert.equal(t.isrc,'TEST123');
});
test('YouTube clock/seek use only the existing adapter player and ignore disposed state',async()=>{
 let events,player,created=0;class Player{constructor(_,{events:e}){events=e;player=this;created++;}getVideoUrl(){return ''}getPlayerState(){return 2}getCurrentTime(){return 25.5}getDuration(){return 200}seekTo(t,allow){this.seek=[t,allow]}destroy(){}}
 const a=api.youtube({iframe:{isConnected:true},load:async()=>({Player})});
 assert.deepEqual(a.getPlaybackTime(),{position:0,duration:0});a.seek(15);await Promise.resolve();events.onReady({target:player});
 assert.deepEqual(a.getPlaybackTime(),{position:25.5,duration:200});a.seek(42);assert.deepEqual(player.seek,[42,true]);a.seek(NaN);assert.deepEqual(player.seek,[42,true]);
 a.close();a.seek(66);assert.deepEqual(player.seek,[42,true]);assert.equal(a.getPlaybackTime().position,0);assert.equal(created,1);
});
