const {test}=require('node:test'),assert=require('node:assert/strict'),{once}=require('node:events');
const api=require('../dist/voice/room-metadata.js'),roomFactory=require('../dist/voice/room.js'),wsFactory=require('../dist/voice/signaling-ws.js');
const WS=require('../server/node_modules/ws'),{createSignalingServer}=require('../server/signaling-server.cjs');
const delay=ms=>new Promise(r=>setTimeout(r,ms));async function until(fn){for(let i=0;i<200;i++){if(fn())return;await delay(5);}assert.fail('Timeout');}
async function service(t,options={}){const s=createSignalingServer({port:0,host:'127.0.0.1',...options});await once(s.wss,'listening');t.after(async()=>{for(const c of s.wss.clients)c.terminate();await new Promise(r=>s.wss.close(r));});s.url='ws://127.0.0.1:'+s.wss.address().port;s.connect=async(id,roomId='one',metadata={displayName:id})=>{const socket=new WS(s.url),messages=[];socket.on('message',raw=>messages.push(JSON.parse(raw)));await once(socket,'open');const send=(type,payload,extra={})=>socket.send(JSON.stringify({type,roomId,from:id,payload,...extra}));send('presence-join',metadata);await until(()=>messages.some(m=>m.type==='presence-snapshot'));return {socket,messages,send};};return s;}
test('secure room IDs and party/invite URLs preserve technical parameters',()=>{
 const calls=[];assert.equal(api.secureId({randomUUID:()=>{calls.push(1);return 'random-uuid';}}),'random-uuid');assert.equal(calls.length,1);assert.throws(()=>api.secureId({}));assert.match(api.secureId({getRandomValues:a=>{a.fill(42);return a;}}),/^[0-9a-f]{32}$/);
 const base='https://party.example/?voiceWsUrl=ws%3A%2F%2Flocalhost%3A8787&voiceTransport=local&voiceIcePolicy=relay&other=kept#perfil';const changed=new URL(api.roomUrl(base,'new-id'));assert.equal(changed.searchParams.get('voiceTransport'),'local');assert.equal(changed.searchParams.get('voiceIcePolicy'),'relay');assert.equal(changed.searchParams.get('other'),'kept');assert.equal(changed.hash,'#spacevoice');assert.equal(api.parse(changed.href),'new-id');assert.equal(api.parse('http://localhost/'),null);assert.equal(api.parse('http://localhost/?party=geral'),null);assert.equal(api.parse('https://a/?party=%3Cscript%3E'),null);
 const invite=new URL(api.invite(base,'random'));assert.equal(invite.searchParams.get('voiceWsUrl'),'ws://localhost:8787');assert.equal(invite.searchParams.get('voiceTransport'),'local');assert.equal(invite.searchParams.get('other'),'kept');assert.equal(invite.searchParams.get('party'),'random');
});
test('metadata validation bounds names and avatars, safe image types and fallback; HTML name remains text',()=>{
 assert.deepEqual(api.metadata({displayName:'  Alice ',avatar:''}),{displayName:'Alice',avatar:''});assert.equal(api.metadata({}).displayName,'Convidado');assert.equal(api.metadata({displayName:'<img onerror=alert(1)>'}).displayName,'<img onerror=alert(1)>');
 for(const value of [{displayName:'x'.repeat(65)},{avatar:'javascript:alert(1)'},{avatar:'data:image/svg+xml;base64,PHN2Zz4='},{avatar:'data:text/html;base64,AAAA'},{avatar:'data:image/png;base64,'+'A'.repeat(api.MAX_AVATAR)},[]])assert.equal(api.metadata(value),null);
 assert.equal(api.avatar('http://localhost/x.png'),null);assert.equal(api.avatar('http://localhost/x.png',{allowHttp:true}),'http://localhost/x.png');assert.equal(api.avatar('https://example.org/a.jpg'),'https://example.org/a.jpg');assert.equal(api.avatar('data:image/png;base64,AAAA'),'data:image/png;base64,AAAA');assert.equal(api.avatar('https://user:pass@example.org/a.jpg'),null);
});
test('presence controller snapshots deduplicate, update and leave; call borrows transport and leaves room intact',async()=>{
 let hooks,closed=0;const sent=[],changes=[];
 const room=roomFactory({clientId:'a',getMetadata:()=>({displayName:'Alice'}),signaling:o=>{hooks=o;return {send:(...args)=>{sent.push(args);return true;},close:()=>closed++};},onChange:s=>changes.push(s.roomId)});
 await room.enter('one');assert.equal(sent[0][0],'presence-join');assert.equal(room.state.roomId,'one');
 const item={clientId:'b',displayName:'Bob',inCall:false};hooks.onMessage({type:'presence-snapshot',roomId:'one',payload:{participants:[item,item]}});assert.equal(room.state.participants.length,1);hooks.onMessage({type:'presence-snapshot',roomId:'other',payload:{participants:[]}});assert.equal(room.state.participants.length,1);
 room.update({displayName:'Alice 2'});assert.equal(sent.at(-1)[0],'presence-update');let delivered=0;const transport=room.callTransport({roomId:'one',onStatus(){},onMessage(){delivered++;}});transport.send('join');assert.equal(room.inCall,true);transport.send('leave');transport.close();assert.equal(room.inCall,false);assert.equal(room.state.roomId,'one');assert.equal(closed,0);assert.ok(!sent.some(m=>m[0]==='presence-leave'));
 hooks.onStatus('desconectado');assert.equal(room.state.participants.length,0);hooks.onMessage({type:'presence-snapshot',roomId:'one',payload:{participants:[item,item]}});assert.equal(room.state.participants.length,1);room.leave();assert.equal(sent.at(-1)[0],'presence-leave');assert.equal(closed,1);assert.equal(room.state.roomId,null);
});
test('room change cancels stale metadata completion and isolates callbacks',async()=>{
 let resolve;let captures=0;const room=roomFactory({clientId:'a',getMetadata:()=>new Promise(r=>resolve=r),signaling:()=>{captures++;return {send(){},close(){}};}});const first=room.enter('one');room.leave();resolve({displayName:'A'});await first;assert.equal(captures,0);assert.equal(room.state.roomId,null);
});
test('server presence join/update/snapshot, room isolation, leave-call versus leave-room and socket cleanup',async t=>{
 const s=await service(t),a=await s.connect('a'),b=await s.connect('b'),c=await s.connect('c','other');await until(()=>a.messages.at(-1).payload.participants.length===2);
 assert.equal(a.messages.some(m=>['peers','chat-history','offer'].includes(m.type)),false);assert.equal(s.rooms.get('one').get('a').inCall,false);assert.equal(c.messages.at(-1).payload.participants.length,1);
 a.send('presence-update',{displayName:'Alice',avatar:'https://example.org/a.png',inCall:true},{from:'b'});await delay(15);assert.equal(s.rooms.get('one').get('a').metadata.displayName,'a');
 a.send('presence-update',{displayName:'Alice',avatar:'https://example.org/a.png',inCall:true});await until(()=>s.rooms.get('one').get('a').metadata.displayName==='Alice');assert.equal(s.rooms.get('one').get('a').inCall,false);
 a.send('join');await until(()=>s.rooms.get('one').get('a').inCall);assert.deepEqual(a.messages.find(m=>m.type==='peers').payload.peers,[]);assert.equal(b.messages.some(m=>m.type==='join'),false);
 a.send('offer',{type:'offer',sdp:'for lobby'},{to:'b'});await delay(15);assert.equal(b.messages.some(m=>m.type==='offer'),false);
 b.send('ice',{candidate:'for call'},{to:'a'});await delay(15);assert.equal(a.messages.some(m=>m.type==='ice'),false);
 b.send('join');await until(()=>b.messages.some(m=>m.type==='peers'));assert.deepEqual(b.messages.find(m=>m.type==='peers').payload.peers,['a']);await until(()=>a.messages.some(m=>m.type==='join'&&m.from==='b'));
 a.send('offer',{type:'offer',sdp:'allowed'},{to:'b'});await until(()=>b.messages.some(m=>m.type==='offer'));assert.equal(c.messages.some(m=>m.type==='offer'),false);
 a.send('chat-message',{text:'hello',authorName:'forged'});await until(()=>b.messages.some(m=>m.type==='chat-message'));assert.equal(b.messages.find(m=>m.type==='chat-message').payload.authorName,'Alice');
 a.send('leave');await until(()=>!s.rooms.get('one').get('a').inCall);assert.equal(s.rooms.get('one').size,2);assert.equal(a.socket.readyState,1);assert.equal(s.rooms.get('one').get('b').inCall,true);await until(()=>b.messages.some(m=>m.type==='leave'));
 a.send('chat-message',{text:'lobby forbidden'});await until(()=>a.messages.some(m=>m.type==='chat-error'));
 a.send('presence-leave');await until(()=>s.rooms.get('one').size===1);b.socket.terminate();await until(()=>!s.rooms.has('one'));assert.equal(s.history.has('one'),false);
});
test('server rejects bad/oversized metadata and bounds room membership/room count',async t=>{
 const s=await service(t,{maxRoomMembers:1,maxRooms:1}),a=await s.connect('a');a.send('presence-update',{avatar:'data:image/svg+xml;base64,AAAA'});await until(()=>a.messages.some(m=>m.type==='presence-error'));assert.equal(s.rooms.get('one').get('a').metadata.avatar,'');
 const tryJoin=async(id,roomId,payload)=>{const socket=new WS(s.url);await once(socket,'open');const done=once(socket,'close');socket.send(JSON.stringify({type:'presence-join',roomId,from:id,payload}));return (await done)[0];};
 assert.equal(await tryJoin('bad','one',{avatar:'data:image/png;base64,'+'A'.repeat(api.MAX_AVATAR)}),1008);assert.equal(await tryJoin('b','one',{displayName:'B'}),1013);assert.equal(await tryJoin('c','other',{displayName:'C'}),1013);assert.equal(s.rooms.size,1);
});
test('WebSocket room reconnect replays presence and active call without duplicate presence',async t=>{
 const s=await service(t);let messages=[];const adapter=wsFactory({clientId:'a',roomId:'one',url:s.url,Socket:WS,retryMs:5,onMessage:m=>messages.push(m)});t.after(()=>adapter.close());adapter.send('presence-join',undefined,{displayName:'Alice'});await until(()=>s.rooms.get('one')?.has('a'));adapter.send('join');await until(()=>s.rooms.get('one').get('a').inCall);s.rooms.get('one').get('a').socket.terminate();await until(()=>messages.filter(m=>m.type==='peers').length===2);assert.equal(s.rooms.get('one').size,1);assert.equal(s.rooms.get('one').get('a').inCall,true);assert.equal(s.rooms.get('one').get('a').metadata.displayName,'Alice');
 adapter.send('leave');await until(()=>!s.rooms.get('one').get('a').inCall);s.rooms.get('one').get('a').socket.terminate();await until(()=>messages.filter(m=>m.type==='presence-snapshot').length>=4&&s.rooms.get('one')?.has('a'));assert.equal(s.rooms.get('one').get('a').inCall,false);
});
test('BroadcastChannel dev lobby announces metadata and call state without sending call messages to lobby',async()=>{
 const factory=require('../dist/voice/signaling-local.js');
 class Channel {static list=new Set();constructor(){Channel.list.add(this);}postMessage(data){for(const c of Channel.list)if(c!==this)queueMicrotask(()=>c.onmessage?.({data}));}close(){Channel.list.delete(this);}}
 const received={a:[],b:[],c:[]};const make=(id,roomId)=>factory({clientId:id,roomId,Channel,onMessage:m=>received[id].push(m)});
 const a=make('a','one'),b=make('b','one'),c=make('c','other');
 a.send('presence-join',undefined,{displayName:'Alice'});b.send('presence-join',undefined,{displayName:'Bob'});c.send('presence-join',undefined,{displayName:'Other'});await delay(5);
 assert.equal(received.a.at(-1).payload.participants.length,2);assert.equal(received.c.at(-1).payload.participants.length,1);
 a.send('join');a.send('offer','b',{sdp:'lobby must not receive'});await delay(5);assert.equal(received.b.some(m=>m.type==='offer'),false);
 b.send('join');await delay(5);assert.ok(received.b.some(m=>m.type==='peers'&&m.payload.peers.includes('a')));
 a.send('leave');await delay(5);assert.equal(received.b.filter(m=>m.type==='presence-snapshot').at(-1).payload.participants.find(p=>p.clientId==='a').inCall,false);
 a.send('presence-leave');a.close();await delay(5);assert.equal(received.b.filter(m=>m.type==='presence-snapshot').at(-1).payload.participants.length,1);b.close();c.close();assert.equal(Channel.list.size,0);
});
