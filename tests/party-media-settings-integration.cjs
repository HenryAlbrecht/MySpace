// One focused native WebRTC integration: one browser, two contexts, synthetic screen.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(path.join(require('node:os').homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const output=path.resolve('artifacts/party-v08');fs.mkdirSync(output,{recursive:true});
const report={browserContexts:2,errors:[],checks:[]};
const files=['media-settings','media','devices','levels','state','signaling-local','signaling-ws','peer','session','chat'];
const html=`<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="style.css"><link rel="stylesheet" href="motion.css"><link rel="stylesheet" href="spacevoice.css"></head><body style="padding:32px"><main>${files.map(f=>`<script src="voice/${f}.js"></script>`).join('')}<script src="spacevoice.js"></script><script>
window.SPACEVOICE_CONFIG={transport:'local',iceServers:[]};
createLocalVoiceSignaling=options=>{window.__receive=options.onMessage;window.__clientId=options.clientId;options.onStatus('conectado');return {send:(type,to,payload)=>{window.__send({type,to,payload,from:options.clientId,roomId:options.roomId});return true;},close(){}};};
window.__pc=[];const NativePeer=RTCPeerConnection;RTCPeerConnection=class extends NativePeer{constructor(...args){super(...args);__pc.push(this);this.offers=0;this.addEventListener('negotiationneeded',()=>this.offers++);}};
window.__displays=0;navigator.mediaDevices.getDisplayMedia=async()=>{__displays++;const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;let i=0;window.__timer=setInterval(()=>{const c=canvas.getContext('2d');c.fillStyle=i++%2?'#22364b':'#263e52';c.fillRect(0,0,1280,720);},50);window.__screen=canvas.captureStream(20);const ac=new AudioContext();window.__ac=ac;const source=ac.createOscillator(),dest=ac.createMediaStreamDestination();source.connect(dest);source.start();__screen.addTrack(dest.stream.getAudioTracks()[0]);return __screen;};
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
const button=(text,fn)=>{const n=el('button','',text);n.onclick=fn;return n;};
window.ui=createSpaceVoice({getProfile:()=>({name:'Teste PARTY'}),el,button});document.querySelector('main').append(ui.root);
</script></main></body></html>`;
(async()=>{
 const root=path.resolve('dist');const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname;if(pathname==='/fixture'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(html);}const file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}try{res.setHeader('Content-Type',path.extname(file)==='.js'?'text/javascript':path.extname(file)==='.css'?'text/css':'image/png');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
 let browser;const contexts=[],pages=[],ids=new Map();const pending=[];let closing=false;
 try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
 for(let i=0;i<2;i++){
  const context=await browser.newContext({viewport:{width:1440,height:1000},permissions:['microphone']});contexts.push(context);
  const page=await context.newPage();pages.push(page);page.on('pageerror',e=>report.errors.push(e.message));
  await page.exposeFunction('__send',async message=>{
    if(closing)return;ids.set(message.from,i);
    const deliver=async()=>{const other=pages[1-i];if(!other||!await other.evaluate(()=>!!window.__receive).catch(()=>false))return false;
      await other.evaluate(m=>window.__receive(m),message);return true;};
    if(!await deliver())pending.push({i,message});
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/fixture`);
 }
 for(const item of pending)await pages[1-item.i].evaluate(m=>window.__receive(m),item.message);
 const [a,b]=pages;await a.getByRole('button',{name:'[ entrar na chamada ]',exact:true}).click();await b.getByRole('button',{name:'[ entrar na chamada ]',exact:true}).click();
 for(const page of pages)await page.waitForFunction(()=>__pc.length===1&&__pc[0].connectionState==='connected',{},{timeout:15000});
 await a.getByRole('button',{name:'[ mídia avançada ]',exact:true}).click();
 await a.getByLabel('Bitrate do microfone',{exact:true}).selectOption('48000');
 await a.waitForFunction(()=>__pc[0].getSenders().find(s=>s.track?.kind==='audio').getParameters().encodings[0].maxBitrate===48000);
 await a.getByLabel('Cancelamento de eco',{exact:true}).uncheck();
 await a.waitForFunction(()=>!document.querySelector('.party-media-notice').textContent && ui.call.state.localStream.getAudioTracks()[0].getSettings().echoCancellation===false);
 await a.getByRole('button',{name:'Compartilhar tela',exact:true}).click();
 await a.waitForFunction(()=>__pc[0].getSenders().filter(s=>s.track).length===3&&__pc[0].signalingState==='stable');
 await a.waitForFunction(()=>__pc[0].getSenders().find(s=>s.track?.kind==='video')?.getParameters().encodings[0].maxBitrate===10000000);
 const before=await a.evaluate(()=>({offers:__pc[0].offers,displays:__displays,pcs:__pc.length}));
 await a.evaluate(()=>{window.__beforeVideo=ui.call.state.screenStream.getVideoTracks()[0];});
 await a.getByLabel('Bitrate do áudio da tela',{exact:true}).selectOption('256000');
 await a.waitForFunction(()=>!document.querySelector('.party-media-notice').textContent);
 await a.getByLabel('Bitrate do vídeo da tela',{exact:true}).selectOption('14000000');
 await a.waitForFunction(()=>!document.querySelector('.party-media-notice').textContent);
 await a.getByLabel('Conteúdo',{exact:true}).selectOption('detail');
 await a.waitForFunction(()=>{const senders=__pc[0].getSenders();return senders.find(s=>s.track?.kind==='video').getParameters().encodings[0].maxBitrate===14000000 && senders.find(s=>s.track===ui.call.state.screenStream.getAudioTracks()[0]).getParameters().encodings[0].maxBitrate===256000 && __beforeVideo.contentHint==='detail';});
 assert.deepEqual(await a.evaluate(()=>({offers:__pc[0].offers,displays:__displays,pcs:__pc.length})),before);
 assert.equal(await a.evaluate(()=>__beforeVideo===ui.call.state.screenStream.getVideoTracks()[0]),true);
 report.runtime=await a.evaluate(()=>({microphone:__pc[0].getSenders().find(s=>s.track===ui.call.state.localStream.getAudioTracks()[0]).getParameters().encodings[0].maxBitrate,screenAudio:__pc[0].getSenders().find(s=>s.track===ui.call.state.screenStream.getAudioTracks()[0]).getParameters().encodings[0].maxBitrate,screenVideo:__pc[0].getSenders().find(s=>s.track?.kind==='video').getParameters().encodings[0].maxBitrate,echoCancellation:ui.call.state.localStream.getAudioTracks()[0].getSettings().echoCancellation,contentHint:__beforeVideo.contentHint}));
 await a.screenshot({path:path.join(output,'media-advanced.png'),fullPage:true});
 await a.getByLabel('Bitrate do vídeo da tela',{exact:true}).selectOption('null');
 await a.waitForFunction(()=>!('maxBitrate' in __pc[0].getSenders().find(s=>s.track?.kind==='video').getParameters().encodings[0]));
 await a.getByRole('button',{name:'[ restaurar recomendados ]',exact:true}).click();
 await a.waitForFunction(()=>__pc[0].getSenders().find(s=>s.track?.kind==='video').getParameters().encodings[0].maxBitrate===10000000&&ui.call.state.localStream.getAudioTracks()[0].getSettings().echoCancellation===true&&!document.querySelector('.party-media-notice').textContent);
 await a.setViewportSize({width:390,height:844});assert.equal(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 report.checks=['native RTC connected in two contexts','runtime microphone maxBitrate and constraints','screen audio/video ceilings isolated','detail hint','same video/PC; one display capture; no new negotiation on encoding change','automatic deletes ceiling','reset applies active tracks/senders','mobile panel has no overflow'];
 assert.deepEqual(report.errors,[]);report.passed=true;
 }catch(error){
 report.passed=false;report.failure=error.message;
 report.diagnostics=await pages[0]?.evaluate(()=>({notice:document.querySelector('.party-media-notice')?.textContent,settings:JSON.parse(localStorage.getItem('spacevoice-audio-preferences')||'{}').mediaSettings,mic:ui.call.state.localStream?.getAudioTracks()[0]?.getSettings(),encodings:__pc[0]?.getSenders().map(s=>({kind:s.track?.kind,encodings:s.getParameters().encodings}))})).catch(()=>null);
 throw error;
 }finally{
 closing=true;
 for(const page of pages)await page.evaluate(async()=>{ui?.leave();clearInterval(window.__timer);window.__screen?.getTracks().forEach(t=>t.stop());await window.__ac?.close();}).catch(()=>{});
 for(const context of contexts)await context.close();await browser?.close();await new Promise(resolve=>server.close(resolve));report.cleanup={contextsClosed:true,browserClosed:true,serverClosed:true};fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
 }
 console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
