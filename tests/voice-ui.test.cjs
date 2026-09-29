const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm'), fs = require('node:fs');
const createVoiceCall = require('../dist/voice/state.js');
test('remote stream is played, deafen mutes playback only, leave removes audio and participants', async () => {
  class Node {
    constructor(tag, cls, text) { this.tag=tag;this.className=cls;this.textContent=text;this.children=[];this.dataset={};this.hidden=false; }
    append(...nodes) { nodes.forEach(n=>{if(n.parent)n.parent.children=n.parent.children.filter(child=>child!==n);n.parent=this;this.children.push(n);}); }
    replaceChildren(...nodes) { this.children=[];this.append(...nodes); }
    setAttribute(key,value) { this[key]=value; }
    remove() { this.parent.children=this.parent.children.filter(n=>n!==this); }
    play() { this.played=true;return Promise.resolve(); }
    pause() { this.paused=true; }
    async setSinkId(id) { this.sinkId=id; }
  }
  const localTrack={enabled:true,label:'mic'},localStream={getAudioTracks:()=>[localTrack]};
  let hooks, closed=0, released=0;
  const ctx={createVoiceChat:require('../dist/voice/chat.js'),createVoiceCall,createVoiceDevices:options=>require('../dist/voice/devices.js')({...options,sinkSupported:true}),createVoiceLevels:require('../dist/voice/levels.js'),createVoiceMedia:()=>({enumerate:async()=>({inputs:[],outputs:[]}),watchDevices:()=>()=>{},acquire:async()=>localStream,release:s=>{if(s)released++;},mute:(s,m)=>{localTrack.enabled=!m;}}),
    createVoiceSession:options=>{hooks=options;return {start(){},sendApplication(){return true;},close(){closed++;hooks.onRemove('b');hooks.onRemove('c');hooks.onPeers([]);}};},
    window:{addEventListener(){}},Date,Math,URLSearchParams};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync('dist/spacevoice.js','utf8'),ctx);
  const ui=ctx.createSpaceVoice({getProfile:()=>({name:'Me'}),el:(...args)=>new Node(...args),button:(text,onclick)=>{const n=new Node('button','',text);n.onclick=onclick;return n;}});
  assert.equal(ui.root.children.find(n=>n.className==='spacevoice-functional-area').children.find(n=>n.className==='spacevoice-controls').hidden,true);
  await ui.call.join();
  assert.equal(ui.root['aria-label'],'PARTY');
  assert.equal(ui.root.dataset.mode,'voice');
  assert.equal(ui.root.dataset.chatOpen,'false');
  hooks.onPeers([{id:'b',status:'conectado'},{id:'c',status:'conectado'}]);
  const remote={}; hooks.onStream('b',remote); hooks.onStream('c',{});
  const audios=ui.root.children.filter(n=>n.tag==='audio');assert.equal(audios.length,2);
  const audio=audios[0];
  const screenStream={getVideoTracks:()=>[{getSettings:()=>({width:1280,height:720,frameRate:30})}],getAudioTracks:()=>[{}]};
  hooks.onScreen('b',screenStream);hooks.onScreen('c',{});
  const find=(node,tag)=>[...(node.tag===tag?[node]:[]),...node.children.flatMap(child=>find(child,tag))];
  const videos=find(ui.root,'video');assert.equal(videos.length,2);
  assert.ok(videos.every(v=>v.controls===false&&v.autoplay&&v.playsInline));
  assert.equal(find(ui.root,'p').find(n=>n.className==='spacevoice-share-facts').textContent,'1280×720 · 30 fps · áudio ✓');
  const shareHeader=find(ui.root,'div').find(n=>n.className==='spacevoice-share-header');
  assert.ok(find(shareHeader,'button').some(n=>n['aria-label']==='Tela cheia'));
  assert.equal(find(shareHeader,'button').find(n=>n.textContent==='[ parar compartilhamento ]').hidden,true);
  const fitButton=find(shareHeader,'button').find(n=>n.dataset.icon==='fit');
  fitButton.onclick();assert.equal(find(ui.root,'div').find(n=>n.className==='spacevoice-screen-viewer').dataset.fit,'cover');
  fitButton.onclick();
  assert.equal(ui.root.dataset.mode,'screen');
  assert.equal(ui.root.dataset.chatOpen,'true');
  const toggle=find(ui.root,'button').find(n=>n['aria-expanded']);
  toggle.onclick();assert.equal(ui.root.dataset.chatOpen,'false');toggle.onclick();
  assert.equal(videos[0].srcObject,screenStream);assert.deepEqual(find(ui.root,'video'),videos);
  const tabs=find(ui.root,'div').find(n=>n.className==='spacevoice-screen-tabs');
  tabs.children[1].onclick();
  const facts=find(ui.root,'p').find(n=>n.className==='spacevoice-share-facts');
  assert.equal(facts.textContent,'');assert.equal(facts.hidden,true);
  tabs.children[0].onclick();assert.equal(videos[0].srcObject,screenStream);
  find(shareHeader,'button').find(n=>n.textContent==='[ sair do foco ]').onclick();
  assert.equal(ui.root.dataset.mode,'voice');assert.equal(videos[0].srcObject,screenStream);
  find(ui.root,'button').find(n=>n.textContent==='[ ver telas ]').onclick();
  assert.equal(ui.root.dataset.mode,'screen');assert.equal(videos[0].srcObject,screenStream);
  assert.equal(find(ui.root,'div').filter(n=>n.className==='spacevoice-avatar').length,3);
  const log=find(ui.root,'div').find(n=>n.className==='spacevoice-chat-log');log.scrollHeight=1000;log.clientHeight=200;log.scrollTop=0;log.onscroll();
  assert.equal(log.dataset.empty,'true');
  hooks.onStatus('conectado');
  const message={type:'chat-message',roomId:'geral',from:'b',payload:{id:'chat-1',roomId:'geral',authorId:'b',authorName:'<img onerror=alert(1)>',text:'<script>alert(1)</script>',createdAt:Date.now()}};
  hooks.onApplication(message);hooks.onApplication(message);
  assert.equal(log.dataset.empty,'false');
  assert.equal(log.children.length,1);assert.equal(log.children[0].children[2].textContent,'<script>alert(1)</script>');assert.equal(log.children[0].children[1].textContent,'<img onerror=alert(1)>: ');
  assert.equal(log.scrollTop,0);assert.equal(ui.chat.state.unread,1);assert.deepEqual(find(ui.root,'video'),videos);assert.deepEqual(ui.root.children.filter(n=>n.tag==='audio'),audios);assert.equal(audio.srcObject,remote);
  const composer=find(ui.root,'textarea')[0];composer.value='draft typed';composer.oninput();assert.equal(composer.value,'draft typed');assert.equal(ui.chat.state.draft,'draft typed');
  const panel=find(ui.root,'aside').find(n=>n.className==='spacevoice-chat');
  toggle.onclick();assert.equal(panel.inert,true);assert.equal(panel.hidden,false);
  toggle.onclick();assert.equal(panel.inert,false);assert.equal(log.scrollTop,0);assert.equal(composer.value,'draft typed');
  assert.equal(find(ui.root,'textarea')[0],composer);assert.equal(videos[0].srcObject,screenStream);
  const ranges=find(ui.root,'input').filter(n=>n.type==='range');ranges[0].value='25';ranges[0].oninput();
  assert.equal(audios[0].volume,.25);assert.equal(videos[0].volume,.25);assert.equal(audios[1].volume,1);assert.equal(videos[1].volume,1);
  const output=find(ui.root,'select').find(n=>n['aria-label']==='Saída de áudio');output.value='headphones';output.onchange();for(let i=0;i<30;i++)await Promise.resolve();
  assert.ok([...audios,...videos].every(n=>n.sinkId==='headphones'));
  assert.equal(audio.srcObject,remote);assert.equal(audio.autoplay,true);assert.equal(audio.played,true);
  ui.call.toggleDeafen();assert.ok(audios.every(a=>a.muted));assert.equal(localTrack.enabled,true);
  assert.ok(videos.every(v=>v.muted));
  ui.call.toggleDeafen();assert.equal(audio.muted,false);
  assert.equal(audio.volume,.25);assert.equal(videos[0].volume,.25);
  ui.call.toggleMute();assert.equal(localTrack.enabled,false);assert.equal(audio.muted,false);
  assert.ok(find(ui.root,'span').some(n=>n.textContent==='× mutado'));
  hooks.onPeers([{id:'b',status:'conectado',micMuted:true},{id:'c',status:'conectado'}]);
  assert.equal(find(ui.root,'span').filter(n=>n.textContent==='× mutado').length,2);
  hooks.onPeers([{id:'b',status:'conectado',micMuted:false},{id:'c',status:'conectado'}]);
  assert.equal(find(ui.root,'span').filter(n=>n.textContent==='× mutado').length,1);
  hooks.onRemove('b');assert.ok(ui.root.children.includes(audios[1]));assert.ok(!ui.root.children.includes(audio));
  assert.equal(find(ui.root,'video').length,1);assert.equal(videos[0].srcObject,null);
  ui.leave();assert.ok(audios.every(a=>a.srcObject===null&&a.paused));assert.equal(audio.srcObject,null);assert.equal(audio.paused,true);assert.ok(!ui.root.children.includes(audio));assert.equal(released,1);assert.ok(closed>0);
  assert.equal(ui.root.dataset.mode,'voice');
});
