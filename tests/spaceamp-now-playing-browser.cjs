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
 await context.route('https://**/*', route=>componentMode==='fixture' && route.request().url().includes('/am-lyrics.min.js') ? route.fulfill({contentType:'text/javascript',body:`customElements.define('am-lyrics',class extends HTMLElement {connectedCallback(){this.textContent='Fixture lyrics';}});`}) : route.abort());
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
 const np=page.locator('#spaceampNowPlaying'), toggle=page.getByRole('button',{name:'Lyrics',exact:true});
 async function mode(index,value){const summary=page.locator('.np-menu summary').nth(index);await summary.click();await page.locator('.np-menu select').nth(index).selectOption(value);await summary.click();}
 assert.equal(await toggle.getAttribute('aria-pressed'),'true');
 const initialCalls=await page.evaluate(()=>__calls.length);
 await toggle.click();assert.match(await np.getAttribute('class'),/np-no-lyrics/);
 assert.equal(await page.evaluate(()=>document.querySelector('.np-lyrics').inert),true);
 await page.evaluate(()=>{__time.position=31;SPACEAMP.progress({position:31});SPACEAMP.update({...SPACEAMP.getState(),title:'Changed hidden'},true);});
 assert.equal(await toggle.getAttribute('aria-pressed'),'false');
 await toggle.click();assert.equal(await page.evaluate(()=>document.querySelector('am-lyrics').currentTime),31000);
 assert.equal(await page.locator('am-lyrics').getAttribute('song-title'),'Changed hidden');
 assert.equal(await page.evaluate(()=>__calls.length),initialCalls);
 await mode(0,'audio');assert.equal(await np.getAttribute('data-visualizer'),'unavailable');
 assert.equal(await page.locator('.np-visualizer').isVisible(),false);
 await mode(0,'ambient');assert.equal(await np.getAttribute('data-visualizer'),'presentation');
 await mode(0,'off');assert.equal(await page.locator('.np-visualizer').isVisible(),false);
 await page.evaluate(()=>{window.__draws=0;const ctx=document.querySelector('.np-visualizer').getContext('2d'),stroke=ctx.stroke.bind(ctx);ctx.stroke=()=>{__draws++;stroke();};});
 await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>__draws),0);
 await mode(0,'auto');assert.equal(await np.getAttribute('data-visualizer'),'presentation');
 await mode(1,'visible');await np.focus();await page.waitForTimeout(4700);assert.doesNotMatch(await np.getAttribute('class'),/np-idle/);
 await page.locator('.np-menu summary').last().click();await page.getByRole('button',{name:'Ocultar UI agora'}).click();
 await page.waitForTimeout(100);assert.match(await np.getAttribute('class'),/np-idle/);
 await page.mouse.move(410,410);assert.doesNotMatch(await np.getAttribute('class'),/np-idle/);
 await mode(1,'auto');
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
 await page.locator('.np-menu summary').first().click();await np.focus();
 await page.waitForTimeout(4700);assert.doesNotMatch(await np.getAttribute('class'),/np-idle/);
 await page.locator('.np-menu summary').first().click();await np.focus();
 await page.evaluate(()=>document.querySelector('#spaceampNowPlaying').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})));
 await page.waitForTimeout(4700);assert.doesNotMatch(await np.getAttribute('class'),/np-idle/);
 await page.evaluate(()=>window.dispatchEvent(new PointerEvent('pointerup')));
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
 assert.equal(await page.locator('audio').count(),1);
 await mode(0,'ambient');assert.equal(await np.getAttribute('data-visualizer'),'presentation');
 await mode(0,'audio');assert.equal(await np.getAttribute('data-visualizer'),'analyser');
 await mode(0,'auto');await toggle.click();await mode(1,'visible');await page.keyboard.press('Escape');
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
 await page.waitForSelector('#spaceampNowPlaying[open]');
 assert.equal(await toggle.getAttribute('aria-pressed'),'false');assert.equal(await np.getAttribute('data-ui-mode'),'visible');
 assert.equal(await np.getAttribute('data-visualizer-mode'),'auto');await page.keyboard.press('Backspace');
 assert.equal(await page.evaluate(()=>document.body.classList.contains('xmb-active')),true);
 assert.equal(await page.evaluate(()=>document.querySelector('.xmb')?.innerHTML),xmb.html);
 assert.equal(await page.evaluate(()=>SPACEAMP.getState().playing),true);
 assert.equal(await page.evaluate(()=>document.activeElement.classList.contains('xmb-play')),true);
 await page.keyboard.press('Escape');await page.keyboard.press('Escape');
 // Artwork-only palette, real local canvas samples, no remote provider.
 await page.evaluate(()=>{
   const make=(a,b)=>{const c=document.createElement('canvas');c.width=c.height=80;const ctx=c.getContext('2d');ctx.fillStyle=a;ctx.fillRect(0,0,80,80);ctx.fillStyle=b;ctx.fillRect(45,0,35,80);return c.toDataURL();};
   window.__art=[make('#bd653a','#834b3e'),make('#396fa8','#344d7e'),make('#558652','#374e40')];window.__artIndex=0;
   window.__globalTheme=document.documentElement.style.cssText;
   window.__changeArt=index=>{__artIndex=index;SPACEAMP.update({title:'Palette '+index,artist:'Local fixture',source:'local',sourceUrl:'local-'+index,artwork:__art[index]},true,{available:true});};
   SPACEAMP.setNavigation({next:()=>__changeArt(1),previous:()=>__changeArt(0),ended:()=>__changeArt(2)});
   __changeArt(0);SpaceAmpNowPlaying.open();
 });
 await page.waitForFunction(()=>document.querySelector('#spaceampNowPlaying').dataset.palette==='artwork');
 await page.waitForTimeout(400);
 const warm=await np.evaluate(n=>n.style.getPropertyValue('--np-accent'));
 const warmBackground=await np.evaluate(n=>getComputedStyle(n).backgroundColor);
 assert.ok(Number(warm.match(/ (\d+)%/)[1])<=68);
 const stableBox=await page.locator('.np-artwork').boundingBox();
 await page.getByRole('button',{name:'Próxima',exact:true}).click();
 await page.waitForFunction(warm=>document.querySelector('#spaceampNowPlaying').style.getPropertyValue('--np-accent')!==warm,warm);
 assert.equal(await page.locator('am-lyrics').getAttribute('song-title'),'Palette 1');
 await page.waitForTimeout(400);assert.deepEqual(await page.locator('.np-artwork').boundingBox(),stableBox);
 assert.notEqual(await np.evaluate(n=>getComputedStyle(n).backgroundColor),warmBackground);
 assert.equal(await page.locator('.np-outgoing').count(),0);
 await page.getByRole('button',{name:'Anterior',exact:true}).click();
 await page.waitForFunction(warm=>document.querySelector('#spaceampNowPlaying').style.getPropertyValue('--np-accent')===warm,warm);
 await page.evaluate(()=>SPACEAMP.finished());await page.waitForFunction(()=>document.querySelector('am-lyrics').getAttribute('song-title')==='Palette 2');
 await page.waitForTimeout(400);assert.equal(await np.getAttribute('data-palette'),'artwork');
 assert.equal(await page.evaluate(()=>document.documentElement.style.cssText),await page.evaluate(()=>__globalTheme));
 // A tainted/readback failure resets only local visual tokens; transport stays live.
 await page.evaluate(()=>{
   const original=CanvasRenderingContext2D.prototype.getImageData;window.__restoreReadback=()=>{CanvasRenderingContext2D.prototype.getImageData=original;};
   CanvasRenderingContext2D.prototype.getImageData=function(...args){if(this.canvas.width===32)throw new DOMException('Fixture CORS','SecurityError');return original.apply(this,args);};
   SPACEAMP.update({...SPACEAMP.getState(),title:'Readback fallback',artwork:__art[0]+'#fallback'},true);
 });
 await page.waitForFunction(()=>document.querySelector('#spaceampNowPlaying').dataset.palette==='fallback');
 assert.equal(await np.evaluate(n=>n.style.getPropertyValue('--np-accent')),'');assert.equal(await page.evaluate(()=>SPACEAMP.getState().playing),true);
 await page.evaluate(()=>{__restoreReadback();__changeArt(0);__changeArt(1);__changeArt(2);});
 await page.waitForFunction(()=>document.querySelector('.np-cover').getAttribute('src')===__art[2]&&document.querySelector('#spaceampNowPlaying').dataset.palette==='artwork');
 await page.waitForTimeout(400);assert.equal(await page.locator('.np-outgoing').count(),0);
 await page.evaluate(()=>SPACEAMP.update({...SPACEAMP.getState(),title:'SPACEAMP · Atmosphere',artist:'Artwork fixture',artwork:'profile-art.png'},true));
 await page.waitForFunction(()=>document.querySelector('.np-cover').getAttribute('src')==='profile-art.png'&&document.querySelector('#spaceampNowPlaying').dataset.palette==='artwork');
 // Character color must survive a largely neutral/skin-toned base; tiny highlights do not count.
 await page.evaluate(()=>{
   const make=(base,accent,neutral=false)=>{const c=document.createElement('canvas');c.width=c.height=80;const x=c.getContext('2d');x.fillStyle=base;x.fillRect(0,0,80,80);x.fillStyle=neutral?'#a0a0a0':'#b69a89';x.fillRect(0,40,32,40);x.fillStyle=accent;x.fillRect(50,10,neutral?2:22,neutral?2:60);return c.toDataURL();};
   window.__atmosphereFixtures=[make('#777777','#ce397d'),make('#287fab','#246197'),make('#398964','#235b49'),make('#747474','#ff00ff',true)];
 });
 const families=[];
 for(const [index,name] of ['pink-character','blue','green','neutral'].entries()){
   await page.evaluate(index=>SPACEAMP.update({...SPACEAMP.getState(),title:'Atmosphere '+index,artwork:__atmosphereFixtures[index]},true),index);
   await page.waitForFunction(index=>document.querySelector('.np-cover').getAttribute('src')===__atmosphereFixtures[index],index);
   await page.waitForTimeout(450);
   const tokens=await np.evaluate(n=>['--np-accent','--np-bg-tint','--np-bg-deep'].map(k=>n.style.getPropertyValue(k)));
   if(index<3){assert.equal(await np.getAttribute('data-palette'),'artwork');families.push(tokens[0]);assert.ok(Number(tokens[0].match(/ (\d+)%/)[1])>=35);}
   else {assert.equal(await np.getAttribute('data-palette'),'fallback');assert.deepEqual(tokens,['','','']);}
   if(index===0){const hue=Number(tokens[0].match(/hsl\((\d+)/)[1]);assert.ok(hue>=300||hue<=35,'neutral base must not suppress the pink character');}
   for(const enabled of [true,false]){
     if(await toggle.getAttribute('aria-pressed')!==String(enabled))await toggle.click();await page.waitForTimeout(400);
     fs.mkdirSync('artifacts/spaceamp-atmosphere',{recursive:true});await page.screenshot({path:`artifacts/spaceamp-atmosphere/${name}-lyrics-${enabled?'on':'off'}.png`});
   }
 }
 assert.equal(new Set(families).size,3);
 // Hold only the palette image's load handler: the previous color must remain intact.
 await page.evaluate(()=>SPACEAMP.update({...SPACEAMP.getState(),artwork:__atmosphereFixtures[2]},true));
 await page.waitForFunction(()=>document.querySelector('#spaceampNowPlaying').dataset.palette==='artwork');
 const previousPalette=await np.evaluate(n=>n.style.getPropertyValue('--np-accent'));
 await page.evaluate(()=>{
   const OriginalImage=window.Image;window.__restorePaletteImage=()=>{window.Image=OriginalImage;};
   window.Image=function(...args){const image=new OriginalImage(...args);image.addEventListener('load',event=>{if(image.crossOrigin==='anonymous'&&image.src.endsWith('#delayed-palette')){event.stopImmediatePropagation();window.__releasePalette=()=>image.onload();}},{capture:true});return image;};
   SPACEAMP.update({...SPACEAMP.getState(),artwork:__atmosphereFixtures[0]+'#delayed-palette'},true);
 });
 await page.waitForFunction(()=>typeof __releasePalette==='function');
 assert.equal(await np.evaluate(n=>n.style.getPropertyValue('--np-accent')),previousPalette);assert.equal(await np.getAttribute('data-palette'),'artwork');
 await page.evaluate(()=>{__releasePalette();__restorePaletteImage();});
 await page.waitForFunction(previous=>document.querySelector('#spaceampNowPlaying').style.getPropertyValue('--np-accent')!==previous,previousPalette);
 await page.evaluate(()=>SPACEAMP.update({...SPACEAMP.getState(),title:'SPACEAMP · Atmosphere',artist:'Artwork fixture',artwork:'profile-art.png'},true));
 await page.keyboard.press('Escape');
 for(const width of [1440,820,390]){
   await page.setViewportSize({width,height:900});await page.evaluate(()=>SpaceAmpNowPlaying.open());
   for(const enabled of [false,true]){
     if(await toggle.getAttribute('aria-pressed')!==String(enabled))await toggle.click();
     await page.waitForTimeout(400);
     if(enabled){const box=await page.locator('.np-lyrics-slot').boundingBox();assert.ok(box.width>180&&box.height>180);}
     const bounds=await page.locator('.np-track').boundingBox();assert.ok(bounds.y>=0&&bounds.y+bounds.height<=900);
     assert.equal(await np.evaluate(n=>n.scrollWidth<=innerWidth&&n.scrollHeight<=innerHeight),true);
     fs.mkdirSync('artifacts/spaceamp-now-playing',{recursive:true});
     await page.screenshot({path:`artifacts/spaceamp-now-playing/${width}-lyrics-${enabled?'on':'off'}.png`});
   }
   assert.equal(await page.evaluate(()=>document.querySelector('#spaceampNowPlaying').scrollWidth<=innerWidth),true);
   await page.keyboard.press('Escape');
 }
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>SpaceAmpNowPlaying.open());
 assert.equal(await page.locator('#spaceampNowPlaying').evaluate(n=>getComputedStyle(n).animationName),'none');
 await page.evaluate(()=>__changeArt(1));await page.waitForTimeout(100);
 assert.equal(await np.evaluate(n=>n.getAnimations({subtree:true}).length),0);
 assert.equal(await np.evaluate(n=>getComputedStyle(n).transitionDuration),'0s');
 await toggle.click();assert.equal(await page.locator('.np-cover').evaluate(n=>getComputedStyle(n).transitionDuration),'0s');await toggle.click();
 fs.mkdirSync('artifacts/spaceamp-now-playing',{recursive:true});await page.screenshot({path:'artifacts/spaceamp-now-playing/mobile.png'});
 await page.keyboard.press('Escape');
 // A CDN failure cannot affect transport or controls.
 componentMode='failed'; await page.reload();await page.waitForSelector('#globalSpaceAmp',{state:'attached'});
 await page.evaluate(()=>{SPACEAMP.update({title:'Offline',artist:'',source:'YouTube',sourceUrl:'offline'},true,{available:true});SpaceAmpNowPlaying.open();});
 await page.waitForFunction(()=>document.querySelector('.np-status').textContent.includes('Não foi possível'));
 assert.equal(await page.evaluate(()=>SPACEAMP.getState().playing),true);
 await page.keyboard.press('Escape');
 // Validated preferences survive reload; playback state is never stored.
 componentMode='fixture';
 await page.evaluate(()=>localStorage.setItem('spaceamp-now-playing-preferences-v1',JSON.stringify({lyricsEnabled:false,visualizerMode:'ambient',uiMode:'visible',currentTime:999})));
 await page.reload();await page.waitForSelector('#globalSpaceAmp',{state:'attached'});await page.evaluate(()=>SpaceAmpNowPlaying.open());
 assert.equal(await toggle.getAttribute('aria-pressed'),'false');assert.equal(await np.getAttribute('data-visualizer-mode'),'ambient');assert.equal(await np.getAttribute('data-ui-mode'),'visible');
 await toggle.click();assert.deepEqual(await page.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('spaceamp-now-playing-preferences-v1'))).sort()),['lyricsEnabled','uiMode','visualizerMode']);
 await page.keyboard.press('Escape');
 for(const saved of ['{bad',JSON.stringify({lyricsEnabled:'false',visualizerMode:'bad',uiMode:'bad'}),'null']){
   await page.evaluate(saved=>localStorage.setItem('spaceamp-now-playing-preferences-v1',saved),saved);await page.reload();await page.waitForSelector('#globalSpaceAmp',{state:'attached'});await page.evaluate(()=>SpaceAmpNowPlaying.open());
   assert.equal(await toggle.getAttribute('aria-pressed'),'true');assert.equal(await np.getAttribute('data-visualizer-mode'),'auto');assert.equal(await np.getAttribute('data-ui-mode'),'auto');await page.keyboard.press('Escape');
 }
 assert.deepEqual(errors,[]);console.log('Now Playing: controls, ms clock, seek, track reset, artwork retention, idle, focus, scroll, XMB, analyser/fallback, responsive, reduced motion and page errors OK.');
 }finally{await browser?.close();await new Promise(r=>web.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});





