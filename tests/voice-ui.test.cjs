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
    createVoiceSession:options=>{hooks=options;return {start(){},close(){closed++;hooks.onRemove('b');hooks.onPeers([]);}};},
    window:{addEventListener(){}},Date,Math,URLSearchParams};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync('dist/spacevoice.js','utf8'),ctx);
  const ui=ctx.createSpaceVoice({getProfile:()=>({name:'Me'}),el:(...args)=>new Node(...args),button:(text,onclick)=>{const n=new Node('button','',text);n.onclick=onclick;return n;}});
  await ui.call.join();
  hooks.onPeers([{id:'b',status:'connected'}]);
  const remote={}; hooks.onStream('b',remote);
  const audio=ui.root.children.find(n=>n.tag==='audio');
  assert.equal(audio.srcObject,remote);assert.equal(audio.autoplay,true);assert.equal(audio.played,true);
  ui.call.toggleDeafen();assert.equal(audio.muted,true);assert.equal(localTrack.enabled,true);
  ui.call.toggleDeafen();assert.equal(audio.muted,false);
  ui.call.toggleMute();assert.equal(localTrack.enabled,false);assert.equal(audio.muted,false);
  ui.leave();assert.equal(audio.srcObject,null);assert.equal(audio.paused,true);assert.ok(!ui.root.children.includes(audio));assert.equal(released,1);assert.ok(closed>0);
});
