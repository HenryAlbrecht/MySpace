// Run explicitly: node tests/spacevoice-integration.cjs
// Requires real frontend :3000 and signaling :8787; no app implementation changes.
const { chromium } = require('C:/Users/Halourt/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const output = path.resolve('artifacts/spacevoice-v05-validation');
fs.mkdirSync(output, {recursive:true});
const report = { started:new Date().toISOString(), checks:[], errors:[], clients:{} };
const check = (name, details) => { report.checks.push({name, passed:true, details}); console.log('PASS', name); };
function instrument() {
  window.__voiceTest = {sockets:[],pcs:[],streams:[],displays:[],events:[]};
  const log = (kind, data) => window.__voiceTest.events.push({time:performance.now(),kind,...data});
  const NativeSocket = window.WebSocket;
  window.WebSocket = class extends NativeSocket {
    constructor(...args) {
      super(...args);window.__voiceTest.sockets.push(this);
      this.addEventListener('open',()=>log('ws-open',{url:this.url}));
      this.addEventListener('close',e=>log('ws-close',{code:e.code}));
      this.addEventListener('message',e=>{try{log('ws-receive',{message:JSON.parse(e.data)});}catch{}});
    }
    send(data) {
      let message;try{message=JSON.parse(data);}catch{}
      if(message?.type==='offer' && window.__voiceTest.holdOffers){(window.__voiceTest.heldOffers ||= []).push({socket:this,data});return;}
      if(message)log('ws-send',{message});return super.send(data);
    }
  };
  const NativePeer = window.RTCPeerConnection;
  window.RTCPeerConnection = class extends NativePeer {
    constructor(...args) {
      super(...args);this.testId=window.__voiceTest.pcs.length;window.__voiceTest.pcs.push(this);
      for (const event of ['connectionstatechange','iceconnectionstatechange','icegatheringstatechange','signalingstatechange']) this.addEventListener(event,()=>log(event,{peer:this.testId,connection:this.connectionState,ice:this.iceConnectionState,gathering:this.iceGatheringState,signaling:this.signalingState}));
      this.addEventListener('track',e=>log('ontrack',{peer:this.testId,trackKind:e.track.kind,readyState:e.track.readyState}));
    }
    createOffer(...args) {log('createOffer',{peer:this.testId});return super.createOffer(...args);}
    createAnswer(...args) {log('createAnswer',{peer:this.testId});return super.createAnswer(...args);}
    close() {log('peer-close',{peer:this.testId});return super.close();}
  };
  const acquire = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async (...args) => {
    const stream = await acquire(...args);window.__voiceTest.streams.push(stream);return stream;
  };
  if(navigator.mediaDevices.getDisplayMedia){
    const display=navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getDisplayMedia=async (...args)=>{log('display-request',{options:args[0]});const stream=await display(...args);window.__voiceTest.displays.push(stream);return stream;};
  }
}
async function snapshot(page) {
  return page.evaluate(async()=>{
    const t=window.__voiceTest;
    const pcs=[];
    for(const pc of t.pcs) {
      let stats=[];if(pc.connectionState!=='closed') stats=[...(await pc.getStats()).values()].filter(s=>s.type==='inbound-rtp'||s.type==='outbound-rtp'||s.type==='candidate-pair').map(s=>({type:s.type,kind:s.kind,trackIdentifier:s.trackIdentifier,framesDecoded:s.framesDecoded,framesEncoded:s.framesEncoded,bytesReceived:s.bytesReceived,bytesSent:s.bytesSent,state:s.state,nominated:s.nominated}));
      pcs.push({connection:pc.connectionState,ice:pc.iceConnectionState,gathering:pc.iceGatheringState,signaling:pc.signalingState,transceivers:pc.getTransceivers().map(t=>({mid:t.mid,direction:t.direction,currentDirection:t.currentDirection,sender:t.sender.track&&{id:t.sender.track.id,kind:t.sender.track.kind},receiver:t.receiver.track&&{id:t.receiver.track.id,kind:t.receiver.track.kind,readyState:t.receiver.track.readyState}})),stats});
    }
    return {events:t.events,pcs,sockets:t.sockets.map(s=>({readyState:s.readyState,handlersDetached:[s.onopen,s.onmessage,s.onerror,s.onclose].every(h=>h===null)})),streams:t.streams.map(s=>s.getTracks().map(t=>({enabled:t.enabled,readyState:t.readyState,kind:t.kind}))),displays:t.displays.map(s=>({id:s.id,tracks:s.getTracks().map(t=>({id:t.id,kind:t.kind,readyState:t.readyState,settings:t.getSettings()}))})),videos:[...document.querySelectorAll('.spacevoice video')].map(v=>({hidden:v.hidden,muted:v.muted,readyState:v.readyState,streamId:v.srcObject?.id,tracks:v.srcObject?.getTracks().map(t=>({kind:t.kind,id:t.id}))})),audios:[...document.querySelectorAll('.spacevoice audio')].map(a=>({muted:a.muted,paused:a.paused,hasStream:!!a.srcObject})),participants:[...document.querySelectorAll('.spacevoice-participants li')].map(e=>e.textContent),status:document.querySelector('.spacevoice-status')?.textContent};
  });
}
async function connected(page) {
  await page.waitForFunction(()=>window.__voiceTest.pcs.filter(p=>p.connectionState==='connected').length===1,null,{timeout:25000});
  await page.waitForFunction(()=>document.querySelectorAll('.spacevoice audio').length===1);
}
async function join(page) { await page.getByRole('button',{name:'[ entrar na chamada ]',exact:true}).click(); }
async function leave(page) { await page.getByRole('button',{name:'[ sair ]',exact:true}).click(); }
async function clean(page) {
  await page.waitForFunction(()=>window.__voiceTest.pcs.every(p=>p.connectionState==='closed') && document.querySelectorAll('.spacevoice audio').length===0);
}
async function meshConnected(page, count) {
  await page.waitForFunction(count => {
    const active=window.__voiceTest.pcs.filter(p=>p.connectionState!=='closed');
    if(active.length!==count || active.some(p=>p.connectionState!=='connected'||!['connected','completed'].includes(p.iceConnectionState)))return false;
    if(document.querySelectorAll('.spacevoice audio').length!==count || document.querySelectorAll('.spacevoice-participants li').length!==count+1)return false;
    return true;
  },count,{timeout:30000});
  const deadline=Date.now()+30000;
  while(Date.now()<deadline){
    const ready=await page.evaluate(async count=>{
      const active=window.__voiceTest.pcs.filter(p=>p.connectionState!=='closed');
      if(active.length!==count)return false;
      for(const pc of active)if(![...(await pc.getStats()).values()].some(s=>s.type==='inbound-rtp'&&s.bytesReceived>0))return false;
      return true;
    },count);
    if(ready)return;
    await page.waitForTimeout(100);
  }
  assert.fail('RTP not received on every mesh connection');
}
async function runMesh(persistent, report) {
  const contexts=[],pages=[];
  const mesh={};report.mesh=mesh;
  try {
    for(let i=0;i<4;i++){
      const context=await persistent.browser().newContext({permissions:['microphone'],viewport:{width:1280,height:900}});
      contexts.push(context);const page=await context.newPage();pages.push(page);
      page.on('console',m=>{if(m.type()==='error')report.errors.push({client:'mesh-'+i,kind:'console',text:m.text()});});
      page.on('pageerror',e=>report.errors.push({client:'mesh-'+i,kind:'pageerror',text:e.message}));
      await page.addInitScript(instrument);
      await page.goto('http://localhost:3000/?voiceWsUrl=ws%3A%2F%2Flocalhost%3A8787#spacevoice');
      await page.getByRole('button',{name:'[ entrar na chamada ]',exact:true}).waitFor();
    }
    const [a,b,c,d]=pages;
    const activeIds=page=>page.evaluate(()=>window.__voiceTest.pcs.map((p,i)=>p.connectionState!=='closed'?i:null).filter(i=>i!==null));
    const capture=async(label,clients)=>{mesh[label]=await Promise.all(clients.map(snapshot));};
    const offers=async clients=>{
      const events=(await Promise.all(clients.map(snapshot))).flatMap(s=>s.events);
      const outgoing=events.filter(e=>e.kind==='ws-send'&&e.message.type==='offer');
      const answers=events.filter(e=>e.kind==='ws-send'&&e.message.type==='answer');
      assert.ok(outgoing.every(e=>e.message.from<e.message.to));
      assert.equal(answers.length,outgoing.length);
      for(const e of outgoing)assert.equal(events.filter(r=>r.kind==='ws-receive'&&r.message.type==='offer'&&r.message.from===e.message.from&&r.message.to===e.message.to).length,outgoing.filter(r=>r.message.from===e.message.from&&r.message.to===e.message.to).length);
      return outgoing;
    };
    await join(a);await join(b);await Promise.all([meshConnected(a,1),meshConnected(b,1)]);
    const abIds=[await activeIds(a),await activeIds(b)];
    await join(c);await Promise.all([a,b,c].map(p=>meshConnected(p,2)));
    await capture('three',[a,b,c]);
    let out=await offers([a,b,c]);assert.equal(out.length,3);assert.equal(new Set(out.map(e=>[e.message.from,e.message.to].join('/'))).size,3);
    assert.ok((await activeIds(a)).includes(abIds[0][0]));assert.ok((await activeIds(b)).includes(abIds[1][0]));
    for(const page of [a,b,c]){
      assert.equal((await snapshot(page)).streams.length,1);
      assert.equal(await page.evaluate(()=>{const active=window.__voiceTest.pcs.filter(p=>p.connectionState!=='closed');return active.every(p=>p.getSenders()[0].track===window.__voiceTest.streams[0].getAudioTracks()[0]);}),true);
    }
    await capture('three',[a,b,c]);
    check('3 independent contexts: 3 unique pairs, 2 connected peers/tracks/audios per client, RTP on every path, one shared capture and no duplicate offers');
    await a.getByRole('button',{name:'Silenciar microfone',exact:true}).click();
    assert.equal(await a.evaluate(()=>window.__voiceTest.pcs.filter(p=>p.connectionState!=='closed').every(p=>p.getSenders()[0].track.enabled===false)),true);
    await a.getByRole('button',{name:'Ativar microfone',exact:true}).click();
    await a.getByRole('button',{name:'[ deafen ]',exact:true}).click();assert.ok((await snapshot(a)).audios.every(audio=>audio.muted));assert.ok((await snapshot(b)).audios.every(audio=>!audio.muted));
    await a.getByRole('button',{name:'[ deafen · ligado (local) ]',exact:true}).click();assert.ok((await snapshot(a)).audios.every(audio=>!audio.muted));
    check('Mesh mute affects all senders sharing the local track; deafen silences all local remote audios only');
    await leave(c);await clean(c);await Promise.all([a,b].map(p=>meshConnected(p,1)));
    assert.deepEqual(await activeIds(a),abIds[0]);assert.deepEqual(await activeIds(b),abIds[1]);
    await capture('afterCLeave',[a,b,c]);check('C leaves: only its peers close; original A-B remains connected with RTP');
    await join(c);await Promise.all([a,b,c].map(p=>meshConnected(p,2)));
    assert.ok((await activeIds(a)).includes(abIds[0][0]));assert.ok((await activeIds(b)).includes(abIds[1][0]));
    assert.equal((await offers([a,b,c])).length,5);
    await capture('cReentered',[a,b,c]);check('C reenters: only its two pairs are recreated, existing A-B remains intact');
    const beforeD=await Promise.all([a,b,c].map(activeIds));
    await join(d);await Promise.all(pages.map(p=>meshConnected(p,3)));
    out=await offers(pages);assert.equal(out.length,8);assert.equal(new Set(out.map(e=>[e.message.from,e.message.to].join('/'))).size,6);
    for(let i=0;i<3;i++)for(const id of beforeD[i])assert.ok((await activeIds(pages[i])).includes(id));
    for(const page of pages){const s=await snapshot(page);assert.equal(s.audios.length,3);assert.equal(s.sockets.filter(s=>s.readyState===1).length,1);assert.equal(await page.evaluate(()=>new Set([...document.querySelectorAll('.spacevoice audio')].map(a=>a.srcObject)).size),3);}
    await capture('four',pages);await a.screenshot({path:path.join(output,'mesh-four-connected.png')});
    check('4 independent contexts: 6 unique pairs, 3 connected peers and distinct remote streams/audios per client, bidirectional RTP on every pair');
    const survivors=[a,b,d],beforeDrop=await Promise.all(survivors.map(activeIds));
    await c.evaluate(()=>window.__voiceTest.sockets.find(s=>s.readyState===1).close(4001,'mesh reconnect test'));
    await c.waitForFunction(()=>window.__voiceTest.pcs.every(p=>p.connectionState==='closed'));
    await Promise.all(pages.map(p=>meshConnected(p,3)));
    for(let i=0;i<survivors.length;i++)assert.equal((await activeIds(survivors[i])).filter(id=>beforeDrop[i].includes(id)).length,2);
    assert.equal((await offers(pages)).length,11);
    await capture('fourRecovered',pages);
    check('Four-client WS reconnect: fresh snapshot resyncs C, only its 3 pairs are rebuilt, unrelated mesh links remain intact');
    for(const page of pages)await leave(page);await Promise.all(pages.map(clean));
    for(const page of pages){const s=await snapshot(page);assert.ok(s.sockets.every(s=>s.readyState===3&&s.handlersDetached));assert.ok(s.streams.every(ts=>ts.every(t=>t.readyState==='ended')));}
    check('Mesh exit closes every peer/socket/audio and all local captures');
    // Preserve the development transport with a 3-tab native mesh too.
    const localPages=[];
    for(let i=0;i<3;i++){
      const page=await contexts[0].newPage();localPages.push(page);await page.addInitScript(instrument);
      page.on('pageerror',e=>report.errors.push({client:'mesh-local',kind:'pageerror',text:e.message}));
      page.on('console',m=>{if(m.type()==='error')report.errors.push({client:'mesh-local',kind:'console',text:m.text()});});
      await page.goto('http://localhost:3000/?voiceTransport=local#spacevoice');await join(page);
    }
    await Promise.all(localPages.map(p=>meshConnected(p,2)));await capture('localThree',localPages);
    for(const page of localPages)assert.equal((await snapshot(page)).sockets.length,0);
    for(const page of localPages)await leave(page);await Promise.all(localPages.map(clean));
    check('BroadcastChannel three-tab mesh connects all 3 pairs using native WebRTC and no WS');
  }finally{for(const context of contexts)await context.close();}
}
(async()=>{
  let persistent, isolated, profile;
  try {
    profile=fs.mkdtempSync(path.join(os.tmpdir(),'spacevoice-browser-'));
    persistent=await chromium.launchPersistentContext(profile,{executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--auto-select-desktop-capture-source=Entire screen','--autoplay-policy=no-user-gesture-required'],viewport:{width:1280,height:900}});
    isolated=await persistent.browser().newContext({permissions:['microphone'],viewport:{width:1280,height:900}});
    await persistent.grantPermissions(['microphone']);
    report.browser=await persistent.browser().version();
    if(process.argv.includes('--screen-only')){
      await require('./voice-screen-integration.cjs')({persistent,report,instrument,snapshot,meshConnected,join,leave,clean,check,output});
      assert.equal(report.errors.length,0);report.passed=true;return;
    }
    const a=await persistent.newPage(), b=await isolated.newPage();
    for(const [id,page] of [['a',a],['b',b]]) {
      page.on('console',m=>{if(m.type()==='error')report.errors.push({client:id,kind:'console',text:m.text()});});
      page.on('pageerror',e=>report.errors.push({client:id,kind:'pageerror',text:e.message}));
      await page.addInitScript(instrument);
      await page.goto('http://localhost:3000/?voiceWsUrl=ws%3A%2F%2Flocalhost%3A8787#spacevoice');
      await page.getByRole('button',{name:'[ entrar na chamada ]',exact:true}).waitFor();
    }
    check('Frontend loads and SPACEVOICE controls render in persistent profile + isolated context');
    await join(a);await join(b);await Promise.all([connected(a),connected(b)]);
    // Confirm actual RTP flow, beyond a track event.
    await Promise.all([a,b].map(p=>meshConnected(p,1)));
    const firstA=await snapshot(a),firstB=await snapshot(b);
    report.clients.initial={a:firstA,b:firstB};
    for(const s of [firstA,firstB]) {
      assert.equal(s.participants.length,2);assert.ok(s.events.some(e=>e.kind==='ws-open'));
      assert.ok(s.events.some(e=>e.kind==='ws-send'&&e.message.type==='join'));
      assert.ok(s.events.some(e=>e.kind==='ws-receive'&&e.message.type==='peers'));
      for(const direction of ['ws-send','ws-receive'])assert.ok(s.events.some(e=>e.kind===direction&&e.message.type==='ice'));
      assert.ok(s.events.some(e=>e.kind==='ontrack'&&e.trackKind==='audio'));
      assert.ok(s.pcs[0].stats.some(s=>s.type==='inbound-rtp'&&s.bytesReceived>0));
      assert.equal(s.pcs[0].connection,'connected');assert.ok(['connected','completed'].includes(s.pcs[0].ice));
    }
    const all=[...firstA.events,...firstB.events];
    assert.equal(all.filter(e=>e.kind==='createOffer').length,1);assert.equal(all.filter(e=>e.kind==='createAnswer').length,1);
    for(const type of ['offer','answer']) {
      const send=all.find(e=>e.kind==='ws-send'&&e.message.type===type).message;
      const receive=all.find(e=>e.kind==='ws-receive'&&e.message.type===type).message;
      assert.deepEqual(send,receive);
      assert.ok(send.to && send.to!==send.from);
    }
    const offer=all.find(e=>e.kind==='ws-send'&&e.message.type==='offer').message;assert.ok(offer.from<offer.to);
    report.clients.initial={a:firstA,b:firstB};
    check('Real join/presence, deterministic single offer, targeted offer/answer, bidirectional ICE, connected RTC, ontrack and inbound RTP bytes');
    await a.getByRole('button',{name:'Silenciar microfone',exact:true}).click();
    assert.equal((await snapshot(a)).streams[0][0].enabled,false);assert.equal((await snapshot(b)).streams[0][0].enabled,true);
    await a.getByRole('button',{name:'Ativar microfone',exact:true}).click();assert.equal((await snapshot(a)).streams[0][0].enabled,true);
    await a.getByRole('button',{name:'[ deafen ]',exact:true}).click();
    let muted=await snapshot(a);assert.equal(muted.audios[0].muted,true);assert.equal(muted.streams[0][0].enabled,true);assert.equal((await snapshot(b)).audios[0].muted,false);
    await a.getByRole('button',{name:'[ deafen · ligado (local) ]',exact:true}).click();assert.equal((await snapshot(a)).audios[0].muted,false);
    check('Mute changes local audio track; deafen changes only local remote playback');
    await a.screenshot({path:path.join(output,'connected.png')});
    await leave(a);await Promise.all([clean(a),clean(b)]);
    const afterLeave=await snapshot(a);assert.ok(afterLeave.sockets.every(s=>s.readyState===3&&s.handlersDetached));assert.ok(afterLeave.streams.every(ts=>ts.every(t=>t.readyState==='ended')));
    assert.equal((await snapshot(b)).participants.length,1);
    check('Leave closes RTC, stops capture, detaches WS handlers, removes remote audio and peer on both clients');
    await join(a);await Promise.all([connected(a),connected(b)]);
    for(const s of [await snapshot(a),await snapshot(b)]){assert.equal(s.pcs.filter(p=>p.connection==='connected').length,1);assert.equal(s.audios.length,1);assert.equal(s.sockets.filter(s=>s.readyState===1).length,1);assert.equal(s.participants.length,2);}
    check('Reentry without reload has one active peer/audio/socket per client');
    await a.evaluate(()=>{const t=window.__voiceTest;t.disconnectMark=t.events.length;t.pcsAtDisconnect=t.pcs.length;t.sockets.find(s=>s.readyState===1).close(4001,'integration test forced socket drop');});
    await a.waitForFunction(()=>window.__voiceTest.events.slice(window.__voiceTest.disconnectMark).some(e=>e.kind==='peer-close'));
    await a.waitForFunction(()=>window.__voiceTest.pcs.length>window.__voiceTest.pcsAtDisconnect);
    await Promise.all([connected(a),connected(b)]);
    const recoveredA=await snapshot(a),recoveredB=await snapshot(b);
    for(const s of [recoveredA,recoveredB]){assert.equal(s.pcs.filter(p=>p.connection==='connected').length,1);assert.equal(s.audios.length,1);assert.equal(s.sockets.filter(s=>s.readyState===1).length,1);}
    report.clients.recovered={a:recoveredA,b:recoveredB};
    check('Real WebSocket drop triggers peer cleanup and automatic reconnect/new join/new RTC');
    await leave(a);await leave(b);await Promise.all([clean(a),clean(b)]);
    // No multi-room UI: test existing public session API with native browser media and WS.
    for(const [page,roomId]of [[a,'room-one'],[b,'room-two']])await page.evaluate(async roomId=>{
      const local=await navigator.mediaDevices.getUserMedia({audio:true});window.__roomStream=local;window.__roomPeers=[];
      window.__roomSession=createVoiceSession({clientId:crypto.randomUUID(),signaling:o=>createWebSocketVoiceSignaling({...o,url:'ws://localhost:8787'}),onPeers:p=>window.__roomPeers=p,onStream(){},onRemove(){},onError:e=>{throw Error(e);}});
      window.__roomSession.start(local,roomId);
    },roomId);
    for(const page of [a,b])await page.waitForFunction(()=>window.__voiceTest.sockets.some(s=>s.readyState===1));
    await a.waitForTimeout(1200);
    for(const page of [a,b])assert.equal(await page.evaluate(()=>window.__roomPeers.length),0);
    check('Different rooms via public session API remain isolated across browser contexts');
    for(const page of [a,b])await page.evaluate(()=>{window.__roomSession.close();window.__roomStream.getTracks().forEach(t=>t.stop());});
    // Local transport deliberately uses same-context tabs, separate from WS.
    const c=await persistent.newPage(),d=await persistent.newPage();
    for(const page of [c,d]){
      await page.addInitScript(instrument);
      page.on('console',m=>{if(m.type()==='error')report.errors.push({client:'local',kind:'console',text:m.text()});});
      page.on('pageerror',e=>report.errors.push({client:'local',kind:'pageerror',text:e.message}));
      await page.goto('http://localhost:3000/?voiceTransport=local#spacevoice');
      await page.getByRole('button',{name:'[ entrar na chamada ]',exact:true}).waitFor();
    }
    await join(c);await join(d);await Promise.all([connected(c),connected(d)]);
    for(const page of [c,d])assert.equal((await snapshot(page)).sockets.length,0);
    report.clients.local={c:await snapshot(c),d:await snapshot(d)};
    check('BroadcastChannel local transport connects same-profile tabs with real RTC and no WS');
    await leave(c);await leave(d);await Promise.all([clean(c),clean(d)]);
    await b.goto('http://localhost:3000/?voiceTransport=local#spacevoice');
    await join(c);await join(b);await c.waitForTimeout(1200);
    for(const page of [c,b]){assert.equal((await snapshot(page)).participants.length,1);assert.equal((await snapshot(page)).pcs.filter(p=>p.connection!=='closed').length,0);}
    check('BroadcastChannel remains partitioned: persistent profile and isolated context do not discover each other');
    await leave(c);await leave(b);
    await runMesh(persistent,report);
    await require('./voice-screen-integration.cjs')({persistent,report,instrument,snapshot,meshConnected,join,leave,clean,check,output});
    assert.equal(report.errors.filter(e=>e.kind==='pageerror').length,0);
    report.passed=true;
  }catch(error){report.passed=false;report.failure=error.stack;console.error(error);process.exitCode=1;}
  finally{
    await isolated?.close();await persistent?.close();
    if(profile && path.resolve(profile).startsWith(path.resolve(os.tmpdir())+path.sep+'spacevoice-browser-')) fs.rmSync(profile,{recursive:true,force:true});
    report.finished=new Date().toISOString();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
    console.log('Report:',path.join(output,'report.json'));
  }
})();
