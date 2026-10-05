// One browser/context for input, continuity, reduced motion and viewport checks.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(require('node:os').homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const {createServer}=require('../server.cjs');const web=createServer({music:{search:async()=>({items:[]}),details:async()=>({}),summary:async()=>({}),recommendations:async()=>({items:[]})}});let browser;
(async()=>{try{
 await new Promise(r=>web.listen(0,'127.0.0.1',r));browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 await context.addInitScript(()=>{
  window.__pad=null;Object.defineProperty(navigator,'getGamepads',{value:()=>[__pad]});
  document.addEventListener('DOMContentLoaded',()=>{document.documentElement.requestFullscreen=()=>Promise.reject(Error('fixture viewport'));},{once:true});
 });
 await context.route('https://**/*',r=>r.abort());
 await context.route('**/vendor/am-lyrics-1.7.4.js',r=>r.fulfill({contentType:'text/javascript',body:`customElements.define('am-lyrics',class extends HTMLElement{constructor(){super();this.attachShadow({mode:'open'}).innerHTML='<div>Fixture lyrics</div>'}});`}));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+web.address().port+'/?voiceTransport=local#perfil');await page.waitForSelector('#globalSpaceAmp');
 await page.evaluate(()=>{
  const el=(tag,cls,text='')=>{const n=document.createElement(tag);n.className=cls;n.textContent=text;return n;};
  const button=(text,action,cls)=>{const n=el('button',cls,text);n.onclick=action;return n;};
  window.__rows=Array.from({length:35},(_,i)=>({id:'track-'+i,kind:'music',title:'Track '+i,artist:'Fixture Artist',status:'completed',image:'profile-art.png',playbackSource:{type:'local',fileRef:'fixture-'+i}}));
  __rows.push({id:'game-0',kind:'game',title:'Game',status:'completed'});
  window.__plays=[];window.__pages=[];window.__clock={position:42,duration:180};
  SPACEAMP.configure({select:t=>{__plays.push(t.collectionId);SPACEAMP.update({title:t.title,artist:t.artist,artwork:t.album,source:'local',sourceUrl:t.fileRef},true,{available:true});},getPlaybackTime:()=>__clock,play:()=>SPACEAMP.update(SPACEAMP.getPlaybackState(),true),pause:()=>SPACEAMP.update(SPACEAMP.getPlaybackState(),false),seek:t=>{__clock.position=t;},setVolume:()=>{}});
  window.__xmb=createXmb({getData:()=>({items:__rows,photos:[]}),getProfile:()=>({name:'Fixture'}),getFilters:()=>({kind:'music'}),openItem:item=>__pages.push(item.id),navigate:()=>{},openPhoto:()=>{},el,button,imageNode:(src,alt)=>{const n=document.createElement('img');n.src=src;n.alt=alt;return n;}});
  // Menu entry uses the same public enter contract as the Collection button.

 });
 async function pad(button,hold=70){await page.evaluate(i=>{__pad||={index:0,mapping:'standard',buttons:Array.from({length:16},()=>({pressed:false,value:0})),axes:[0,0]};__pad.buttons[i].pressed=true;},button);await page.waitForTimeout(hold);await page.evaluate(i=>__pad.buttons[i].pressed=false,button);await page.waitForTimeout(50);}
 const selected=()=>page.locator('#xmb-fixture .xmb-item[aria-pressed=true]');
 await pad(9);await page.waitForSelector('.xmb:not([hidden])');await pad(1);
 await page.evaluate(()=>{__xmb.enter();[...document.querySelectorAll('.xmb')].at(-1).id='xmb-fixture';});
 await page.keyboard.press('ArrowDown');assert.equal(await selected().getAttribute('data-index'),'1');
 await page.keyboard.press('d');assert.equal(await page.locator('#xmb-fixture').getAttribute('data-level'),'details');await page.keyboard.press('Escape');
 for(let i=0;i<14;i++)await page.keyboard.press('ArrowDown');await page.waitForTimeout(250);
 const before=await page.evaluate(()=>({index:document.querySelector('#xmb-fixture .xmb-item[aria-pressed=true]').dataset.index,scroll:document.querySelector('#xmb-fixture .xmb-items').scrollTop,core:SPACEAMP,players:document.querySelectorAll('audio,iframe').length}));
 await page.waitForFunction(()=>document.querySelector('#xmb-fixture .xmb-item[aria-pressed=true] img')?.complete);
 await page.keyboard.press('Enter');await page.waitForSelector('#spaceampNowPlaying[open]');
 assert.deepEqual(await page.evaluate(()=>__plays),['track-15']);
 await page.waitForTimeout(40);assert.equal(await page.locator('.xmb-handoff-artwork').count(),1);
 await page.waitForTimeout(300);assert.equal(await page.locator('.xmb-handoff-artwork').count(),0);
 assert.equal(await page.evaluate(()=>document.querySelectorAll('audio,iframe').length),before.players);
 await pad(1);await page.waitForFunction(()=>!SpaceAmpNowPlaying.isOpen());await page.waitForTimeout(300);
 assert.equal(await selected().getAttribute('data-index'),before.index);assert.equal(await page.locator('#xmb-fixture .xmb-items').evaluate(n=>n.scrollTop),before.scroll);assert.equal(await page.evaluate(()=>SPACEAMP.getPlaybackState().playing),true);
 await page.evaluate(()=>{
  __clock.position=90;window.__artFrames=[];window.__sampleArtwork=true;
  const sample=()=>{if(!__sampleArtwork)return;const cover=document.querySelector('.np-cover');
   if(SpaceAmpNowPlaying.isOpen())__artFrames.push({src:cover.getAttribute('src'),hidden:cover.hidden,state:cover.dataset.artworkState,source:cover.dataset.artworkSource,key:cover.dataset.artworkKey,ghosts:document.querySelectorAll('.np-cover-previous').length,clones:document.querySelectorAll('.xmb-handoff-artwork').length,visible:getComputedStyle(cover).visibility,rect:{x:cover.getBoundingClientRect().x,y:cover.getBoundingClientRect().y,width:cover.getBoundingClientRect().width},cloneRect:document.querySelector('.xmb-handoff-artwork')?.getBoundingClientRect().toJSON()});
   requestAnimationFrame(sample);
  };sample();
 });
 await pad(0,550);assert.equal(await page.evaluate(()=>__plays.length),1);await page.waitForSelector('#spaceampNowPlaying[open]');
 const sameFrames=await page.evaluate(()=>{__sampleArtwork=false;return __artFrames;});
 assert.ok(sameFrames.length>10);assert.ok(sameFrames.every(f=>f.src==='profile-art.png'&&f.source==='profile-art.png'&&f.state==='ready'&&f.key===f.source&&!f.hidden&&(f.visible==='visible'||f.clones>0)&&f.ghosts===0),'same artwork remains ready with no internal fade');
 const finalClone=sameFrames.filter(f=>f.cloneRect).at(-1),revealed=sameFrames.find((f,i)=>i>0&&sameFrames[i-1].clones&&!f.clones);
 assert.ok(finalClone&&revealed);
 for(const axis of ['x','y','width'])assert.ok(Math.abs(finalClone.cloneRect[axis]-revealed.rect[axis])<.5,'clone and revealed artwork share final '+axis);
 assert.ok(sameFrames.every(f=>Math.abs(f.rect.x-revealed.rect.x)<.5&&Math.abs(f.rect.width-revealed.rect.width)<.5),'shell does not scale beneath shared artwork');
 assert.equal(await page.evaluate(()=>__clock.position),90);
 fs.mkdirSync('artifacts/xmb-handoff',{recursive:true});fs.writeFileSync('artifacts/xmb-handoff/same-track-frames.json',JSON.stringify(sameFrames,null,2));
 // Held confirm invokes once; directional controls navigate existing groups.
 await pad(13);assert.ok(await page.locator('.np-gamepad-focus').count());await pad(1);await page.waitForTimeout(300);
 await page.evaluate(()=>{document.querySelectorAll('#xmb-fixture .xmb-item')[0].click();});await page.waitForTimeout(250);
 await pad(12);assert.equal(await page.evaluate(()=>document.activeElement.className),'xmb-now-playing');const count=await page.evaluate(()=>__plays.length);
 await pad(0);await page.waitForSelector('#spaceampNowPlaying[open]');assert.equal(await page.evaluate(()=>__plays.length),count);assert.equal(await page.evaluate(()=>__clock.position),90);
 await pad(1);await page.waitForTimeout(250);await pad(13);assert.equal(await selected().getAttribute('data-index'),'0');
 // Different artwork: deliberately postpone decoding beyond the handoff duration.
 await page.evaluate(()=>{
  __rows[1].image='profile-art.png?handoff=new';
  const row=document.querySelectorAll('#xmb-fixture .xmb-item')[1];row.querySelector('img').src=__rows[1].image;row.click();
 });await page.waitForTimeout(300);
 await page.evaluate(()=>{
  window.__decode=HTMLImageElement.prototype.decode;
  HTMLImageElement.prototype.decode=async function(){await __decode.call(this);if(this.src.includes('handoff=new'))await new Promise(r=>setTimeout(r,650));};
  window.__differentFrames=[];window.__sampleDifferent=true;
  const sample=()=>{if(!__sampleDifferent)return;const cover=document.querySelector('.np-cover');
   if(SpaceAmpNowPlaying.isOpen())__differentFrames.push({src:cover.getAttribute('src'),state:cover.dataset.artworkState,source:cover.dataset.artworkSource,key:cover.dataset.artworkKey,hidden:cover.hidden,ghosts:document.querySelectorAll('.np-cover-previous').length,clones:document.querySelectorAll('.xmb-handoff-artwork').length,visible:getComputedStyle(cover).visibility,rect:{x:cover.getBoundingClientRect().x,y:cover.getBoundingClientRect().y,width:cover.getBoundingClientRect().width},cloneRect:document.querySelector('.xmb-handoff-artwork')?.getBoundingClientRect().toJSON()});
   requestAnimationFrame(sample);
  };sample();
 });
 await page.keyboard.press('Enter');await page.waitForSelector('#spaceampNowPlaying[open]');
 await page.waitForTimeout(350);assert.equal(await page.locator('.xmb-handoff-artwork').count(),1,'clone survives animation while destination decodes');
 await page.waitForFunction(()=>!document.querySelector('.xmb-handoff-artwork'));
 const differentFrames=await page.evaluate(()=>{__sampleDifferent=false;HTMLImageElement.prototype.decode=__decode;return __differentFrames;});
 assert.ok(differentFrames.every(f=>f.ghosts===0),'handoff and cover crossfade never compete');
 assert.ok(differentFrames.every(f=>f.clones>0||(f.src==='profile-art.png?handoff=new'&&f.state==='ready'&&f.key===f.source&&!f.hidden&&f.visible==='visible')),'no uncovered empty or wrong destination frame');
 fs.writeFileSync('artifacts/xmb-handoff/different-track-frames.json',JSON.stringify(differentFrames,null,2));
 await pad(1);await page.waitForTimeout(300);await page.evaluate(()=>document.querySelectorAll('#xmb-fixture .xmb-item')[0].click());await page.waitForTimeout(250);

 await page.evaluate(()=>{__pad.axes=[.3,.2];});await page.waitForTimeout(300);assert.equal(await selected().getAttribute('data-index'),'0');
 await page.evaluate(()=>{__pad.axes=[.6,.9];});await page.waitForTimeout(70);await page.evaluate(()=>{__pad.axes=[0,0];});assert.equal(await selected().getAttribute('data-index'),'1');
 await pad(13,510);const afterRepeat=Number(await selected().getAttribute('data-index'));assert.ok(afterRepeat>=3&&afterRepeat<=5);
 assert.ok((await page.locator('#xmb-fixture .xmb-help').textContent()).includes('D-pad'));await page.keyboard.press('ArrowDown');assert.ok((await page.locator('#xmb-fixture .xmb-help').textContent()).includes('Enter'));
 await pad(1);assert.equal(await page.locator('#xmb-fixture').isVisible(),false);
 // Other media keeps details and full-page behavior.
 await page.evaluate(()=>__xmb.enter());await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('#xmb-fixture .xmb-category[aria-pressed=true]').getAttribute('data-category'),'series');
 await page.evaluate(()=>document.querySelector('#xmb-fixture .xmb-category[data-category=game]').click());await page.keyboard.press('Enter');assert.equal(await page.locator('#xmb-fixture').getAttribute('data-level'),'details');await page.keyboard.press('Escape');await page.keyboard.press('o');assert.deepEqual(await page.evaluate(()=>__pages),['game-0']);
 fs.mkdirSync('artifacts/xmb-handoff',{recursive:true});
 for(const width of [390,820,1440]){
  await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>__xmb.enter());await page.evaluate(()=>document.querySelector('#xmb-fixture .xmb-category[data-category=music]').click());
  await page.screenshot({path:`artifacts/xmb-handoff/xmb-${width}.png`});
  await pad(0);await page.waitForSelector('#spaceampNowPlaying[open]');assert.equal(await page.locator('.xmb-handoff-artwork').count(),0);await page.waitForTimeout(300);
  const first=await page.locator('.np-artwork').boundingBox();await page.waitForTimeout(120);const second=await page.locator('.np-artwork').boundingBox();assert.ok(Math.abs(first.x-second.x)<.5&&Math.abs(first.y-second.y)<.5,'settled artwork geometry stays stable');
  await page.screenshot({path:`artifacts/xmb-handoff/now-playing-${width}.png`});await pad(1);await page.evaluate(()=>__xmb.close());
 }
 await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>__xmb.enter());await pad(0);await page.waitForSelector('#spaceampNowPlaying[open]');
 const stableId=await selected().getAttribute('data-item-id');await page.evaluate(()=>__rows.unshift({...__rows[0],id:'inserted-track',title:'Inserted track'}));await pad(1);await page.waitForTimeout(300);assert.equal(await selected().getAttribute('data-item-id'),stableId);await page.evaluate(()=>__xmb.close());
 await page.evaluate(()=>{__pad=null;__xmb.enter();});await page.keyboard.press('ArrowDown');await page.keyboard.press('Escape');
 assert.deepEqual(errors,[]);fs.mkdirSync('artifacts/xmb-handoff',{recursive:true});await page.screenshot({path:'artifacts/xmb-handoff/final.png'});
 console.log('PASS: one browser/context; keyboard/gamepad, edge/repeat/deadzone, preserved context, shared clone cleanup, entry without restart, playback singleton, reduced motion, 390/820/1440.');await context.close();
 }finally{await browser?.close();web.closeAllConnections();await new Promise(r=>web.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
