const assert=require('node:assert/strict'),path=require('node:path');
module.exports=async({persistent,report,instrument,snapshot,meshConnected,join,leave,clean,check,output})=>{
  const contexts=[],pages=[];report.chat={};
  const input=p=>p.getByRole('textbox',{name:'Mensagem para a sala'}),lines=p=>p.locator('.spacevoice-chat-line');
  const send=async(p,text)=>{await input(p).fill(text);assert.equal(await input(p).inputValue(),text);await input(p).press('Enter');};
  const contains=async(p,text)=>p.waitForFunction(text=>[...document.querySelectorAll('.spacevoice-chat-text')].some(n=>n.textContent===text),text.trim());
  const bytes=p=>p.evaluate(async()=>{let total=0;for(const pc of window.__voiceTest.pcs.filter(p=>p.connectionState==='connected'))for(const s of (await pc.getStats()).values())if(s.type==='outbound-rtp')total+=s.bytesSent||0;return total;});
  const mediaSnapshot=p=>p.evaluate(()=>{window.__chatMedia={videos:[...document.querySelectorAll('.spacevoice video')].map(node=>({node,stream:node.srcObject})),audios:[...document.querySelectorAll('.spacevoice audio')].map(node=>({node,stream:node.srcObject})),offers:window.__voiceTest.events.filter(e=>e.kind==='createOffer').length};});
  const unchanged=p=>p.evaluate(()=>{const m=window.__chatMedia;return [...m.videos,...m.audios].every(e=>e.node.isConnected&&e.node.srcObject===e.stream)&&m.offers===window.__voiceTest.events.filter(e=>e.kind==='createOffer').length;});
  async function client(url='http://localhost:3000/?voiceWsUrl=ws%3A%2F%2Flocalhost%3A8787#spacevoice',context){
    if(!context){context=await persistent.browser().newContext({permissions:['microphone'],viewport:{width:1440,height:1000}});contexts.push(context);}
    const page=await context.newPage();pages.push(page);page.on('pageerror',e=>report.errors.push({client:'chat',kind:'pageerror',text:e.message}));page.on('console',m=>{if(m.type()==='error')report.errors.push({client:'chat',kind:'console',text:m.text()});});
    await page.addInitScript(instrument);await page.goto(url);return page;
  }
  try{
    const a=await client(),b=await client(),c=await client(),group=[a,b,c];
    for(const p of group)await join(p);await Promise.all(group.map(p=>meshConnected(p,2)));
    for(const p of group)assert.equal(await p.locator('.spacevoice-participants li').count(),3);
    await a.getByRole('button',{name:'[ compartilhar tela ]',exact:true}).click();await a.getByRole('button',{name:'[ parar tela ]',exact:true}).waitFor();
    for(const p of [b,c])await p.waitForFunction(()=>document.querySelector('.spacevoice video')?.srcObject?.getVideoTracks().length===1);
    await Promise.all(group.map(p=>p.waitForFunction(()=>window.__voiceTest.pcs.filter(p=>p.connectionState!=='closed').every(p=>p.signalingState==='stable'))));
    await Promise.all(group.map(mediaSnapshot));const beforeBytes=await Promise.all(group.map(bytes));
    await send(a,'bora testar o chat');await Promise.all(group.map(p=>contains(p,'bora testar o chat')));
    for(const p of group)assert.equal(await lines(p).count(),1);
    const confirmed=await b.evaluate(()=>window.__voiceTest.events.find(e=>e.kind==='ws-receive'&&e.message.type==='chat-message').message);
    assert.equal(confirmed.payload.authorId,confirmed.from);assert.equal(confirmed.payload.roomId,'geral');assert.ok(confirmed.payload.id);assert.ok(confirmed.payload.createdAt>Date.now()-60000);
    const request=await a.evaluate(()=>window.__voiceTest.events.find(e=>e.kind==='ws-send'&&e.message.type==='chat-message').message.payload);
    assert.equal(request.id,undefined);assert.equal(request.createdAt,undefined);assert.equal(request.authorId,undefined);
    await send(b,'foi');await Promise.all(group.map(p=>contains(p,'foi')));
    check('Chat: three independent clients share one existing WS each; confirmed server ID/time/author, sender echo and room broadcast appear exactly once');
    await input(c).fill('estou digitando');for(const p of [a,b])await p.waitForFunction(()=>document.querySelector('.spacevoice-chat-typing').textContent.includes('digitando'));
    await input(c).press('Enter');await Promise.all(group.map(p=>contains(p,'estou digitando')));for(const p of [a,b])await p.waitForFunction(()=>!document.querySelector('.spacevoice-chat-typing').textContent);
    for(const p of group)assert.equal(await unchanged(p),true);
    await a.waitForTimeout(1000);const afterBytes=await Promise.all(group.map(bytes));for(let i=0;i<3;i++)assert.ok(afterBytes[i]>beforeBytes[i]);
    check('Chat + media: typing/send/receive do not create offers or recreate/reset video/audio; native RTP grows while sharing');
    const xss='<script>alert(1)</script>';await a.evaluate(()=>{window.__xssExecuted=false;window.alert=()=>{window.__xssExecuted=true;};});
    await send(a,xss);await Promise.all(group.map(p=>contains(p,xss)));for(const p of group){assert.equal(await p.locator('.spacevoice-chat script').count(),0);assert.equal(await p.evaluate(()=>window.__xssExecuted===true),false);}
    const d=await client();await join(d);group.push(d);await Promise.all(group.map(p=>meshConnected(p,3)));await contains(d,xss);
    for(const p of group){assert.equal(await lines(p).count(),4);assert.equal(await p.evaluate(()=>new Set([...document.querySelectorAll('.spacevoice-chat-line')].map(n=>n.dataset.messageId)).size),4);}
    check('Chat: late fourth participant gets targeted history; existing logs stay deduplicated; script payload is literal text and never executes');
    await a.screenshot({path:path.join(output,'chat-desktop-four.png'),fullPage:true});
    await input(c).fill('draft before exit');for(const p of [a,b,d])await p.waitForFunction(()=>document.querySelector('.spacevoice-chat-typing').textContent.includes('digitando'));
    await leave(c);group.splice(2,1);await Promise.all(group.map(p=>meshConnected(p,2)));for(const p of group)await p.waitForFunction(()=>!document.querySelector('.spacevoice-chat-typing').textContent);
    assert.equal(await lines(c).count(),0);check('Chat: leave clears typing, presence, draft and local chat; previous messages survive for remaining clients');
    await input(b).fill('draft preservado');await b.evaluate(()=>window.__voiceTest.sockets.find(s=>s.readyState===1).close(4001,'chat reconnect'));
    await b.waitForFunction(()=>window.__voiceTest.pcs.every(p=>p.connectionState==='closed'));await send(a,'durante reconnect');await contains(d,'durante reconnect');await Promise.all(group.map(p=>meshConnected(p,2)));await contains(b,'durante reconnect');
    assert.equal(await input(b).inputValue(),'draft preservado');for(const p of group)assert.equal(await lines(p).count(),5);
    await send(b,'depois do reconnect');await Promise.all(group.map(p=>contains(p,'depois do reconnect')));
    check('Chat: real WS drop/reconnect preserves unsent draft, reconciles history once and allows new sends; RTC recovers');
    await input(a).fill('x'.repeat(2001));assert.equal(await a.getByRole('button',{name:'[ enviar ]',exact:true}).isDisabled(),true);await input(a).press('Enter');assert.match(await a.locator('.spacevoice-chat-error').textContent(),/2000/);
    await a.evaluate(()=>{const socket=window.__voiceTest.sockets.find(s=>s.readyState===1),join=window.__voiceTest.events.find(e=>e.kind==='ws-send'&&e.message.type==='join').message;socket.send(JSON.stringify({type:'chat-message',roomId:'geral',from:join.from,payload:{text:'x'.repeat(2001)}}));});
    await a.waitForFunction(()=>window.__voiceTest.events.some(e=>e.kind==='ws-receive'&&e.message.type==='chat-error'&&e.message.payload.code==='invalid'));
    for(const p of group)assert.equal(await p.evaluate(()=>window.__voiceTest.sockets.filter(s=>s.readyState===1).length),1);
    await input(a).fill('');await input(a).press('Shift+Enter');assert.equal(await input(a).inputValue(),'\n');await input(a).press('Enter');for(const p of group)assert.equal(await lines(p).count(),6);
    check('Chat: overlong input blocked locally/rejected server-side without socket drop; Shift+Enter newline and whitespace do not send');
    // Enough wrapped lines to exercise manual scroll, without bypassing spam limits.
    await a.waitForTimeout(5200);for(let i=0;i<4;i++){const text='linha '+i+' '+('old web / teste de scroll '.repeat(18));await send(a,text);await contains(b,text);}
    await b.evaluate(()=>{const log=document.querySelector('.spacevoice-chat-log');log.scrollTop=0;log.dispatchEvent(new Event('scroll'));});
    const scroll=await b.locator('.spacevoice-chat-log').evaluate(n=>({top:n.scrollTop,height:n.scrollHeight,client:n.clientHeight}));assert.ok(scroll.height>scroll.client);
    await send(a,'nova mensagem sem roubar scroll');await contains(b,'nova mensagem sem roubar scroll');assert.equal(await b.locator('.spacevoice-chat-log').evaluate(n=>n.scrollTop),0);await b.getByRole('button',{name:'[ 1 novas mensagens ]',exact:true}).waitFor();
    await b.getByRole('button',{name:'[ 1 novas mensagens ]',exact:true}).click();await b.waitForFunction(()=>{const n=document.querySelector('.spacevoice-chat-log');return n.scrollHeight-n.scrollTop-n.clientHeight<32;});
    await d.getByRole('button',{name:'[ chat ]',exact:true}).click();await send(b,'chat oculto');await contains(d,'chat oculto');await d.getByRole('button',{name:'[ chat · 1 ]',exact:true}).click();assert.equal(await d.getByRole('button',{name:'[ chat ]',exact:true}).count(),1);
    check('Chat: near-bottom autoscroll, manual scroll preserved, new-message counter and hidden-panel unread/open reset work');
    const e=await client();await e.evaluate(async()=>{
      window.__privateMessages=[];window.__privateStream=await navigator.mediaDevices.getUserMedia({audio:true});window.__privateSession=createVoiceSession({clientId:crypto.randomUUID(),signaling:o=>createWebSocketVoiceSignaling({...o,url:'ws://localhost:8787'}),onApplication:m=>window.__privateMessages.push(m),onPeers(){},onStream(){},onRemove(){},onError:e=>{throw Error(e);}});window.__privateSession.start(window.__privateStream,'privado-teste');
    });await e.waitForFunction(()=>window.__privateMessages.some(m=>m.type==='chat-history'));
    await b.waitForTimeout(5200);await send(b,'somente geral');await contains(a,'somente geral');await e.evaluate(()=>window.__privateSession.sendApplication('chat-message',{text:'somente privado',authorName:'Privado'}));await e.waitForFunction(()=>window.__privateMessages.some(m=>m.type==='chat-message'));
    assert.equal(await e.evaluate(()=>window.__privateMessages.some(m=>m.type==='chat-message'&&m.payload.text==='somente geral')),false);for(const p of group)assert.equal(await p.locator('.spacevoice-chat-text').filter({hasText:'somente privado'}).count(),0);
    await e.evaluate(()=>{window.__privateSession.close();window.__privateStream.getTracks().forEach(t=>t.stop());});check('Chat: geral and privado-teste isolate messages and snapshots through real server membership');
    await Promise.all(group.map(p=>meshConnected(p,2)));report.chat.clients=await Promise.all(group.map(snapshot));report.chat.messages=await a.locator('.spacevoice-chat-line').evaluateAll(ns=>ns.map(n=>({id:n.dataset.messageId,authorId:n.dataset.authorId,createdAt:n.dataset.createdAt,text:n.textContent})));
    report.chat.rtp={before:beforeBytes,after:afterBytes};for(const p of group)assert.equal(await p.evaluate(()=>window.__voiceTest.displays.length),p===a?1:0);
    await a.screenshot({path:path.join(output,'chat-desktop.png'),fullPage:true});
    await a.setViewportSize({width:390,height:844});await a.evaluate(()=>{document.querySelector('.spacevoice').scrollIntoView();});assert.ok(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await a.screenshot({path:path.join(output,'chat-mobile.png'),fullPage:true});
    await a.setViewportSize({width:1440,height:1000});check('Chat visual: narrow IRC-style panel, screen/call stays live, desktop/mobile have no horizontal overflow');
    for(const p of group)await leave(p);await Promise.all(group.map(clean));
    const localContext=await persistent.browser().newContext({permissions:['microphone'],viewport:{width:1280,height:900}});contexts.push(localContext);
    const l1=await client('http://localhost:3000/?voiceTransport=local#spacevoice',localContext),l2=await client('http://localhost:3000/?voiceTransport=local#spacevoice',localContext);await join(l1);await join(l2);await Promise.all([l1,l2].map(p=>meshConnected(p,1)));
    await send(l1,'BroadcastChannel chat');await Promise.all([l1,l2].map(p=>contains(p,'BroadcastChannel chat')));assert.equal(await lines(l1).count(),1);assert.equal(await lines(l2).count(),1);
    await input(l2).fill('local typing');await l1.waitForFunction(()=>document.querySelector('.spacevoice-chat-typing').textContent.includes('digitando'));await input(l2).fill('');await l1.waitForFunction(()=>!document.querySelector('.spacevoice-chat-typing').textContent);
    for(const p of [l1,l2]){assert.equal((await snapshot(p)).sockets.length,0);await leave(p);}check('Chat local: same BroadcastChannel transport supports self echo, room chat and throttled typing without WS');
    assert.equal(report.errors.length,0);
  }catch(error){report.chat.failure=await Promise.all(pages.map(async p=>({snapshot:await snapshot(p),chat:await p.locator('.spacevoice-chat').textContent(),input:await input(p).inputValue()})));throw error;}
  finally{for(const context of contexts)await context.close();}
};
