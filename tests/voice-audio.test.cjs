const {test}=require('node:test'), assert=require('node:assert/strict');
const createMedia=require('../dist/voice/media.js'), createCall=require('../dist/voice/state.js');
const createDevices=require('../dist/voice/devices.js'), createLevels=require('../dist/voice/levels.js');
const createPeer=require('../dist/voice/peer.js'), createSession=require('../dist/voice/session.js');
const local=require('../dist/voice/signaling-local.js');
const tick=async()=>{for(let i=0;i<80;i++)await Promise.resolve();};
let serial=0;
class Track {
  constructor(deviceId='default'){this.id='audio-'+serial++;this.deviceId=deviceId;this.kind='audio';this.enabled=true;this.readyState='live';this.listeners=new Set();}
  getSettings(){return {deviceId:this.deviceId};}
  addEventListener(_,fn){this.listeners.add(fn);} removeEventListener(_,fn){this.listeners.delete(fn);}
  stop(){this.readyState='ended';} ended(){this.stop();for(const fn of this.listeners)fn();}
}
class Stream {
  constructor(track=new Track()){this.id='stream-'+serial++;this.track=track;}
  getAudioTracks(){return [this.track];} getTracks(){return [this.track];}
}
const storageFixture=(data={})=>{let stored=JSON.stringify(data);return {getItem:()=>stored,setItem:(_,v)=>{stored=v;},read:()=>JSON.parse(stored)};};
function sessionFixture(){
  let receive;const controllers=[],messages=[];
  const session=createSession({clientId:'a',signaling:o=>{receive=o.onMessage;return {send:(...m)=>messages.push(m),close(){}};},
    peer:o=>{const c={stream:o.localStream,opts:o,replacements:[],start(){},close(){this.closed=true;},receive(...v){this.received=v;},async replaceMicrophone(s){this.replacements.push(s);if(this.fail?.(s))throw Error('replace failed');if(this.pending)await this.pending;this.stream=s;}};controllers.push(c);return c;},onPeers(){},onRemove(){},onStream(){},onError:e=>assert.fail(e)});
  const previous=new Stream();session.start(previous,'geral');receive({type:'peers',payload:{peers:['b','c']}});
  return {session,controllers,previous,messages,receive:m=>receive(m)};
}
test('enumeration classifies input/output, tolerates concealed labels/IDs and never requests permission',async()=>{
  let capture=0;const media=createMedia({mediaDevices:{enumerateDevices:async()=>[{kind:'audioinput',deviceId:'',label:''},{kind:'audiooutput',deviceId:'out',label:''},{kind:'videoinput',deviceId:'cam'}],getUserMedia(){capture++;}}});
  const list=await media.enumerate();assert.equal(list.inputs.length,1);assert.equal(list.outputs.length,1);assert.equal(capture,0);
  const devices=createDevices({media:{...media,watchDevices:()=>()=>{}},storage:storageFixture(),sinkSupported:false});await devices.start();assert.equal(devices.inputs[0].label,'');devices.stop();
});
test('devicechange has one listener, refreshes lists, corrects missing saved devices and cleans subscription',async()=>{
  let listener,removed=0,list=[{kind:'audioinput',deviceId:'mic2',label:'USB'},{kind:'audiooutput',deviceId:'out2'}];
  const storage=storageFixture({preferredAudioInputId:'gone',preferredAudioOutputId:'gone'});
  const media=createMedia({mediaDevices:{enumerateDevices:async()=>list,addEventListener:(type,fn)=>{assert.equal(type,'devicechange');assert.ok(!listener);listener=fn;},removeEventListener:(type,fn)=>{assert.equal(listener,fn);listener=null;removed++;}}});
  const d=createDevices({media,storage,sinkSupported:true});await d.start();await d.start();assert.equal(d.preferences.preferredAudioInputId,'');assert.equal(d.preferences.preferredAudioOutputId,'');
  list=[{kind:'audioinput',deviceId:'new'}];listener();await tick();assert.equal(d.inputs[0].deviceId,'new');d.stop();assert.equal(listener,null);assert.equal(removed,1);
  await d.start();assert.ok(listener);d.stop();
});
test('selected input is persisted before joining and captured with exact deviceId',async()=>{
  const options=[],saved=[];const media=createMedia({secureContext:true,mediaDevices:{getUserMedia:async o=>{options.push(o);return new Stream(new Track('usb'));}}});
  const call=createCall(media,{onInput:id=>saved.push(id)});await call.switchMicrophone('usb');assert.equal(options.length,0);await call.join();
  assert.deepEqual(options,[{audio:{deviceId:{exact:'usb'}}}]);assert.equal(saved.at(-1),'usb');call.leave();
});
test('a stale input preference retries default at join without blocking the call',async()=>{
  let requests=0;const saved=[];const media=createMedia({secureContext:true,mediaDevices:{getUserMedia:async o=>{requests++;if(o.audio.deviceId)throw Object.assign(Error(),{name:'OverconstrainedError'});return new Stream();}}});
  const call=createCall(media,{inputId:'gone',onInput:id=>saved.push(id)});await call.join();assert.ok(call.state.joined);assert.equal(requests,2);assert.equal(saved.at(-1),'');call.leave();
});
test('one runtime capture replaces all peers atomically, preserves mute and stops old track only after success',async()=>{
  const f=sessionFixture(),next=new Stream(new Track('usb'));let requests=0;
  const media={acquire:async()=>{requests++;return requests===1?f.previous:next;},release:s=>s?.getTracks().forEach(t=>t.stop()),mute:(s,m)=>s.getAudioTracks().forEach(t=>t.enabled=!m)};
  const call=createCall(media,{replaceMicrophone:s=>f.session.replaceMicrophone(s)});await call.join();call.toggleMute();
  let commit;f.controllers[0].pending=new Promise(r=>commit=r);
  const change=call.switchMicrophone('usb');await tick();assert.equal(f.previous.track.readyState,'live');assert.equal(next.track.enabled,false);assert.ok(!f.controllers.some(c=>c.closed));
  commit();await change;assert.equal(requests,2);assert.equal(f.previous.track.readyState,'ended');assert.ok(f.controllers.every(c=>c.stream===next&&c.replacements.length===1));assert.equal(call.state.localStream,next);call.leave();f.session.close();
});
test('capture failure retains microphone and preference, leaves screen untouched',async()=>{
  const old=new Stream();let fail=false;const saved=[];
  const call=createCall({acquire:async()=>{if(fail)throw Error('capture');return old;},release:s=>s?.track.stop(),mute(){}},{inputId:'old',onInput:id=>saved.push(id)});
  await call.join();const screen={};call.state.screenStream=screen;fail=true;
  assert.equal(await call.switchMicrophone('bad'),false);assert.equal(call.state.localStream,old);assert.equal(old.track.readyState,'live');assert.equal(call.state.inputId,'old');assert.equal(saved.length,0);assert.equal(call.state.screenStream,screen);call.state.screenStream=null;call.leave();
});
test('partial replace failure rolls successful peers back before rejecting and permits retry',async()=>{
  const f=sessionFixture(),next=new Stream();f.controllers[1].fail=s=>s===next;
  await assert.rejects(f.session.replaceMicrophone(next));assert.ok(f.controllers.every(c=>c.stream===f.previous&&!c.closed));assert.deepEqual(f.controllers[0].replacements,[next,f.previous]);
  f.controllers[1].fail=null;await f.session.replaceMicrophone(next);assert.ok(f.controllers.every(c=>c.stream===next));f.session.close();
});
test('failed native rollback rebuilds only its pair with the previous microphone',async()=>{
  const f=sessionFixture(),next=new Stream();f.controllers[1].fail=()=>true;
  await assert.rejects(f.session.replaceMicrophone(next));assert.ok(!f.controllers[0].closed);assert.ok(f.controllers[1].closed);assert.equal(f.controllers.length,3);assert.equal(f.controllers[2].stream,f.previous);f.session.close();
});
test('late join during mic transaction buffers SDP/ICE and uses committed capture',async()=>{
  const f=sessionFixture(),next=new Stream();let finish;f.controllers[0].pending=new Promise(r=>finish=r);
  const change=f.session.replaceMicrophone(next);await tick();f.receive({type:'join',from:'d',payload:{reply:true}});f.receive({type:'offer',from:'d',payload:{type:'offer',sdp:'pending'}});
  assert.equal(f.controllers.length,2);finish();await change;assert.equal(f.controllers.length,3);assert.equal(f.controllers[2].stream,next);assert.equal(f.controllers[2].received[0],'offer');f.session.close();
});
test('leave during pending capture stops late result and cannot resurrect a session',async()=>{
  const old=new Stream(),next=new Stream();let finish,requests=0;
  const call=createCall({acquire:()=>++requests===1?Promise.resolve(old):new Promise(r=>finish=r),release:s=>s?.track.stop(),mute(){}});
  await call.join();const pending=call.switchMicrophone('usb');call.leave();finish(next);await pending;assert.equal(next.track.readyState,'ended');assert.ok(!call.state.joined);assert.equal(call.state.localStream,null);
});
test('ended microphone falls back once to default without closing peers, failure remains unavailable without looping',async()=>{
  for(const fail of [false,true]){
    const old=new Stream(new Track('usb')),next=new Stream();let requests=0,replacements=0;
    const call=createCall({acquire:async id=>{requests++;if(requests===1)return old;assert.equal(id,'');if(fail)throw Error('no mic');return next;},release:s=>s?.track.stop(),mute(){}},{replaceMicrophone:async()=>{replacements++;}});
    await call.join();old.track.ended();await tick();assert.ok(call.state.joined);assert.equal(requests,2);assert.equal(call.state.micUnavailable,fail);assert.equal(replacements,fail?0:1);
    if(fail){await call.recoverMicrophone();assert.equal(requests,2);}call.leave();
  }
});
test('native sender replacement changes only microphone with no add/remove/offer or new PC',async()=>{
  let instances=0,offers=0,replaced=0;const tracks=[],senders=[];
  class PC{constructor(){instances++;}addTrack(t){tracks.push(t);const s={track:t,replaceTrack:async t=>{s.track=t;replaced++;}};senders.push(s);return s;}createOffer(){offers++;}close(){}}
  const old=new Stream(),next=new Stream(),screen={getVideoTracks:()=>[{id:'video',kind:'video'}],getAudioTracks:()=>[{id:'system',kind:'audio'}]};
  const p=createPeer({localStream:old,screenStream:screen,Peer:PC,onStream(){},onState(){},onError:e=>assert.fail(e)});
  await p.replaceMicrophone(next);assert.equal(instances,1);assert.equal(replaced,1);assert.equal(offers,0);assert.equal(tracks.length,3);assert.equal(senders[0].track,next.track);assert.equal(senders[1].track.id,'video');assert.equal(senders[2].track.id,'system');p.close();
});
test('output selection applies voice and screen, new elements inherit it; unsupported API is harmless',async()=>{
  const storage=storageFixture(),d=createDevices({media:{},storage,sinkSupported:true}),calls=[];
  const voice={setSinkId:async id=>calls.push(['voice',id])},screen={setSinkId:async id=>calls.push(['screen',id])};
  assert.ok(await d.setOutput('headphones',[voice,screen]));await d.route({setSinkId:async id=>calls.push(['late',id])});assert.deepEqual(calls,[['voice','headphones'],['screen','headphones'],['late','headphones']]);assert.equal(storage.read().preferredAudioOutputId,'headphones');
  const unsupported=createDevices({media:{},storage,sinkSupported:false});assert.equal(await unsupported.setOutput('x',[voice]),false);await unsupported.route(voice);assert.equal(calls.length,3);
});
test('output failure rolls elements back and does not persist invalid device; JSON settings contain only preferences',async()=>{
  const storage=storageFixture({preferredAudioOutputId:'old'}),d=createDevices({media:{},storage,sinkSupported:true}),calls=[];
  const good={setSinkId:async id=>calls.push(id)},bad={setSinkId:async id=>{if(id==='bad')throw Error('Denied');}};
  assert.equal(await d.setOutput('bad',[good,bad]),false);assert.deepEqual(calls,['bad','old']);assert.equal(d.preferences.preferredAudioOutputId,'old');d.setVolume('peer',.1);
  assert.deepEqual(Object.keys(storage.read()).sort(),['preferredAudioInputId','preferredAudioOutputId','remoteVolumes']);assert.equal(d.volume('peer'),.1);d.setVolume('peer',0);assert.equal(d.volume('peer'),0);
});
function levelsFixture(){
  const contexts=[],intervals=new Set(),connections=[];let next=0;
  class Context{
    constructor(){contexts.push(this);this.state='running';this.nodes=[];this.destination={destination:true};}
    createMediaStreamSource(stream){const n={stream,connect:node=>connections.push([n,node]),disconnect(){n.disconnected=true;}};this.nodes.push(n);return n;}
    createAnalyser(){const n={rms:0,fftSize:0,getFloatTimeDomainData:s=>s.fill(n.rms),disconnect(){n.disconnected=true;}};this.nodes.push(n);return n;}
    async close(){this.state='closed';}async resume(){this.state='running';}
  }
  const levels=createLevels({Context,interval:()=>{intervals.add(++next);return next;},cancel:id=>intervals.delete(id)});levels.start();levels.start();
  return {levels,contexts,intervals,connections,analyser:()=>contexts[0].nodes.filter(n=>n.getFloatTimeDomainData)};
}
test('shared AudioContext uses isolated per-voice analysers without destination connection; smoothing and attack/release reject flicker',()=>{
  const f=levelsFixture(),values=[],remote=[];f.levels.monitor('local',new Stream(),v=>values.push(v));f.levels.monitor('remote',new Stream(),v=>remote.push(v));
  assert.equal(f.contexts.length,1);assert.equal(f.connections.length,2);assert.ok(f.connections.every(([,node])=>!node.destination));
  const [a,b]=f.analyser();a.rms=.05;b.rms=.001;f.levels.sample(0);f.levels.sample(50);assert.ok(!values.at(-1).speaking);f.levels.sample(100);assert.ok(values.at(-1).speaking);assert.ok(!remote.at(-1).speaking);assert.ok(values.at(-1).level>0&&values.at(-1).level<=1);
  a.rms=0;f.levels.sample(150);assert.ok(values.at(-1).speaking);const high=values.at(-1).level;f.levels.sample(500);assert.ok(values.at(-1).speaking);f.levels.sample(550);assert.ok(!values.at(-1).speaking);assert.ok(values.at(-1).level<high);
  f.levels.stop();assert.equal(f.contexts[0].state,'closed');assert.equal(f.intervals.size,0);assert.ok(f.contexts[0].nodes.every(n=>n.disconnected));
});
test('local/remote mute immediately suppresses speaking, playback volume never enters detector, replacement/reentry cannot duplicate monitors',()=>{
  const f=levelsFixture(),stream=new Stream(),values=[];f.levels.monitor('voice',stream,v=>values.push(v));f.levels.monitor('voice',stream,()=>assert.fail('duplicate'));assert.equal(f.levels.size,1);
  const a=f.analyser()[0];a.rms=.1;f.levels.sample(0);f.levels.sample(100);assert.ok(values.at(-1).speaking);f.levels.setMuted('voice',true);assert.deepEqual(values.at(-1),{level:0,speaking:false});f.levels.sample(200);assert.ok(!values.at(-1).speaking);
  f.levels.setMuted('voice',false);f.levels.sample(250);f.levels.sample(350);assert.ok(values.at(-1).speaking);
  const previousNodes=[...f.contexts[0].nodes];f.levels.monitor('voice',new Stream(),v=>values.push(v));assert.equal(f.levels.size,1);assert.ok(previousNodes.every(n=>n.disconnected));f.levels.stop();f.levels.start();f.levels.monitor('voice',new Stream(),()=>{});assert.equal(f.contexts.length,2);assert.equal(f.intervals.size,1);f.levels.stop();
});
test('mute metadata is explicit, late BC join/reentry receives current mute, invalid metadata cannot change it',async()=>{
  class Channel{static all=new Set();constructor(){Channel.all.add(this);}postMessage(data){for(const c of Channel.all)if(c!==this)queueMicrotask(()=>c.onmessage?.({data}));}close(){Channel.all.delete(this);}}
  const lists={};const make=id=>createSession({clientId:id,signaling:o=>local({...o,Channel}),peer:()=>({start(){},receive(){},close(){}}),onPeers:p=>lists[id]=p,onStream(){},onRemove(){},onError:e=>assert.fail(e)});
  const a=make('a'),b=make('b');a.start(new Stream(),'geral');a.setMuted(true);b.start(new Stream(),'geral');await tick();assert.equal(lists.b.find(p=>p.id==='a').micMuted,true);
  const malformed=new Channel();malformed.postMessage({type:'participant-state',roomId:'geral',from:'a',to:'b',payload:{micMuted:'false'}});await tick();assert.equal(lists.b[0].micMuted,true);malformed.close();
  a.setMuted(false);await tick();assert.equal(lists.b[0].micMuted,false);a.setMuted(true);b.close();await tick();b.start(new Stream(),'geral');await tick();assert.equal(lists.b[0].micMuted,true);a.close();b.close();assert.equal(Channel.all.size,0);
});
