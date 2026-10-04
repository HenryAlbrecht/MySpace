// One browser/context, deterministic component/provider fixtures, no remote playback.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const {chromium} = require(path.join(require('node:os').homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const {createServer} = require('../server.cjs');
const web = createServer({music:{search:async()=>({items:[]}),details:async()=>({}),summary:async()=>({}),recommendations:async()=>({items:[]})}});
let browser;
(async()=>{try{
 await new Promise(r=>web.listen(0,'127.0.0.1',r));
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 let componentMode='fixture';
 await context.route('https://**/*', route=>componentMode==='real' && route.request().url().startsWith('https://cdn.jsdelivr.net/') ? route.continue() : componentMode==='fixture' && route.request().url().includes('/am-lyrics.min.js') ? route.fulfill({contentType:'text/javascript',body:`customElements.define('am-lyrics',class extends HTMLElement {connectedCallback(){this.textContent='Fixture lyrics';}});`}) : route.abort());
 const page=await context.newPage(), errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+web.address().port+'/?voiceTransport=local#perfil');
 await page.waitForSelector('#globalSpaceAmp');
 await page.evaluate(()=>{
   const a=SPACEAMP; window.__calls=[];
   window.__time={position:12.5,duration:180};
   a.configure({getPlaybackTime:()=>__time,play:()=>{__calls.push('play');a.update(a.getState(),true)},pause:()=>{__calls.push('pause');a.update(a.getState(),false)},seek:t=>{__calls.push(['seek',t]);__time.position=t;a.progress({position:t})},setVolume:v=>a.progress({volume:v})});
   a.update({title:'First',artist:'Artist',source:'YouTube',sourceUrl:'fixture',artwork:'profile-art.png'},true,{available:true});
   document.body.style.minHeight='2400px';window.scrollTo(0,300);
 });
 await page.waitForTimeout(400);
 const before=await page.evaluate(()=>scrollY);
 await page.locator('#album').click();await page.waitForSelector('#spaceampNowPlaying[open]');
 await page.waitForFunction(()=>customElements.get('am-lyrics'));
 assert.equal(await page.locator('audio').count(),1);
 assert.equal(await page.evaluate(()=>document.querySelector('am-lyrics').currentTime),12500);
 await page.evaluate(()=>{document.querySelector('am-lyrics').dispatchEvent(new CustomEvent('line-click',{detail:{timestamp:42000}}));});
 assert.equal(await page.evaluate(()=>__time.position),42);
 await page.getByRole('button',{name:'Pausar',exact:true}).click();
 assert.equal(await page.evaluate(()=>SPACEAMP.getState().playing),false);
 assert.equal(await page.evaluate(()=>document.querySelector('am-lyrics').duration),180000);
 await page.getByRole('button',{name:'Reproduzir',exact:true}).click();
 assert.equal(await page.evaluate(()=>SPACEAMP.getState().playing),true);
 await page.evaluate(()=>{window.__previousLyrics=document.querySelector('am-lyrics');SPACEAMP.update({title:'Next',artist:'Next Artist',source:'YouTube',sourceUrl:'next',artwork:'profile-art.png'},true,{available:true});});
 assert.equal(await page.locator('am-lyrics').getAttribute('song-title'),'Next');
 assert.equal(await page.evaluate(()=>__previousLyrics.isConnected),false);
 await page.waitForFunction(()=>document.querySelector('.np-cover').dataset.artworkReady==='true');
 await page.evaluate(()=>SPACEAMP.update({...SPACEAMP.getState(),title:'Third',artwork:'profile-art.png?next'},true));
 assert.equal(await page.evaluate(()=>document.querySelector('.np-cover').dataset.artworkReady),'true');
 assert.equal(await page.locator('#spaceampNowPlaying').getAttribute('data-visualizer'),'presentation');
 await page.evaluate(()=>document.querySelector('#spaceampNowPlaying').focus());
 await page.waitForTimeout(4700); assert.match(await page.locator('#spaceampNowPlaying').getAttribute('class'),/np-idle/);
 await page.mouse.move(400,400);await page.waitForTimeout(50); assert.doesNotMatch(await page.locator('#spaceampNowPlaying').getAttribute('class'),/np-idle/);
 await page.getByRole('button',{name:'Pausar',exact:true}).focus();await page.waitForTimeout(4700);assert.doesNotMatch(await page.locator('#spaceampNowPlaying').getAttribute('class'),/np-idle/);
 await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.querySelector('#spaceampNowPlaying').contains(document.activeElement)),true);
 const calls=await page.evaluate(()=>__calls.length);await page.keyboard.press('Escape');
 assert.equal(await page.evaluate(()=>SpaceAmpNowPlaying.isOpen()),false);
 assert.equal(await page.evaluate(()=>scrollY),before);assert.equal(await page.evaluate(()=>document.activeElement.id),'album');assert.equal(await page.evaluate(()=>__calls.length),calls);
 // Local analyser uses the original audio, never a second audio or iframe PCM.
 await page.evaluate(()=>{
   const buffer=new ArrayBuffer(44+16000),v=new DataView(buffer),str=(at,s)=>[...s].forEach((c,i)=>v.setUint8(at+i,c.charCodeAt(0)));
   str(0,'RIFF');v.setUint32(4,36+16000,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,8000,true);v.setUint32(28,16000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,16000,true);
   const audio=document.querySelector('#audio');audio.src=URL.createObjectURL(new Blob([buffer],{type:'audio/wav'}));
   SPACEAMP.update({title:'Local',artist:'',source:'local',sourceUrl:'blob:fixture',artwork:'profile-art.png'},false,{available:true});
 });
 await page.locator('#album').click();await page.waitForFunction(()=>document.querySelector('#spaceampNowPlaying').dataset.visualizer==='analyser');
 assert.equal(await page.locator('audio').count(),1);await page.keyboard.press('Escape');
 // XMB remains mounted with selection/scroll/fullscreen state untouched.
 await page.evaluate(()=>{location.hash='colecao';});await page.getByRole('button',{name:'[ modo XMB ]',exact:true}).click();
 await page.evaluate(()=>{
   CollectionActions.saveMusic({title:'XMB fixture song',artist:'Fixture Artist',playbackSource:{type:'youtube',url:'https://www.youtube.com/watch?v=dQw4w9WgXcQ'}});
   SPACEAMP.configure({select:value=>{__calls.push(['select',value.title]);SPACEAMP.update({title:value.title,artist:value.artist,source:'YouTube',sourceUrl:value.url,artwork:'profile-art.png'},true,{available:true});}});
 });
 await page.locator('.xmb-category[data-category="music"]').click();
 await page.locator('.xmb-item[aria-pressed="true"]').focus();await page.keyboard.press('Enter');
 await page.locator('.xmb-play').focus();
 const xmb=await page.evaluate(()=>{const n=document.querySelector('.xmb');return {html:n?.innerHTML,scroll:n?.scrollTop};});
 await page.keyboard.press('Enter');
 await page.waitForSelector('#spaceampNowPlaying[open]');await page.keyboard.press('Backspace');
 assert.equal(await page.evaluate(()=>document.body.classList.contains('xmb-active')),true);
 assert.equal(await page.evaluate(()=>document.querySelector('.xmb')?.innerHTML),xmb.html);
 assert.equal(await page.evaluate(()=>SPACEAMP.getState().playing),true);
 assert.equal(await page.evaluate(()=>document.activeElement.classList.contains('xmb-play')),true);
 await page.keyboard.press('Escape');await page.keyboard.press('Escape');
 for(const width of [1440,820,390]){
   await page.setViewportSize({width,height:900});await page.evaluate(()=>SpaceAmpNowPlaying.open());
   const box=await page.locator('.np-lyrics-slot').boundingBox();assert.ok(box.width>180&&box.height>180);
   assert.equal(await page.evaluate(()=>document.querySelector('#spaceampNowPlaying').scrollWidth<=innerWidth),true);
   await page.keyboard.press('Escape');
 }
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>SpaceAmpNowPlaying.open());
 assert.equal(await page.locator('#spaceampNowPlaying').evaluate(n=>getComputedStyle(n).animationName),'none');
 fs.mkdirSync('artifacts/spaceamp-now-playing',{recursive:true});await page.screenshot({path:'artifacts/spaceamp-now-playing/mobile.png'});
 await page.keyboard.press('Escape');
 // A CDN failure cannot affect transport or controls.
 componentMode='failed'; await page.reload();await page.waitForSelector('#globalSpaceAmp',{state:'attached'});
 await page.evaluate(()=>{SPACEAMP.update({title:'Offline',artist:'',source:'YouTube',sourceUrl:'offline'},true,{available:true});SpaceAmpNowPlaying.open();});
 await page.waitForFunction(()=>document.querySelector('.np-status').textContent.includes('Não foi possível'));
 assert.equal(await page.evaluate(()=>SPACEAMP.getState().playing),true);
 await page.keyboard.press('Escape');
 // Verify the real pinned official component in the SAME browser/context.
 // TTML is a tiny local fixture; no real lyrics or playback provider is consulted.
 componentMode='real';await page.reload();await page.waitForSelector('#globalSpaceAmp',{state:'attached'});
 await page.evaluate(()=>{
  SPACEAMP.configure({getPlaybackTime:()=>({position:12.5,duration:180})});
  SPACEAMP.update({title:'Native fixture',artist:'Fixture',source:'YouTube',sourceUrl:'native',artwork:'profile-art.png'},true,{available:true});
  SpaceAmpNowPlaying.open();
  document.querySelector('am-lyrics').setAttribute('ttml','<tt xmlns="http://www.w3.org/ns/ttml"><body><div><p begin="00:00:10.000" end="00:00:20.000"><span begin="00:00:10.000" end="00:00:15.000">Native lyrics</span></p></div></body></tt>');
 });
 await page.waitForFunction(()=>!!customElements.get('am-lyrics'),{},{timeout:20000});
 await page.waitForFunction(()=>document.querySelector('am-lyrics').shadowRoot?.textContent.includes('Native lyrics'));
 assert.equal(await page.evaluate(()=>document.querySelector('am-lyrics').currentTime),12500);
 await page.evaluate(()=>SPACEAMP.update(SPACEAMP.getState(),false));
 await page.waitForTimeout(200);
 assert.equal(await page.evaluate(()=>document.querySelector('am-lyrics').currentTime),12500);
 await page.screenshot({path:'artifacts/spaceamp-now-playing/native-mobile.png'});
 assert.deepEqual(errors,[]);console.log('Now Playing: controls, ms clock, seek, track reset, artwork retention, idle, focus, scroll, XMB, analyser/fallback, responsive, reduced motion and page errors OK.');
 }finally{await browser?.close();await new Promise(r=>web.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});





