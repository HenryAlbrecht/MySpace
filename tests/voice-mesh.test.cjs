const {test} = require('node:test');
const assert = require('node:assert/strict');
const session = require('../dist/voice/session.js');
const peer = require('../dist/voice/peer.js');
const local = require('../dist/voice/signaling-local.js');
const ws = require('../dist/voice/signaling-ws.js');
const {createSignalingServer} = require('../server/signaling-server.cjs');
const Socket = require('../server/node_modules/ws');
const {once} = require('node:events');
const tick = async () => { for(let i=0;i<80;i++) await Promise.resolve(); };
const until = async check => {for(let i=0;i<200;i++){if(check())return;await new Promise(r=>setTimeout(r,5));}assert.fail('mesh timeout');};
class Channel {
  static all = new Set();
  constructor(){Channel.all.add(this);}
  postMessage(data){for(const c of Channel.all)if(c!==this)queueMicrotask(()=>c.onmessage?.({data}));}
  close(){Channel.all.delete(this);}
}
class Stream {
  constructor(){this.track={enabled:true,stop(){this.stopped=true;}};}
  getTracks(){return [this.track];}
}
class Peer {
  constructor(){this.ice=[];this.tracks=[];}
  addTrack(t){this.tracks.push(t);}
  async createOffer(){return {type:'offer',sdp:'offer'};}
  async createAnswer(){return {type:'answer',sdp:'answer'};}
  async setLocalDescription(d){this.localDescription=d;}
  async setRemoteDescription(d){this.remoteDescription=d;}
  async addIceCandidate(c){this.ice.push(c);}
  close(){this.closed=true;}
}
function harness(signaling){
  const sessions={},lists={},streams={},pcs={},messages=[];
  function create(id,room='geral'){
    streams[id]=new Stream();pcs[id]=[];lists[id]=[];
    sessions[id]=session({clientId:id,signaling:o=>{const transport=signaling(o);return {send:(type,to,payload)=>{messages.push({from:id,to,type,payload});transport.send(type,to,payload);},close:()=>transport.close()};},
      peer:o=>peer({...o,Stream,Peer:class extends Peer{constructor(){super();pcs[id].push(this);}}}),
      onPeers:p=>lists[id]=p,onRemove(){},onStream(){},onError:e=>assert.fail(e)});
    sessions[id].start(streams[id],room);return sessions[id];
  }
  return {create,sessions,lists,streams,pcs,messages,close(){Object.values(sessions).forEach(s=>s.close());}};
}
for(const n of [3,4])test(`local mesh ${n} clients: unique pairs, deterministic offers, per-peer answers/ICE, shared capture and selective leave`,async t=>{
  const h=harness(o=>local({...o,Channel}));t.after(()=>h.close());
  h.create('b');h.create('a');await tick();
  const ab=[h.pcs.a[0],h.pcs.b[0]];
  for(const id of ['c','d'].slice(0,n-2))h.create(id);
  await tick();
  assert.ok(ab.every(pc=>!pc.closed));assert.equal(h.pcs.a[0],ab[0]);assert.equal(h.pcs.b[0],ab[1]);
  for(const id of Object.keys(h.sessions)){
    assert.equal(h.lists[id].length,n-1);assert.equal(h.pcs[id].length,n-1);
    assert.ok(h.pcs[id].every(pc=>pc.tracks[0]===h.streams[id].track));
    h.streams[id].track.enabled=false;assert.ok(h.pcs[id].every(pc=>!pc.tracks[0].enabled));
  }
  assert.equal(h.messages.filter(m=>m.type==='offer').length,n*(n-1)/2);
  assert.equal(h.messages.filter(m=>m.type==='answer').length,n*(n-1)/2);
  const offers=h.messages.filter(m=>m.type==='offer');
  assert.ok(offers.every(m=>m.from<m.to));
  assert.equal(new Set(offers.map(m=>m.from+'/'+m.to)).size,n*(n-1)/2);
  for(const m of offers)assert.equal(h.messages.filter(a=>a.type==='answer'&&a.from===m.to&&a.to===m.from).length,1);
  for(const id of Object.keys(h.pcs))for(const [i,pc]of h.pcs[id].entries())pc.onicecandidate({candidate:{candidate:`${id}-${i}`}});
  await tick();assert.ok(Object.values(h.pcs).flat().every(pc=>pc.ice.length===1));
  for(const id of Object.keys(h.pcs))for(const [i,pc]of h.pcs[id].entries()){
    const remoteId=h.lists[id][i].id;
    const routed=h.messages.find(m=>m.type==='ice'&&m.from===remoteId&&m.to===id);
    assert.deepEqual(pc.ice[0],routed.payload);
  }
  h.sessions.c.close();await tick();assert.ok(ab.every(pc=>!pc.closed));
  assert.ok(h.lists.a.every(p=>p.id!=='c'));assert.equal(h.lists.a.length,n-2);
  h.sessions.c.start(h.streams.c,'geral');await tick();assert.equal(h.lists.a.length,n-1);assert.ok(ab.every(pc=>!pc.closed));
  h.close();await tick();assert.ok(Object.values(h.pcs).flat().every(pc=>pc.closed));assert.equal(Channel.all.size,0);
});
test('presence snapshot reconciles missing/stale peers, duplicates are idempotent, pair election/routes remain independent',()=>{
  let receive,status;const controllers=new Map(),sent=[],removed=[];let lists;
  const s=session({clientId:'b',signaling:o=>{receive=o.onMessage;status=o.onStatus;return {send:(...m)=>sent.push(m),close(){}};},
    peer:o=>{const controller={offers:0,incoming:[],start(){this.offers++;},receive(...m){this.incoming.push(m);},close(){this.closed=true;}};controllers.set(controllers.size,controller);return controller;},
    onPeers:p=>lists=p,onRemove:id=>removed.push(id),onStream(){},onError:e=>assert.fail(e)});
  s.start({},'geral');
  receive({type:'peers',payload:{peers:['a','b','c','c']}});assert.equal(lists.length,2);
  const [a,c]=[...controllers.values()];assert.equal(a.offers,0);assert.equal(c.offers,1);
  receive({type:'join',from:'c',payload:{reply:true}});receive({type:'peers',payload:{peers:['a','c']}});assert.equal(controllers.size,2);assert.equal(c.offers,1);
  receive({type:'offer',from:'a',payload:{sdp:'a'}});receive({type:'answer',from:'c',payload:{sdp:'c'}});receive({type:'ice',from:'c',payload:{candidate:'c'}});
  assert.deepEqual(a.incoming.map(m=>m[0]),['offer']);assert.deepEqual(c.incoming.map(m=>m[0]),['answer','ice']);
  // Dynamic negotiation can now originate on either side; session forwards it.
  receive({type:'offer',from:'c',payload:{}});receive({type:'answer',from:'a',payload:{}});assert.equal(a.incoming.length,2);assert.equal(c.incoming.length,3);
  receive({type:'peers',payload:{peers:['c','d']}});assert.ok(a.closed);assert.ok(!c.closed);assert.deepEqual(removed,['a']);assert.equal(lists.length,2);
  status('desconectado');assert.equal(lists.length,0);assert.ok([...controllers.values()].every(p=>p.closed));
  receive({type:'peers',payload:{peers:['c','d']}});assert.equal(lists.length,2);receive({type:'peers',payload:{peers:['c','d']}});assert.equal(controllers.size,5);
  s.close();assert.equal(lists.length,0);
});
test('real WS four-client snapshot builds six pairs and resync after disconnect preserves unrelated peers',async t=>{
  const service=createSignalingServer({port:0,host:'127.0.0.1'});await once(service.wss,'listening');
  const h=harness(o=>ws({...o,Socket,url:`ws://127.0.0.1:${service.wss.address().port}`,retryMs:20}));
  t.after(async()=>{h.close();for(const c of service.wss.clients)c.terminate();await new Promise(r=>service.wss.close(r));});
  h.create('b');h.create('a');await until(()=>h.messages.some(m=>m.type==='answer'));
  const ab=[h.pcs.a[0],h.pcs.b[0]];h.create('c');h.create('d');h.create('x','other');
  await until(()=>h.messages.filter(m=>m.type==='answer').length===6);
  for(const id of ['a','b','c','d'])assert.equal(h.lists[id].length,3);assert.equal(h.lists.x.length,0);
  assert.equal(h.messages.filter(m=>m.type==='offer').length,6);
  service.rooms.get('geral').get('c').socket.terminate();await until(()=>h.pcs.c.slice(0,3).every(p=>p.closed));
  await until(()=>h.messages.filter(m=>m.type==='answer').length===9);
  assert.ok(ab.every(pc=>!pc.closed));for(const id of ['a','b','c','d'])assert.equal(h.lists[id].length,3);
  assert.equal(h.pcs.c.filter(pc=>!pc.closed).length,3);
});
