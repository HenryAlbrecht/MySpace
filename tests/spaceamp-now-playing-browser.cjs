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
 await context.addInitScript(()=>{
   window.__dynamicDraws=0;
   const draw=WebGLRenderingContext.prototype.drawArrays;
   WebGLRenderingContext.prototype.drawArrays=function(...args){if(this.canvas.classList.contains('np-dynamic-atmosphere'))__dynamicDraws++;return draw.apply(this,args);};
 });
 await context.route('**/vendor/kawarp/dist/index.js',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync('dist/vendor/kawarp/dist/index.js','utf8')+'\nconst Official=Kawarp;Kawarp=class extends Official{constructor(...args){super(...args);window.__kawarp=this;} };'}));
 let componentMode='fixture';
 await context.route('https://**/*', route=>route.abort());
 const lyricsTtml='<tt xmlns="http://www.w3.org/ns/ttml"><body><div>'+Array.from({length:30},(_,i)=>`<p begin="${i}s" end="${i+1}s">Deterministic shell lyric ${i+1}</p>`).join('')+'</div></body></tt>';
 await context.route('**/vendor/am-lyrics-1.7.4.js', route=>componentMode==='failed' ? route.abort() : route.fulfill({
   contentType:'text/javascript',
   body:`for(const component of document.querySelectorAll('am-lyrics'))component.setAttribute('ttml',${JSON.stringify(lyricsTtml)});\n`+fs.readFileSync('dist/vendor/am-lyrics-1.7.4.js','utf8'),
 }));
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
 // Playing lyrics interpolate between provider samples; the dedicated clock
 // harness covers correction and seek. Keep this shell check inside one sample.
 const firstLyricsTime=await page.evaluate(()=>document.querySelector('am-lyrics').currentTime);
 assert.ok(firstLyricsTime>=12500&&firstLyricsTime<13100, 'lyrics remain within the provider interpolation window');
 const np=page.locator('#spaceampNowPlaying'), toggle=page.getByRole('button',{name:'Lyrics',exact:true});
 async function mode(index,value){const summary=page.locator('.np-menu summary').nth(index);await summary.click();await page.getByRole('combobox',{name:index===0?'Visualizer':'Interface',exact:true}).selectOption(value);await summary.click();}
 assert.equal(await toggle.getAttribute('aria-pressed'),'true');
 const initialCalls=await page.evaluate(()=>__calls.length);
 await toggle.click();assert.match(await np.getAttribute('class'),/np-no-lyrics/);
 assert.equal(await page.evaluate(()=>document.querySelector('.np-lyrics').inert),true);
 await page.evaluate(()=>{__time.position=31;SPACEAMP.progress({position:31});SPACEAMP.update({...SPACEAMP.getState(),title:'Changed hidden'},true);});
 assert.equal(await toggle.getAttribute('aria-pressed'),'false');
 await toggle.click();
 const resumedLyricsTime=await page.evaluate(()=>document.querySelector('am-lyrics').currentTime);
 assert.ok(resumedLyricsTime>=31000&&resumedLyricsTime<31600, 'reenabled lyrics follow the latest provider sample');
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
 await page.waitForFunction(()=>document.querySelector('#spaceampNowPlaying').dataset.atmosphere==='kawarp');
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
 await page.locator('.xmb-item[aria-pressed="true"]').focus();
 await page.evaluate(()=>{window.__xmbOpeningItem=document.activeElement;});
 const xmb=await page.evaluate(()=>{
   const root=document.querySelector('.xmb'),list=root.querySelector('.xmb-items'),nav=root.querySelector('.xmb-categories'),detail=root.querySelector('.xmb-detail');
   window.__xmbMounted={root,list,nav,detail,item:document.activeElement};
   return {listScroll:list.scrollTop,navScroll:nav.scrollLeft,detailScroll:detail.scrollTop,category:nav.querySelector('[aria-pressed="true"]').dataset.category,itemId:document.activeElement.dataset.itemId};
 });
 async function assertXmbContinuity(){
   const current=await page.evaluate(()=>{
     const {root,list,nav,detail,item}=__xmbMounted;
     return {mounted:root===document.querySelector('.xmb')&&list===root.querySelector('.xmb-items')&&nav===root.querySelector('.xmb-categories')&&detail===root.querySelector('.xmb-detail')&&item===list.querySelector('[aria-pressed="true"]'),listScroll:list.scrollTop,navScroll:nav.scrollLeft,detailScroll:detail.scrollTop,category:nav.querySelector('[aria-pressed="true"]').dataset.category,itemId:item.dataset.itemId};
   });
   assert.deepEqual(current,{mounted:true,...xmb},'XMB nodes, selection, category and scroll survive; clock/Now Playing label may update');
 }
 await page.keyboard.press('Enter');
 await page.waitForSelector('#spaceampNowPlaying[open]');
 assert.equal(await toggle.getAttribute('aria-pressed'),'false');assert.equal(await np.getAttribute('data-ui-mode'),'visible');
 assert.equal(await np.getAttribute('data-visualizer-mode'),'auto');await page.keyboard.press('Backspace');
 assert.equal(await page.evaluate(()=>document.body.classList.contains('xmb-active')),true);
 await assertXmbContinuity();
 assert.equal(await page.evaluate(()=>SPACEAMP.getState().playing),true);
 assert.equal(await page.evaluate(()=>document.activeElement===__xmbOpeningItem),true, 'Backspace restores the exact XMB control that opened Now Playing');
 await page.locator('.xmb-now-playing').focus();
 await page.evaluate(()=>{window.__xmbOpeningEntry=document.activeElement;});
 await page.keyboard.press('Enter');await page.waitForSelector('#spaceampNowPlaying[open]');
 await page.keyboard.press('Escape');
 assert.equal(await page.evaluate(()=>document.activeElement===__xmbOpeningEntry),true, 'Escape restores the Now Playing entry when it was the opener');
 await assertXmbContinuity();
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
 await page.waitForFunction(()=>document.querySelector('#spaceampNowPlaying').dataset.atmosphere==='kawarp');
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
 // A slow front-cover decode must not hold up the safe Kawarp texture.
 await page.waitForTimeout(1600);
 await page.evaluate(()=>{
   window.__switchRenderer=__kawarp;window.__switchLoads=0;
   const load=__kawarp.loadImageElement.bind(__kawarp);
   __kawarp.loadImageElement=(...args)=>{__switchLoads++;window.__switchApplied=performance.now();return load(...args);};
   const decode=HTMLImageElement.prototype.decode;
   HTMLImageElement.prototype.decode=function(){
     if(this.crossOrigin!=='anonymous'&&this.src.endsWith('#slow-front'))return decode.call(this).then(()=>new Promise(resolve=>{window.__releaseFront=resolve;}));
     return decode.call(this);
   };
   window.__restoreFront=()=>{HTMLImageElement.prototype.decode=decode;};
   window.__switchStart=performance.now();
   SPACEAMP.update({...SPACEAMP.getState(),artwork:__atmosphereFixtures[1]+'#slow-front'},true);
 });
 await page.waitForFunction(()=>typeof __releaseFront==='function'&&__switchLoads===1);
 assert.equal(await page.evaluate(()=>__switchRenderer===__kawarp),true);
 assert.equal(await page.locator('.np-cover').getAttribute('src'),await page.evaluate(()=>__atmosphereFixtures[0]+'#delayed-palette'));
 assert.ok(await page.evaluate(()=>__switchApplied-__switchStart<1000),'safe texture should load without waiting for front decode');
 assert.equal(await page.evaluate(()=>__kawarp.transitionDuration),1400);
 await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>__kawarp.isTransitioning),true);
 await page.evaluate(()=>{__releaseFront();__restoreFront();});
 await page.waitForFunction(()=>document.querySelector('.np-cover').src.endsWith('#slow-front'));
 assert.equal(await page.evaluate(()=>__switchLoads),1,'front cover readiness must not restart the GPU crossfade');
 await page.waitForTimeout(1150);assert.equal(await page.evaluate(()=>__kawarp.isTransitioning),false);
 console.log('Kawarp artwork switch: safe image applied before held front decode; one texture upload; same instance; native 1400ms blend.');
 // Cross-origin display images are tainted even when the server offers ACAO.
 // The presentation must reuse its anonymous palette image for WebGL.
 await context.route('https://artwork.fixture/cors.png',r=>r.fulfill({contentType:'image/png',headers:{'access-control-allow-origin':'*'},body:fs.readFileSync('dist/profile-art.png')}));
 await page.evaluate(()=>SPACEAMP.update({...SPACEAMP.getState(),artwork:'https://artwork.fixture/cors.png'},true));
 await page.waitForFunction(()=>document.querySelector('#spaceampNowPlaying').dataset.atmosphere==='kawarp'&&document.querySelector('.np-cover').src==='https://artwork.fixture/cors.png');
 await page.waitForTimeout(1200);
 const remoteFrame=()=>page.locator('.np-dynamic-atmosphere').evaluate(n=>{const gl=n.getContext('webgl'),p=new Uint8Array(n.width*n.height*4);gl.readPixels(0,0,n.width,n.height,gl.RGBA,gl.UNSIGNED_BYTE,p);return p.reduce((sum,v)=>sum+v,0);});
 const remoteA=await remoteFrame();await page.waitForTimeout(3000);assert.notEqual(await remoteFrame(),remoteA);
 // Buffering during either seek retains the action, without publishing false PLAYING.
 await page.evaluate(()=>SPACEAMP.update({...SPACEAMP.getState(),source:'YouTube'},true,{playbackStatus:'',stopped:false,available:true}));
 const playingWidth=await page.getByRole('button',{name:'Pausar',exact:true}).evaluate(n=>n.getBoundingClientRect().width);
 for(const action of ['slider','lyrics']){
   await page.evaluate(action=>{if(action==='lyrics')document.querySelector('am-lyrics').dispatchEvent(new CustomEvent('line-click',{detail:{timestamp:42000}}));else document.querySelector('.np-progress').dispatchEvent(new Event('input'));SPACEAMP.update(SPACEAMP.getState(),false,{playbackStatus:'loading'});},action);
   assert.equal(await page.evaluate(()=>SPACEAMP.getState().playing),false);
   assert.equal(await page.getByRole('button',{name:'Pausar',exact:true}).count(),1);
   const loadingDraws=await page.evaluate(()=>__dynamicDraws);await page.waitForTimeout(250);assert.ok(await page.evaluate(()=>__dynamicDraws)>loadingDraws,'YouTube buffering must not freeze atmosphere');
   assert.equal(await page.getByRole('button',{name:'Pausar',exact:true}).evaluate(n=>n.getBoundingClientRect().width),playingWidth);
   await page.evaluate(()=>SPACEAMP.update(SPACEAMP.getState(),true,{playbackStatus:''}));
 }
 await page.evaluate(()=>SPACEAMP.update(SPACEAMP.getState(),false,{playbackStatus:'loading'}));
 await page.getByRole('button',{name:'Pausar',exact:true}).click();
 const pausedBufferDraws=await page.evaluate(()=>__dynamicDraws);await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>__dynamicDraws),pausedBufferDraws,'Explicit pause during buffering freezes atmosphere');
 assert.equal(await page.getByRole('button',{name:'Reproduzir',exact:true}).evaluate(n=>n.getBoundingClientRect().width),playingWidth);
 await page.getByRole('button',{name:'Reproduzir',exact:true}).click();
 const lyricComponent=page.locator('am-lyrics');
 assert.equal(await lyricComponent.getAttribute('line-motion'),null);
 assert.equal(await lyricComponent.getAttribute('no-blur'),null);
 assert.equal(await lyricComponent.getAttribute('autoscroll'),'');
 assert.equal(await lyricComponent.getAttribute('interpolate'),'');
 await page.waitForFunction(()=>document.querySelector('am-lyrics')?.shadowRoot?.getElementById('spaceamp-lyrics-motion-profile'));
 // Exercise controller selection/activation against the unmodified vendor too.
 const vendorLyricsEnabled=await toggle.getAttribute("aria-pressed");
 if(vendorLyricsEnabled!=="true")await toggle.click();
 await page.evaluate(ttml=>document.querySelector("am-lyrics").setAttribute("ttml",ttml),lyricsTtml);
 const vendorClock=await page.evaluate(()=>{const position=__time.position;SPACEAMP.seek(12);return position;});
 await page.waitForFunction(()=>document.querySelector('am-lyrics').shadowRoot.querySelector('.lyrics-line[aria-current="true"][tabindex="0"]'));
 const vendorSelectionClock=await page.evaluate(()=>__time.position);
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('xmb:action',{detail:'right'})));
 assert.equal(await page.evaluate(()=>document.querySelector('am-lyrics').shadowRoot.activeElement?.getAttribute('aria-current')),'true');
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('xmb:action',{detail:'down'})));
 assert.equal(await page.evaluate(()=>__time.position),vendorSelectionClock);
 const nativeTimestamp=await page.evaluate(()=>Number(document.querySelector('am-lyrics').shadowRoot.activeElement.dataset.startTime)/1000);
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('xmb:action',{detail:'primary'})));
 assert.equal(await page.evaluate(()=>__time.position),nativeTimestamp);
 await page.evaluate(position=>{window.dispatchEvent(new CustomEvent('xmb:action',{detail:'back'}));window.dispatchEvent(new CustomEvent('xmb:inputmode',{detail:'keyboard'}));SPACEAMP.seek(position);},vendorClock);
 if(vendorLyricsEnabled!=="true")await toggle.click();

 // Both navigation actions load a new track without flashing Reproduzir.
 await page.evaluate(()=>{window.__navigationIndex=0;SPACEAMP.setNavigation(Object.fromEntries(['next','previous'].map(action=>[action,async()=>{
   SPACEAMP.update({...SPACEAMP.getState(),title:'Navigation '+(++__navigationIndex),sourceUrl:'navigation-'+__navigationIndex,source:'YouTube'},false,{playbackStatus:'',stopped:false});
   await new Promise(r=>setTimeout(r,150));SPACEAMP.update(SPACEAMP.getState(),false,{playbackStatus:'loading'});
 }])));window.__transportLabels=[];new MutationObserver(()=>__transportLabels.push(document.querySelector('.np-play-toggle').textContent)).observe(document.querySelector('.np-play-toggle'),{childList:true,subtree:true});});
 for(const label of ['Próxima','Anterior']){
   await page.evaluate(()=>{__transportLabels.length=0;});await page.getByRole('button',{name:label,exact:true}).click();await page.waitForTimeout(250);
   assert.equal(await page.evaluate(()=>SPACEAMP.getState().playing),false);
   assert.equal(await page.getByRole('button',{name:'Pausar',exact:true}).count(),1);
   assert.equal(await page.evaluate(()=>__transportLabels.includes('Reproduzir')),false);
   await page.evaluate(()=>SPACEAMP.update(SPACEAMP.getState(),true,{playbackStatus:''}));
 }
 // Explicit pause and provider failure cancel navigation presentation immediately.
 await page.getByRole('button',{name:'Próxima',exact:true}).click();await page.waitForTimeout(200);await page.getByRole('button',{name:'Pausar',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Reproduzir',exact:true}).count(),1);
 await page.getByRole('button',{name:'Anterior',exact:true}).click();await page.waitForTimeout(200);
 await page.evaluate(()=>SPACEAMP.update(SPACEAMP.getState(),false,{playbackStatus:'blocked'}));assert.equal(await page.getByRole('button',{name:'Reproduzir',exact:true}).count(),1);
 await page.evaluate(()=>SPACEAMP.update(SPACEAMP.getState(),true,{playbackStatus:''}));
 // Same artwork, unchanged tokens, moving spatial field at 0/2 seconds.
 await page.evaluate(()=>{
   const c=document.createElement('canvas');c.width=c.height=160;const x=c.getContext('2d');
   x.fillStyle='#174b88';x.fillRect(0,0,160,160);x.fillStyle='#ca367d';x.fillRect(0,0,70,100);x.fillStyle='#7fd8d3';x.fillRect(100,80,60,80);x.fillStyle='#e4dcbd';x.fillRect(60,30,35,40);
   SPACEAMP.update({...SPACEAMP.getState(),title:'Temporal fixture',source:'YouTube',artwork:c.toDataURL()},true);
 });
 await page.waitForTimeout(1400);assert.equal(await np.getAttribute('data-atmosphere'),'kawarp');
 const temporalTokens=await np.evaluate(n=>n.style.getPropertyValue('--np-accent'));
 // Hide every source of temporal noise before reading the actual GPU buffer.
 if(await toggle.getAttribute('aria-pressed')==='true')await toggle.click();await mode(0,'off');
 await page.locator('.np-menu summary').last().click();
 await page.getByRole('button',{name:'Ocultar UI agora'}).click();await page.waitForTimeout(500);
 const instance=await page.evaluate(()=>__kawarp.canvas===document.querySelector('.np-dynamic-atmosphere'));assert.equal(instance,true);
 const sample=()=>page.locator('.np-dynamic-atmosphere').evaluate(n=>{
   const gl=n.getContext('webgl'),p=new Uint8Array(n.width*n.height*4);gl.readPixels(0,0,n.width,n.height,gl.RGBA,gl.UNSIGNED_BYTE,p);
   const cells=[];for(let by=0;by<18;by++)for(let bx=0;bx<32;bx++){const sum=[0,0,0];let count=0;
     for(let y=Math.floor(by*n.height/18);y<Math.floor((by+1)*n.height/18);y+=3)for(let x=Math.floor(bx*n.width/32);x<Math.floor((bx+1)*n.width/32);x+=3){const at=(y*n.width+x)*4;for(let c=0;c<3;c++)sum[c]+=p[at+c];count++;}
     cells.push(...sum.map(v=>v/count));}
   const copy=document.createElement('canvas');copy.width=n.width;copy.height=n.height;copy.getContext('2d').drawImage(n,0,0);
   return {cells,png:copy.toDataURL(),time:__kawarp.accumulatedTime,playing:__kawarp.isPlaying};
 });
 const difference=(a,b)=>{let sum=0,changed=0;for(let i=0;i<a.length;i+=3){const d=(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]))/3;sum+=d;if(d>3)changed++;}return {mean:sum/(a.length/3),changed:changed/(a.length/3)};};
 const snapshots=[];let previousSecond=0;
 for(const second of [0,2,5,10]){
   if(second)await page.waitForTimeout((second-previousSecond)*1000);previousSecond=second;
   const frame=await sample();snapshots.push(frame);
   fs.writeFileSync('artifacts/spaceamp-atmosphere/temporal-'+second+'s-raw.png',Buffer.from(frame.png.split(',')[1],'base64'));
   assert.equal(await np.evaluate(n=>n.style.getPropertyValue('--np-accent')),temporalTokens);
   assert.equal(frame.playing,true);
 }
 const deltas=snapshots.slice(1).map(f=>difference(snapshots[0].cells,f.cells));
 for(const delta of deltas){assert.ok(delta.mean>3,JSON.stringify(delta));assert.ok(delta.changed>.2,JSON.stringify(delta));}
 assert.ok(snapshots[3].time>snapshots[0].time+9);
 // Freeze and resume the same canvas, measured for three seconds each.
 const pausedTime=await page.evaluate(()=>__time.position);
 await page.evaluate(()=>SPACEAMP.update(SPACEAMP.getState(),false));
 const pausedDraws=await page.evaluate(()=>__dynamicDraws),pausedFrame=await sample();
 await page.waitForTimeout(3000);const frozenFrame=await sample();
 assert.equal(await page.evaluate(()=>__dynamicDraws),pausedDraws);assert.deepEqual(frozenFrame.cells,pausedFrame.cells);assert.equal(frozenFrame.playing,false);
 assert.equal(await page.evaluate(()=>__time.position),pausedTime);
 await page.evaluate(()=>{window.__pausedInstance=__kawarp;SPACEAMP.update(SPACEAMP.getState(),true);});
 await page.waitForTimeout(3000);const resumed=await sample(),resumeDelta=difference(frozenFrame.cells,resumed.cells);
 assert.ok(resumeDelta.mean>3&&resumeDelta.changed>.2,JSON.stringify(resumeDelta));assert.equal(await page.evaluate(()=>__pausedInstance===__kawarp),true);
 console.log('Raw Kawarp temporal / resume metrics:',JSON.stringify({deltas,resumeDelta}));
 fs.writeFileSync('artifacts/spaceamp-atmosphere/raw-temporal-metrics.json',JSON.stringify({deltas,resumeDelta,pauseDifference:difference(pausedFrame.cells,frozenFrame.cells)},null,2));
 await page.mouse.move(500,300);await page.waitForTimeout(100);
 // Static means the former palette/blur composition and no GPU loop.
 await page.locator('.np-menu summary').first().click();await page.getByRole('combobox',{name:'Fundo',exact:true}).selectOption('static');
 assert.equal(await np.getAttribute('data-atmosphere'),'static');
 const staticDraws=await page.evaluate(()=>__dynamicDraws);await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>__dynamicDraws),staticDraws);
 assert.equal(await page.locator('.np-atmosphere').evaluate(n=>Number(getComputedStyle(n).opacity)>0),true);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('spaceamp-now-playing-preferences-v1')).backgroundMode),'static');
 await page.getByRole('combobox',{name:'Fundo',exact:true}).selectOption('dynamic');await page.locator('.np-menu summary').first().click();
 await page.waitForFunction(before=>document.querySelector('#spaceampNowPlaying').dataset.atmosphere==='kawarp'&&__dynamicDraws>before,staticDraws);
 // Source changes do not change the visual policy.
 await page.evaluate(()=>SPACEAMP.update({...SPACEAMP.getState(),source:'local'},true));
 assert.equal(await np.getAttribute('data-atmosphere'),'kawarp');
 assert.equal(await page.locator('.np-dynamic-atmosphere').evaluate(n=>n.width<=960&&n.height<=540),true);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
 const hiddenDraws=await page.evaluate(()=>__dynamicDraws);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>__dynamicDraws),hiddenDraws);
 await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
 await page.waitForFunction(()=>__dynamicDraws>0);
 await page.evaluate(()=>SPACEAMP.update({...SPACEAMP.getState(),title:'SPACEAMP · Atmosphere',artist:'Artwork fixture',artwork:'profile-art.png'},true));
 await page.keyboard.press('Escape');
 const closedDraws=await page.evaluate(()=>__dynamicDraws);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>__dynamicDraws),closedDraws);
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
 assert.equal(await np.getAttribute('data-atmosphere'),'static');
 const reducedDraws=await page.evaluate(()=>__dynamicDraws);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>__dynamicDraws),reducedDraws);
 await page.evaluate(()=>__changeArt(1));await page.waitForTimeout(100);
 assert.equal(await np.evaluate(n=>n.getAnimations({subtree:true}).length),0);
 assert.equal(await np.evaluate(n=>getComputedStyle(n).transitionDuration),'0s');
 await toggle.click();assert.equal(await page.locator('.np-cover').evaluate(n=>getComputedStyle(n).transitionDuration),'0s');await toggle.click();
 fs.mkdirSync('artifacts/spaceamp-now-playing',{recursive:true});await page.screenshot({path:'artifacts/spaceamp-now-playing/mobile.png'});
 await page.keyboard.press('Escape');
 // Failure of the current local vendor module cannot affect transport or controls.
 componentMode='failed'; await page.reload();await page.waitForSelector('#globalSpaceAmp',{state:'attached'});
 await page.evaluate(()=>{SPACEAMP.update({title:'Offline',artist:'',source:'YouTube',sourceUrl:'offline'},true,{available:true});SpaceAmpNowPlaying.open();});
 await page.waitForFunction(()=>document.querySelector('.np-status').textContent.includes('Não foi possível'));
 assert.equal(await page.evaluate(()=>SPACEAMP.getState().playing),true);
 await page.keyboard.press('Escape');
 // Validated preferences survive reload; playback state is never stored.
 componentMode='fixture';
 await page.evaluate(()=>localStorage.setItem('spaceamp-now-playing-preferences-v1',JSON.stringify({lyricsEnabled:false,visualizerMode:'ambient',uiMode:'visible',backgroundMode:'static',currentTime:999})));
 await page.reload();await page.waitForSelector('#globalSpaceAmp',{state:'attached'});await page.evaluate(()=>SpaceAmpNowPlaying.open());
 assert.equal(await toggle.getAttribute('aria-pressed'),'false');assert.equal(await np.getAttribute('data-visualizer-mode'),'ambient');assert.equal(await np.getAttribute('data-ui-mode'),'visible');assert.equal(await np.getAttribute('data-background-mode'),'static');
 await toggle.click();assert.deepEqual(await page.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('spaceamp-now-playing-preferences-v1'))).sort()),['backgroundMode','lyricsEnabled','uiMode','visualizerMode']);
 await page.keyboard.press('Escape');
 for(const saved of ['{bad',JSON.stringify({lyricsEnabled:'false',visualizerMode:'bad',uiMode:'bad',backgroundMode:'bad'}),'null']){
   await page.evaluate(saved=>localStorage.setItem('spaceamp-now-playing-preferences-v1',saved),saved);await page.reload();await page.waitForSelector('#globalSpaceAmp',{state:'attached'});await page.evaluate(()=>SpaceAmpNowPlaying.open());
   assert.equal(await toggle.getAttribute('aria-pressed'),'true');assert.equal(await np.getAttribute('data-visualizer-mode'),'auto');assert.equal(await np.getAttribute('data-ui-mode'),'auto');await page.keyboard.press('Escape');
 }
 // Failures stay inside presentation, all in this same browser/context.
 await page.emulateMedia({reducedMotion:'no-preference'});
 for(const failure of ['import','webgl','cors']){
   if(failure==='import')await context.route('**/vendor/kawarp/dist/index.js',route=>route.abort());
   await page.reload();await page.waitForSelector('#globalSpaceAmp',{state:'attached'});
   if(failure==='webgl')await page.evaluate(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:get.call(this,type,...args);};});
   if(failure==='cors')await context.route('https://fixture.invalid/art.png',route=>route.fulfill({contentType:'image/png',headers:{'access-control-allow-origin':'https://denied.fixture'},body:fs.readFileSync('dist/profile-art.png')}));
   await page.evaluate(failure=>{SPACEAMP.update({title:'Failure '+failure,artist:'Fixture',source:'YouTube',artwork:failure==='cors'?'https://fixture.invalid/art.png':'profile-art.png'},true,{available:true});SpaceAmpNowPlaying.open();},failure);
   await page.waitForFunction(()=>document.querySelector('.np-cover').dataset.artworkReady==='true');await page.waitForTimeout(400);
   assert.equal(await np.getAttribute('data-atmosphere'),'static',failure);assert.equal(await page.evaluate(()=>SPACEAMP.getState().playing),true);
   if(failure==='cors'){
     await page.evaluate(()=>SPACEAMP.update({...SPACEAMP.getState(),artwork:'profile-art.png'},true));
     await page.waitForFunction(()=>document.querySelector('#spaceampNowPlaying').dataset.atmosphere==='kawarp');
   }
   await page.keyboard.press('Escape');if(failure==='import')await context.unroute('**/vendor/kawarp/dist/index.js');
 }
 assert.deepEqual(errors,[]);console.log('Now Playing: controls, clock, artwork, artwork atmosphere, play/pause/resume, raw temporal 0/2/5/10s, lifecycle, import/WebGL/CORS fallback, XMB, responsive and reduced motion OK.');
 }finally{await browser?.close();await new Promise(r=>web.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});





