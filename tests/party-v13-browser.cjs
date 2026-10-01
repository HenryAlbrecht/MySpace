const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{once}=require('node:events');
const {chromium}=require(path.join(require('node:os').homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const {createServer}=require('../server.cjs'),{createSignalingServer}=require('../server/signaling-server.cjs');
(async()=>{
 const web=createServer(),signal=createSignalingServer({port:0,host:'127.0.0.1'}),contexts=[],errors=[];let browser;
 try{
  await Promise.all([new Promise(r=>web.listen(0,'127.0.0.1',r)),once(signal.wss,'listening')]);
  browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  async function client(url){const context=await browser.newContext({viewport:{width:1440,height:1000}});contexts.push(context);
   await context.addInitScript(()=>{window.__captures=0;navigator.mediaDevices.getUserMedia=()=>{__captures++;throw Error('Unexpected microphone capture');};});
   await context.route('**/spacevoice.js',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync('dist/spacevoice.js','utf8')+';const original=createSpaceVoice;createSpaceVoice=o=>window.__ui=original(o);'}));
   const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await page.goto(url);await page.waitForFunction(()=>window.__ui?.chat.state.connected);return page;
  }
  const url=new URL(`http://127.0.0.1:${web.address().port}/#spacevoice`);url.searchParams.set('voiceWsUrl',`ws://127.0.0.1:${signal.wss.address().port}`);
  const a=await client(url.href),id=new URL(a.url()).searchParams.get('party'),b=await client(a.url());
  await a.waitForFunction(()=>__ui.room.state.participants.length===2);assert.equal(await a.evaluate(()=>__ui.room.state.name),'geral');
  async function rename(name){await a.getByRole('button',{name:'Editar nome da sala',exact:true}).click();await a.getByRole('textbox',{name:'Nome da sala',exact:true}).fill(name);await a.getByRole('button',{name:'[ salvar ]',exact:true}).click();await b.waitForFunction(n=>__ui.room.state.name===n,name);}
  await rename('<img src=x onerror=window.__xss=1>');assert.equal(await b.evaluate(()=>window.__xss),undefined);assert.equal(await b.locator('.party-header img').count(),0);
  await rename('madrugada');
  await a.locator('.party-chat-toggle').click();await a.locator('.spacevoice-chat-input').fill('somente madrugada');await a.getByRole('button',{name:'[ enviar ]',exact:true}).click();await b.waitForFunction(()=>__ui.chat.state.messages.length===1);
  await a.getByRole('button',{name:'[ recentes ]',exact:true}).click();await a.locator('.party-recent-open').waitFor({state:'visible'});
  await a.waitForFunction(()=>document.querySelector('.party-recents').getBoundingClientRect().height>100);
  await a.evaluate(async()=>{await Promise.all(document.querySelector('.party-recents').getAnimations().map(a=>a.finished));});
  fs.mkdirSync('artifacts/party-v13',{recursive:true});await a.screenshot({path:'artifacts/party-v13/room-recents.png'});
  assert.equal(await a.locator('.spacevoice-version').innerText().then(t=>t.includes(id)),false);
  await a.evaluate(async()=>{await __ui.root.querySelector('.party-room-actions button').click();});
  const fallback=await a.locator('.party-invite-fallback').inputValue();if(fallback)assert.equal(new URL(fallback).searchParams.get('party'),id);
  assert.equal(await a.locator('.party-recent-open').innerText().then(t=>t.includes(id)),false);
  await a.getByRole('button',{name:'[ nova party ]',exact:true}).click();await a.waitForFunction(old=>__ui.chat.state.connected&&__ui.room.state.roomId!==old,id);
  assert.equal(await a.evaluate(()=>__ui.room.state.name),'geral');assert.equal(await a.evaluate(()=>__ui.chat.state.messages.length),0);
  await b.waitForFunction(()=>__ui.room.state.participants.length===1);
  if(await a.locator('.party-recents').getAttribute('data-open')!=='true')await a.getByRole('button',{name:'[ recentes ]',exact:true}).click();
  await a.locator('.party-recent-open').filter({hasText:'madrugada'}).click();await a.waitForFunction(id=>__ui.chat.state.connected&&__ui.room.state.roomId===id&&__ui.chat.state.messages.length===1,id);
  await b.waitForFunction(()=>__ui.room.state.participants.length===2);
  assert.equal(await a.evaluate(()=>__ui.room.state.name),'madrugada');
  const stored=await a.evaluate(()=>JSON.parse(localStorage.getItem('party-recent-rooms-v1')));assert.equal(stored[0].roomId,id);assert.equal(stored.length,2);assert.deepEqual(Object.keys(stored[0]),['roomId','name','lastVisited']);
  for(const page of [a,b]){assert.equal(await page.evaluate(()=>__captures),0);assert.equal(await page.evaluate(()=>new Set(__ui.chat.state.messages.map(m=>m.id)).size),1);}
  assert.deepEqual(errors,[]);console.log('PASS: two independent contexts, cold start, default/rename/text XSS, presence counts, recent room navigation, new room/chat isolation/history, no microphone, no console errors.');
 }finally{for(const c of contexts)await c.close();await browser?.close();for(const s of signal.wss.clients)s.terminate();await new Promise(r=>signal.wss.close(r));await new Promise(r=>web.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
