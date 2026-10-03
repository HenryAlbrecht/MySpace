const {test}=require('node:test'),assert=require('node:assert/strict'),api=require('../dist/spaceamp-integrations.js');
test('YouTube completion advances once, ignores errors/stop/stale callbacks and queues play until ready',async()=>{
 let hooks,player,ends=0;class Player{constructor(frame,{events}){hooks=events;player=this;}getVideoUrl(){return 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';}getPlayerState(){return -1;}playVideo(){this.plays=(this.plays||0)+1;}stopVideo(){}destroy(){}}
 const adapter=api.youtube({iframe:{isConnected:true},load:async()=>({Player}),onEnded:()=>ends++});adapter.play();await Promise.resolve();hooks.onReady({target:player});assert.equal(player.plays,1);
 const emit=state=>hooks.onStateChange({target:player,data:state});emit(0);assert.equal(ends,0);emit(1);emit(0);emit(0);assert.equal(ends,1);emit(1);hooks.onError({target:player,data:100});assert.equal(ends,1);adapter.stop();emit(0);assert.equal(ends,1);emit(1);adapter.close();emit(0);assert.equal(ends,1);
});
test('Media Session publishes artwork/state independently and supported handlers call controls',async()=>{
 const actions={},called=[],session={setActionHandler:(name,fn)=>{if(name==='stop')throw Error('unsupported');actions[name]=fn;}};class Metadata{constructor(value){Object.assign(this,value);}}
 const m=api.mediaSession({session,Metadata,base:'http://localhost/',controls:Object.fromEntries(['play','pause','previoustrack','nexttrack'].map(name=>[name,()=>called.push(name)]))});
 m.update({title:'Blind',artist:'After',artwork:'cover.png'},{playing:true});assert.equal(session.playbackState,'playing');assert.deepEqual(session.metadata.artwork,[{src:'http://localhost/cover.png'}]);
 for(const fn of Object.values(actions))fn();assert.deepEqual(called,['play','pause','previoustrack','nexttrack']);
 m.update({title:'Next',artist:'Artist'},{playing:false});assert.equal(session.metadata.title,'Next');assert.equal(session.playbackState,'paused');m.update({},{stopped:true});assert.equal(session.metadata,null);assert.equal(session.playbackState,'none');
 assert.doesNotThrow(()=>api.mediaSession({session:{setActionHandler(){throw Error();}},Metadata}).update({}));
});
test('YouTube events confirm actual PLAYING, clear pause/end/error and dispose stale callbacks',async()=>{
 let hooks;const results=[];class Player{constructor(_iframe,{events}){hooks=events;}getVideoUrl(){return 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';}getPlayerState(){return -1;}playVideo(){this.played=true;}pauseVideo(){this.paused=true;}stopVideo(){}destroy(){this.destroyed=true;}}
 const adapter=api.youtube({iframe:{isConnected:true},load:async()=>({Player}),onState:s=>results.push(s)});await Promise.resolve();await Promise.resolve();const player=new Player({}, {events:hooks});hooks.onReady({target:player});assert.equal(results.at(-1).playing,false);
 hooks.onStateChange({target:player,data:3});assert.equal(results.at(-1).loading,true);hooks.onAutoplayBlocked({target:player});assert.equal(results.at(-1).blocked,true);assert.equal(results.at(-1).loading,false);
 hooks.onStateChange({target:player,data:1});assert.equal(results.at(-1).playing,true);assert.equal(results.at(-1).blocked,false);for(const state of [2,0,3,5]){hooks.onStateChange({target:player,data:state});assert.equal(results.at(-1).playing,false);}hooks.onError({target:player,data:100});assert.equal(results.at(-1).error,true);const count=results.length;adapter.close();hooks.onStateChange({target:player,data:1});assert.equal(results.length,count);
});
