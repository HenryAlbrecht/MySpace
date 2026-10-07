// One final integration, one Edge browser/two contexts, native RTC and fake microphone only.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{once}=require('node:events');
const {chromium}=require(path.join(require('node:os').homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const {createSignalingServer}=require('../server/signaling-server.cjs');
const output=path.resolve('artifacts/party-v09');fs.mkdirSync(output,{recursive:true});
const report={checks:[],errors:[],browserContexts:2};
(async()=>{
 const root=path.resolve('dist');const web=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}try{res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html; charset=utf-8','.css':'text/css','.png':'image/png','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
 const signaling=createSignalingServer({port:0,host:'127.0.0.1'});let browser;const contexts=[],pages=[];
 try{
 await Promise.all([new Promise(r=>web.listen(0,'127.0.0.1',r)),once(signaling.wss,'listening')]);
 const wsUrl='ws://127.0.0.1:'+signaling.wss.address().port;
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
 async function client(name,avatar,href){
  const context=await browser.newContext({viewport:{width:1440,height:1000},permissions:['microphone','clipboard-read','clipboard-write']});contexts.push(context);
  await context.addInitScript(({name,avatar,wsUrl})=>{
    if(avatar==='fixture-avatar') {const canvas=document.createElement('canvas');canvas.width=96;canvas.height=96;const c=canvas.getContext('2d');c.fillStyle='#30465c';c.fillRect(0,0,96,96);c.fillStyle='#baa7ec';c.beginPath();c.arc(48,38,18,0,Math.PI*2);c.fill();c.fillRect(24,62,48,32);avatar=canvas.toDataURL('image/png');}
    localStorage.setItem('myspace-profile-v1',JSON.stringify({name,avatar}));window.SPACEVOICE_CONFIG={url:wsUrl,iceServers:[]};
    window.__pcs=[];window.__micRequests=0;const Native=RTCPeerConnection;window.RTCPeerConnection=class extends Native{constructor(...args){super(...args);__pcs.push(this);}};
    const acquire=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=constraints=>{__micRequests++;return acquire(constraints);};
    navigator.mediaDevices.getDisplayMedia=()=>{throw Error('Screen capture must not run in room integration');};
  },{name,avatar,wsUrl});
  await context.route('**/spacevoice.js',route=>route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'spacevoice.js'),'utf8')+';const __createPartyUI=createSpaceVoice;createSpaceVoice=options=>{window.__partyUI=__createPartyUI(options);return __partyUI;};'}));
  const page=await context.newPage();pages.push(page);page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__partyUI?.room.state.participants.length>=1);return page;
 }
 const initial=new URL('http://127.0.0.1:'+web.address().port+'/?party=initial-room&keep=yes');initial.searchParams.set('voiceWsUrl',wsUrl);initial.searchParams.set('voiceTransport','websocket');
 const a=await client('Alice','fixture-avatar',initial.href);
 assert.equal(new URL(a.url()).hash,'#spacevoice');
 assert.deepEqual(await a.evaluate(()=>({mic:__micRequests,pc:__pcs.length})),{mic:0,pc:0});assert.equal(await a.locator('.party-chat-toggle').isVisible(),true);
 await a.getByRole('button',{name:'[ nova party ]',exact:true}).click();
 await a.waitForFunction(()=>__partyUI.room.state.roomId!=='initial-room'&&__partyUI.room.state.participants.length===1&&__partyUI.room.state.status==='conectado');
 const roomId=await a.evaluate(()=>__partyUI.room.state.roomId);assert.match(roomId,/^[0-9a-f-]{36}$/);assert.equal(new URL(a.url()).searchParams.get('keep'),'yes');assert.equal(new URL(a.url()).searchParams.get('voiceWsUrl'),wsUrl);
 const settle=page=>page.evaluate(()=>Promise.all(document.querySelector('.spacevoice').getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{}))));
 await settle(a);await a.screenshot({path:path.join(output,'01-lobby-alone.png'),fullPage:true});
 await a.getByRole('button',{name:'[ copiar convite ]',exact:true}).click();await a.waitForFunction(()=>document.querySelector('.party-room-feedback').textContent==='convite copiado');
 const invite=await a.evaluate(()=>navigator.clipboard.readText());assert.equal(new URL(invite).searchParams.get('party'),roomId);
 report.checks.push('invite selects random room, preserves local URL parameters; clipboard copied','lobby alone: zero microphone requests and PeerConnections; room chat available');
 const b=await client('Luna','',invite);
 for(const page of [a,b])await page.waitForFunction(()=>__partyUI.room.state.participants.length===2);
 assert.equal(signaling.rooms.get(roomId).size,2);
 assert.equal(await a.locator('.spacevoice-participants').innerText().then(t=>t.includes('Luna')),true);assert.equal(await b.locator('.spacevoice-participants').innerText().then(t=>t.includes('Alice')),true);
 assert.equal(await a.locator('.spacevoice-participants li[data-peer-id] .spacevoice-avatar').innerText(),'L');
 assert.ok((await b.locator('.spacevoice-participants li[data-peer-id] .spacevoice-avatar img').getAttribute('src')).startsWith('data:image/'));
 for(const page of [a,b]){assert.deepEqual(await page.evaluate(()=>({mic:__micRequests,pc:__pcs.length})),{mic:0,pc:0});assert.equal(await page.locator('.party-chat-toggle').isVisible(),true);assert.equal(await page.locator('.spacevoice').getAttribute('data-context'),'none');}
 await settle(a);await a.screenshot({path:path.join(output,'02-lobby-together.png'),fullPage:true});report.checks.push('two identities in lobby; thumbnail avatar and initials fallback; no RTC/capture');
 await a.getByRole('button',{name:'[ entrar na chamada ]',exact:true}).click();
 await a.waitForFunction(()=>__partyUI.call.state.joined&&__partyUI.room.state.participants.filter(p=>p.inCall).length===1);
 await b.waitForFunction(()=>__partyUI.room.state.participants.filter(p=>p.inCall).length===1);
 assert.deepEqual(await b.evaluate(()=>({mic:__micRequests,pc:__pcs.length})),{mic:0,pc:0});assert.equal(await a.evaluate(()=>__pcs.length),0);assert.equal(await b.locator('.party-chat-toggle').isVisible(),true);
 report.checks.push('A enters call, B remains lobby and receives no PeerConnection');
 await b.getByRole('button',{name:'[ entrar na chamada ]',exact:true}).click();
 for(const page of [a,b])await page.waitForFunction(()=>__pcs.length===1&&__pcs[0].connectionState==='connected'&&__partyUI.room.state.participants.filter(p=>p.inCall).length===2,null,{timeout:15000});
 assert.equal(await a.evaluate(()=>__micRequests),1);assert.equal(await b.evaluate(()=>__micRequests),1);
 assert.equal(await b.locator('.party-chat-toggle').isVisible(),true);assert.equal(await b.locator('.spacevoice').getAttribute('data-context'),'none');
 await settle(b);await b.screenshot({path:path.join(output,'03-call-identities.png'),fullPage:true});report.checks.push('both in call: native perfect negotiation connected; metadata/avatar retained; chat available but closed');
 await a.getByRole('button',{name:'Sair da party',exact:true}).click();
 for(const page of [a,b])await page.waitForFunction(()=>__partyUI.room.state.participants.length===2&&__partyUI.room.state.participants.filter(p=>p.inCall).length===1);
 assert.equal(await a.evaluate(()=>__partyUI.call.state.joined),false);assert.equal(await b.evaluate(()=>__partyUI.call.state.joined),true);assert.equal(await a.locator('.party-chat-toggle').isVisible(),true);assert.equal(await a.locator('.spacevoice').getAttribute('data-context'),'none');assert.equal(signaling.rooms.get(roomId).size,2);
 report.checks.push('A leaves voice, stays present; B remains in call; counts 2/1; room chat remains available');
 await a.getByRole('button',{name:'[ mídia > ]',exact:true}).click();await settle(a);assert.equal(await a.locator('.spacevoice').getAttribute('data-context'),'media');await a.getByRole('button',{name:'[ mídia < ]',exact:true}).click();
 await a.setViewportSize({width:390,height:844});assert.equal(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 for(const page of [a,b])await page.evaluate(()=>{location.hash='perfil';});
 for(const page of [a,b])await page.waitForFunction(()=>__partyUI.room.state.roomId===null&&__partyUI.call.state.joined===false);
 for(let i=0;i<100&&signaling.rooms.has(roomId);i++)await new Promise(r=>setTimeout(r,10));
 assert.equal(signaling.rooms.has(roomId),false);assert.deepEqual(report.errors,[]);report.checks.push('advanced media available in lobby; mobile no overflow; route exit cleans room and call');report.passed=true;
 }catch(error){report.passed=false;report.failure=error.message;report.diagnostics=await Promise.all(pages.map(page=>page.evaluate(()=>({room:__partyUI?.room.state,joined:__partyUI?.call.state.joined,error:document.querySelector('.spacevoice-status')?.textContent,pcs:__pcs?.map(p=>({connection:p.connectionState,signaling:p.signalingState})),mic:__micRequests})).catch(()=>null)));throw error;
 }finally{
 for(const page of pages)await page.evaluate(()=>window.__partyUI?.hide()).catch(()=>{});
 for(const context of contexts)await context.close();await browser?.close();
 for(const socket of signaling.wss.clients)socket.terminate();await new Promise(r=>signaling.wss.close(r));await new Promise(r=>web.close(r));
 report.cleanup={contextsClosed:true,browserClosed:!browser?.isConnected(),webServerClosed:!web.listening,signalingClosed:true};fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
 }
 console.log(JSON.stringify(report,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
