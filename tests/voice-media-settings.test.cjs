const {test}=require('node:test'),assert=require('node:assert/strict');
const api=require('../dist/voice/media-settings.js'),devices=require('../dist/voice/devices.js'),callFactory=require('../dist/voice/state.js'),peerFactory=require('../dist/voice/peer.js'),sessionFactory=require('../dist/voice/session.js'),mediaFactory=require('../dist/voice/media.js');
const tick=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
function track(kind='audio'){return {kind,id:Math.random().toString(),readyState:'live',enabled:true,contentHint:'',stop(){this.readyState='ended';}};}
function stream(...tracks){return {id:Math.random().toString(),getTracks:()=>tracks,getAudioTracks:()=>tracks.filter(t=>t.kind==='audio'),getVideoTracks:()=>tracks.filter(t=>t.kind==='video')};}
class PC {
 static instances=[];
 constructor(){PC.instances.push(this);this.signalingState='stable';this.entries=[];this.offers=0;}
 addTrack(track){const sender={track,params:{encodings:[{}]},calls:[],getParameters(){return structuredClone(this.params);},async setParameters(p){this.calls.push(p);if(this.fail)throw Error('unsupported');this.params=p;},async replaceTrack(t){this.track=t;}};this.entries.push({sender,mid:'0',currentDirection:'sendrecv'});return sender;}
 getTransceivers(){return this.entries;}
 removeTrack(){}
 async createOffer(){this.offers++;return {type:'offer',sdp:'mock'};}
 async setLocalDescription(d){this.localDescription=d;}
 close(){this.closed=true;}
}
function endpoint(settings=api.defaults){const mic=track(),video=track('video'),audio=track(),p=peerFactory({localStream:stream(mic),screenStream:stream(video,audio),mediaSettings:settings,Peer:PC,send(){},onStream(){},onState(){},onError(e){throw e;}});return {p,pc:PC.instances.at(-1),mic,video,audio};}
test('defaults and invalid persisted values normalize; manual overrides preset and automatic removes override',()=>{
 assert.deepEqual(api.normalize({}),api.defaults);
 assert.deepEqual(api.normalize({micBitrate:Infinity,screenVideoBitrate:'bad',screenContentHint:'music',micAutoGainControl:1}),api.defaults);
 assert.equal(api.encoding(api.defaults,'720p60')['screen-video'],4000000);
 assert.equal(api.encoding({...api.defaults,screenVideoBitrate:20000000},'720p60')['screen-video'],20000000);
 assert.equal(api.encoding({...api.defaults,screenVideoBitrate:null},'720p60')['screen-video'],null);
});
test('preferences reuse existing JSON storage and survive reload; invalid settings fall back',()=>{
 const saved=new Map(),storage={getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)};
 const d=devices({media:{},storage});d.setInput('usb');d.setMediaSettings({...api.defaults,micBitrate:48000,screenContentHint:'detail'});
 assert.equal(saved.size,1);assert.ok(saved.has('spacevoice-audio-preferences'));
 const loaded=devices({media:{},storage});assert.equal(loaded.preferences.mediaSettings.micBitrate,48000);assert.equal(loaded.preferences.preferredAudioInputId,'usb');
 loaded.setMediaSettings(api.defaults);assert.deepEqual(loaded.preferences.mediaSettings,api.defaults);
});
test('runtime applies each bitrate only to its purpose; automatic deletes ceilings; no new offer/PC',async()=>{
 const {p,pc}=endpoint();await p.start();await tick();const offers=pc.offers,count=PC.instances.length;
 await p.setMediaSettings({...api.defaults,micBitrate:64000,screenAudioBitrate:256000,screenVideoBitrate:14000000});
 assert.deepEqual(pc.entries.map(e=>e.sender.params.encodings[0].maxBitrate),[64000,14000000,256000]);
 const videoCalls=pc.entries[1].sender.calls.length,audioCalls=pc.entries[2].sender.calls.length;
 await p.setMediaSettings({...api.defaults,micBitrate:32000,screenAudioBitrate:256000,screenVideoBitrate:14000000});
 assert.equal(pc.entries[1].sender.calls.length,videoCalls);assert.equal(pc.entries[2].sender.calls.length,audioCalls);
 await p.setMediaSettings({...api.defaults,screenVideoBitrate:null});
 assert.ok(!('maxBitrate' in pc.entries[0].sender.params.encodings[0]));assert.ok(!('maxBitrate' in pc.entries[1].sender.params.encodings[0]));
 assert.equal(pc.offers,offers);assert.equal(PC.instances.length,count);p.close();
});
test('unsupported/rejected setParameters is nonfatal and mic falls back to automatic',async()=>{
 const {p,pc}=endpoint();pc.entries[0].sender.fail=true;pc.entries[1].sender.setParameters=undefined;
 await p.setMediaSettings({...api.defaults,micBitrate:96000});assert.equal(pc.closed,undefined);assert.equal(pc.entries[2].sender.params.encodings[0].maxBitrate,192000);p.close();
});
test('contentHint detail/motion and unsupported hint do not restart screen',async()=>{
 const {p,video,pc}=endpoint();const original=pc.entries[1].sender.track;
 await p.setMediaSettings({...api.defaults,screenContentHint:'detail'});assert.equal(video.contentHint,'detail');
 await p.setMediaSettings(api.defaults);assert.equal(video.contentHint,'motion');assert.equal(pc.entries[1].sender.track,original);
 api.hint({},'motion');api.hint(Object.defineProperty({},'contentHint',{set(){throw Error();}}),'detail');p.close();
});
function callFixture({apply,replaceFail=false,captureFail=false}={}) {
 const old=track(),next=track();let captures=0,replaces=0,settings={...api.defaults};
 old.getConstraints=()=>({deviceId:{exact:'usb'}});if(apply)old.applyConstraints=apply;
 const media={acquire:async(id,processing)=>{captures++;assert.equal(processing.echoCancellation,settings.micEchoCancellation);if(captures>1&&captureFail)throw Error();return captures===1?stream(old):stream(next);},mute:(s,m)=>s.getAudioTracks().forEach(t=>t.enabled=!m),release:s=>s?.getTracks().forEach(t=>t.stop())};
 const call=callFactory(media,{microphoneSettings:()=>api.constraints(settings),replaceMicrophone:async()=>{replaces++;assert.equal(old.readyState,'live');if(replaceFail)throw Error();}});
 return {call,old,next,set:value=>settings=value,counts:()=>({captures,replaces})};
}
test('mic EC/NS/AGC runtime constraints keep active stream and current device',async()=>{
 let received;const f=callFixture({apply:async c=>received=c});await f.call.join();const before=f.call.state.localStream;
 f.set({...api.defaults,micEchoCancellation:false,micNoiseSuppression:false,micAutoGainControl:false});
 assert.equal(await f.call.applyMicrophoneSettings({echoCancellation:false,noiseSuppression:false,autoGainControl:false}),true);
 assert.deepEqual(received,{deviceId:{exact:'usb'},echoCancellation:false,noiseSuppression:false,autoGainControl:false});assert.equal(f.call.state.localStream,before);assert.deepEqual(f.counts(),{captures:1,replaces:0});f.call.leave();
});
test('failed or unavailable applyConstraints captures once, replaces before stopping old mic and keeps mute',async()=>{
 for(const apply of [undefined,async()=>{throw Error();}]) {
 const f=callFixture({apply});await f.call.join();f.call.toggleMute();f.set({...api.defaults,micEchoCancellation:false});
 assert.equal(await f.call.applyMicrophoneSettings(api.constraints({...api.defaults,micEchoCancellation:false})),true);
 assert.deepEqual(f.counts(),{captures:2,replaces:1});assert.equal(f.old.readyState,'ended');assert.equal(f.next.enabled,false);f.call.leave();}
});
test('failed replacement or capture retains old live mic; replacement failure stops candidate',async()=>{
 for(const options of [{replaceFail:true},{captureFail:true}]) {const f=callFixture(options);await f.call.join();const before=f.call.state.localStream;
 assert.equal(await f.call.applyMicrophoneSettings(api.constraints(api.defaults)),false);assert.equal(f.call.state.localStream,before);assert.equal(f.old.readyState,'live');if(options.replaceFail)assert.equal(f.next.readyState,'ended');f.call.leave();}
});
test('constraints resolving after leave cannot capture/revive microphone',async()=>{
 let resolve;const f=callFixture({apply:()=>new Promise(r=>resolve=r)});await f.call.join();const pending=f.call.applyMicrophoneSettings(api.constraints(api.defaults));f.call.leave();resolve();assert.equal(await pending,false);assert.equal(f.counts().captures,1);
});
test('late join and reconnect receive current settings; reset uses current preset',async()=>{
 let receive;const created=[];
 const s=sessionFactory({clientId:'a',signaling:options=>{receive=options.onMessage;return {send(){},close(){}};},peer:options=>{created.push(options);return {start(){},close(){},async setMediaSettings(v,p){options.mediaSettings=v;options.screenPreset=p;}};},onPeers(){},onStream(){},onRemove(){},onError(){}});
 const value={...api.defaults,micBitrate:48000,screenAudioBitrate:256000,screenVideoBitrate:14000000};
 await s.setMediaSettings(value,'1440p60');s.start(stream(track()),'geral');receive({type:'join',from:'b',payload:{}});
 assert.deepEqual(created[0].mediaSettings,value);assert.equal(created[0].screenPreset,'1440p60');
 await s.setMediaSettings(api.defaults,'720p60');assert.equal(api.encoding(created[0].mediaSettings,created[0].screenPreset)['screen-video'],4000000);
 receive({type:'leave',from:'b'});receive({type:'join',from:'b',payload:{}});assert.deepEqual(created[1].mediaSettings,api.defaults);s.close();
});
test('capture separates microphone processing and screen media audio; motion is default',async()=>{
 let user,display;const video=track('video'),audio=track();
 const media=mediaFactory({secureContext:true,mediaDevices:{async getUserMedia(c){user=c;return stream(track());},async getDisplayMedia(c){display=c;return stream(video,audio);}}});
 await media.acquire('usb',api.constraints({...api.defaults,micAutoGainControl:false}));assert.equal(user.audio.autoGainControl,false);
 await media.acquireScreen('720p60');assert.equal(display.video.width.ideal,1280);assert.equal(display.audio.echoCancellation,false);assert.equal(display.audio.noiseSuppression,false);assert.equal(display.audio.autoGainControl,false);assert.equal(audio.contentHint,'music');assert.equal(video.contentHint,'motion');
});
const {test:extraTest}=require('node:test');
extraTest('reset applies microphone automatic, screen audio default, current preset video and motion to active senders',async()=>{
 const {p,pc,video}=endpoint({...api.defaults,micBitrate:96000,screenAudioBitrate:256000,screenVideoBitrate:20000000,screenContentHint:'detail'});
 await p.setMediaSettings({...api.defaults,micBitrate:96000,screenAudioBitrate:256000,screenVideoBitrate:20000000,screenContentHint:'detail'},'720p60');
 await p.setMediaSettings(api.defaults,'720p60');
 assert.deepEqual(pc.entries.map(e=>e.sender.params.encodings[0].maxBitrate),[undefined,4000000,192000]);assert.equal(video.contentHint,'motion');p.close();
});
extraTest('silently ignored runtime constraints trigger replacement; failed fallback restores previous constraints',async()=>{
 const applied=[];const f=callFixture({apply:async c=>applied.push(c),replaceFail:true});await f.call.join();
 f.old.getSettings=()=>({echoCancellation:true});f.set({...api.defaults,micEchoCancellation:false});
 assert.equal(await f.call.applyMicrophoneSettings(api.constraints({...api.defaults,micEchoCancellation:false})),false);
 assert.equal(applied.length,2);assert.deepEqual(applied.at(-1),{deviceId:{exact:'usb'}});assert.equal(f.old.readyState,'live');f.call.leave();
});
