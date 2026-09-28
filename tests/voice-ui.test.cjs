const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm'), fs = require('node:fs');
const createVoiceCall = require('../dist/voice/state.js');
test('remote stream is played, deafen mutes playback only, leave removes audio and participants', async () => {
  class Node {
    constructor(tag, cls, text) { this.tag=tag;this.className=cls;this.textContent=text;this.children=[];this.dataset={};this.hidden=false; }
    append(...nodes) { nodes.forEach(n=>{n.parent=this;this.children.push(n);}); }
    replaceChildren(...nodes) { this.children=[];this.append(...nodes); }
    setAttribute(key,value) { this[key]=value; }
    remove() { this.parent.children=this.parent.children.filter(n=>n!==this); }
    play() { this.played=true;return Promise.resolve(); }
    pause() { this.paused=true; }
  }
  const localTrack={enabled:true,label:'mic'},localStream={getAudioTracks:()=>[localTrack]};
  let hooks, closed=0, released=0;
  const ctx={createVoiceCall,createVoiceMedia:()=>({acquire:async()=>localStream,release:s=>{if(s)released++;},mute:(s,m)=>{localTrack.enabled=!m;}}),
    createVoiceSession:options=>{hooks=options;return {start(){},close(){closed++;hooks.onRemove('b');hooks.onRemove('c');hooks.onPeers([]);}};},
    window:{addEventListener(){}},Date,Math,URLSearchParams};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync('dist/spacevoice.js','utf8'),ctx);
  const ui=ctx.createSpaceVoice({getProfile:()=>({name:'Me'}),el:(...args)=>new Node(...args),button:(text,onclick)=>{const n=new Node('button','',text);n.onclick=onclick;return n;}});
  await ui.call.join();
  hooks.onPeers([{id:'b',status:'conectado'},{id:'c',status:'conectado'}]);
  const remote={}; hooks.onStream('b',remote); hooks.onStream('c',{});
  const audios=ui.root.children.filter(n=>n.tag==='audio');assert.equal(audios.length,2);
  const audio=audios[0];
  hooks.onScreen('b',{});hooks.onScreen('c',{});
  const find=(node,tag)=>[...(node.tag===tag?[node]:[]),...node.children.flatMap(child=>find(child,tag))];
  const videos=find(ui.root,'video');assert.equal(videos.length,2);
  assert.equal(audio.srcObject,remote);assert.equal(audio.autoplay,true);assert.equal(audio.played,true);
  ui.call.toggleDeafen();assert.ok(audios.every(a=>a.muted));assert.equal(localTrack.enabled,true);
  assert.ok(videos.every(v=>v.muted));
  ui.call.toggleDeafen();assert.equal(audio.muted,false);
  ui.call.toggleMute();assert.equal(localTrack.enabled,false);assert.equal(audio.muted,false);
  hooks.onRemove('b');assert.ok(ui.root.children.includes(audios[1]));assert.ok(!ui.root.children.includes(audio));
  assert.equal(find(ui.root,'video').length,1);assert.equal(videos[0].srcObject,null);
  ui.leave();assert.ok(audios.every(a=>a.srcObject===null&&a.paused));assert.equal(audio.srcObject,null);assert.equal(audio.paused,true);assert.ok(!ui.root.children.includes(audio));assert.equal(released,1);assert.ok(closed>0);
});
