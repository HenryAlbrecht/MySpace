const {test}=require('node:test');
const assert=require('node:assert/strict');
const {once}=require('node:events');
const {createHmac}=require('node:crypto');
const WS=require('../server/node_modules/ws');
const {createSignalingServer}=require('../server/signaling-server.cjs');
async function setup(t,env){const service=createSignalingServer({port:0,host:'127.0.0.1',env});await once(service.wss,'listening');t.after(async()=>{for(const socket of service.wss.clients)socket.terminate();await new Promise(r=>service.wss.close(r));});return {...service,url:`ws://127.0.0.1:${service.wss.address().port}`};}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<100;i++){if(fn())return;await sleep(5);}assert.fail('Message timeout');}
test('ICE WS requests require registered room identity, generate valid credentials and rate limit',async t=>{
 const service=await setup(t,{PARTY_TURN_URLS:'turn:example:3478?transport=udp,turns:example:5349?transport=tcp',PARTY_TURN_SECRET:'test-server-secret',PARTY_TURN_TTL:'120'});
 const socket=new WS(service.url);await once(socket,'open');const messages=[];socket.on('message',data=>messages.push(JSON.parse(data)));
 const send=(type,payload,from='a')=>socket.send(JSON.stringify({type,roomId:'geral',from,payload}));
 send('ice-config-request',{requestId:'ice-unregistered'});await sleep(15);assert.equal(messages.length,0);
 send('presence-join',{displayName:'Alice',avatar:''});await until(()=>messages.length>0);
 send('ice-config-request',{requestId:'ice-spoof'},'b');send('ice-config-request',{requestId:'bad id'});send('ice-config-request',{requestId:'ice-extra',extra:'invalid'});
 await sleep(15);assert.equal(messages.filter(m=>m.type==='ice-config').length,0);
 const before=Date.now();send('ice-config-request',{requestId:'ice-valid'});await until(()=>messages.some(m=>m.type==='ice-config'));
 const config=messages.find(m=>m.type==='ice-config').payload,turn=config.iceServers[1];assert.equal(config.requestId,'ice-valid');
 assert.ok(config.expiresAt>=before+119000&&config.expiresAt<=Date.now()+120000);assert.equal(turn.credential,createHmac('sha1','test-server-secret').update(turn.username).digest('base64'));assert.ok(!JSON.stringify(config).includes('test-server-secret'));
 for(let i=0;i<6;i++)send('ice-config-request',{requestId:'ice-'+i});await until(()=>messages.filter(m=>m.type==='ice-config').length===7);
 assert.equal(messages.filter(m=>m.payload?.error==='rate-limit').length,1);socket.close();
});
test('no secret returns STUN-only without blocking rooms',async t=>{
 const service=await setup(t,{}),socket=new WS(service.url);await once(socket,'open');
 socket.send(JSON.stringify({type:'presence-join',roomId:'geral',from:'a',payload:{displayName:'Alice',avatar:''}}));
 const response=new Promise(resolve=>socket.on('message',raw=>{const m=JSON.parse(raw);if(m.type==='ice-config')resolve(m);}));
 socket.send(JSON.stringify({type:'ice-config-request',roomId:'geral',from:'a',payload:{requestId:'ice-only'}}));
 const m=await response;assert.equal(m.payload.turn,false);assert.equal(m.payload.expiresAt,0);assert.ok(m.payload.iceServers.every(s=>!s.credential));socket.close();
});
test('production TURN requires origin allowlist; allowed origins accepted and other origins rejected',async t=>{
 const env={NODE_ENV:'production',PARTY_TURN_URLS:'turn:example',PARTY_TURN_SECRET:'test'};
 assert.throws(()=>createSignalingServer({env}),/PARTY_ALLOWED_ORIGINS/);
 const service=await setup(t,{...env,PARTY_ALLOWED_ORIGINS:'https://party.example'});
 const denied=new WS(service.url,{origin:'https://untrusted.example'});const [error]=await once(denied,'error');assert.match(error.message,/401/);
 const allowed=new WS(service.url,{origin:'https://party.example'});await once(allowed,'open');allowed.close();
});
test('room WS broker requests ICE only on demand, shares cache and cleans its transport',async t=>{
 const service=await setup(t,{PARTY_TURN_URLS:'turn:example',PARTY_TURN_SECRET:'broker-test'});
 const signaling=require('../dist/voice/signaling-ws.js'),createRoom=require('../dist/voice/room.js');
 const room=createRoom({clientId:'broker',getMetadata:()=>({displayName:'Alice',avatar:''}),signaling:o=>signaling({...o,Socket:WS,url:service.url})});t.after(()=>room.leave());
 await room.enter('geral');await until(()=>room.state.participants.length===1);
 assert.equal(room.inCall,false);
 const [a,b]=await Promise.all([room.getIceConfiguration(),room.getIceConfiguration()]);assert.equal(a,b);assert.equal(a.turn,true);
 assert.equal(await room.getIceConfiguration(),a);room.leave();assert.equal(room.state.roomId,null);
});
