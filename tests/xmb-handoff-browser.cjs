// One browser/context for input, continuity, reduced motion and viewport checks.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(require('node:os').homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
assert.doesNotMatch(fs.readFileSync(path.join(__dirname,'../dist/xmb-quick-menu.css'),'utf8'),/box-shadow:\s*8px\s+12px\s+0/);
const {createServer}=require('../server.cjs');const web=createServer({music:{search:async()=>({items:[]}),details:async()=>({}),summary:async()=>({}),recommendations:async()=>({items:[]})}});let browser;
(async()=>{try{
 await new Promise(r=>web.listen(0,'127.0.0.1',r));browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 await context.addInitScript(()=>{
  window.__sampled=[];window.addEventListener("xmb:action",event=>__sampled.push(event.detail),true);
  window.__pad=null;Object.defineProperty(navigator,'getGamepads',{value:()=>[__pad]});
  document.addEventListener('DOMContentLoaded',()=>{document.documentElement.requestFullscreen=()=>Promise.reject(Error('fixture viewport'));},{once:true});
 });
 await context.route('https://**/*',r=>r.abort());
 await context.route('**/vendor/am-lyrics-1.7.4.js',r=>r.fulfill({contentType:'text/javascript',body: `
 customElements.define('am-lyrics',class extends HTMLElement {
  constructor(){super();this.attachShadow({mode:'open'});this.render('synced');}
  render(mode){
   this.shadowRoot.innerHTML='<style>.lyrics-container{height:240px;overflow:auto}.lyrics-line{height:80px}</style><div class="lyrics-container"></div>';
   const container=this.shadowRoot.querySelector('.lyrics-container');
   if(['loading','empty','error'].includes(mode))return;
   for(const label of ['Romanization','Translation']){
    const button=document.createElement('button');button.setAttribute('aria-label','Toggle '+label);button.setAttribute('aria-pressed','false');button.textContent=label;
    button.onclick=()=>button.setAttribute('aria-pressed',String(button.getAttribute('aria-pressed')!=='true'));this.shadowRoot.append(button);
   }
   for(let i=0;i<12;i++){
    const line=document.createElement('div');line.className='lyrics-line';line.textContent='Line '+i;
    line.tabIndex=mode==='synced'?0:-1;line.setAttribute('role',mode==='synced'?'button':'paragraph');
    if(i===1){line.setAttribute('aria-current','true');line.classList.add('active');}
    line.dataset.startTime=String((i+1)*20000);
    const activate=()=>{if(mode==='synced')this.dispatchEvent(new CustomEvent('line-click',{detail:{timestamp:(i+1)*20000}}));};
    line.onclick=activate;line.onkeydown=e=>{if(e.key==='Enter'||e.key===' ')activate();};container.append(line);
   }
  }
 });`}));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+web.address().port+'/?voiceTransport=local#perfil');await page.waitForSelector('#globalSpaceAmp');
 await page.evaluate(()=>{
  const el=(tag,cls,text='')=>{const n=document.createElement(tag);n.className=cls;n.textContent=text;return n;};
  const button=(text,action,cls)=>{const n=el('button',cls,text);n.onclick=action;return n;};
  window.__rows=Array.from({length:35},(_,i)=>({id:'track-'+i,kind:'music',title:'Track '+i,artist:'Fixture Artist',status:'completed',image:'profile-art.png',playbackSource:{type:'local',fileRef:'fixture-'+i}}));
  __rows.push({id:'game-0',kind:'game',title:'Game',status:'completed'});
  window.__plays=[];window.__pages=[];window.__seeks=[];window.__skips=[];window.__clock={position:42,duration:180};
  SPACEAMP.configure({select:t=>{__plays.push(t.collectionId);SPACEAMP.update({title:t.title,artist:t.artist,artwork:t.album,source:'local',sourceUrl:t.fileRef},true,{available:true});},getPlaybackTime:()=>__clock,play:()=>SPACEAMP.update(SPACEAMP.getPlaybackState(),true),pause:()=>SPACEAMP.update(SPACEAMP.getPlaybackState(),false),seek:t=>{__seeks.push(t);__clock.position=t;},setVolume:value=>SPACEAMP.progress({volume:value})});
  SPACEAMP.setNavigation(Object.fromEntries(["previous","next"].map(action=>[action,()=>{__skips.push(action);if(window.__skipChanges)SPACEAMP.update({...SPACEAMP.getPlaybackState(),title:"Shoulder "+__skips.length,sourceUrl:"shoulder-"+__skips.length},true);}])));
  window.__xmb=createXmb({getData:()=>({items:__rows,photos:[]}),getProfile:()=>({name:'Fixture'}),getFilters:()=>({kind:'music'}),openItem:item=>__pages.push(item.id),navigate:()=>{},openPhoto:()=>{},el,button,imageNode:(src,alt)=>{const n=document.createElement('img');n.src=src;n.alt=alt;return n;}});
  // The Collection entry and fixture share one XMB owner, as in production.
  window.createXmb=()=>window.__xmb;

 });
 async function pad(button,hold=70){
  const pressedAt=Date.now();
  const sampled=await page.evaluate(i=>{__pad||={index:0,mapping:'standard',buttons:Array.from({length:16},()=>({pressed:false,value:0})),axes:[0,0]};const count=__sampled.length;__pad.buttons[i].pressed=true;return count;},button);
  await page.waitForFunction(count=>__sampled.length>count,sampled,{polling:"raf"});
  await page.waitForTimeout(Math.max(0,hold-(Date.now()-pressedAt)));
  await page.evaluate(i=>{__pad.buttons[i].pressed=false;return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));},button);
 }
 const selected=()=>page.locator('#xmb-fixture .xmb-item[aria-pressed=true]');
 await pad(9);await page.waitForSelector('.xmb:not([hidden])');await pad(1);
 await page.evaluate(()=>{__xmb.enter();[...document.querySelectorAll('.xmb')].at(-1).id='xmb-fixture';});
 await pad(9);assert.equal(await page.evaluate(()=>XmbQuickMenu.isOpen()),true);
 assert.equal(await page.locator('#xmbQuickMenu .xqm-system').isVisible(),true);
 await page.locator('#xmbQuickMenu [data-command=fullscreen]').click();await page.waitForTimeout(30);assert.equal(await page.evaluate(()=>__xmb.isActive()),true);assert.match(await page.locator('#xmbQuickMenu [role=status]').textContent(),/indisponível/);
 await pad(1);
 await pad(4);assert.equal(await page.evaluate(()=>__skips.length),0);
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
 // Main controller mesh excludes the mouse/keyboard quick bar.
 await page.waitForFunction(()=>document.querySelector('am-lyrics')?.shadowRoot?.querySelector('.lyrics-line'));
 const action=async name=>page.evaluate(action=>window.dispatchEvent(new CustomEvent('xmb:action',{detail:action})),name);
 const lyricIndex=()=>page.evaluate(()=>{const root=document.querySelector('am-lyrics').shadowRoot;return [...root.querySelectorAll('.lyrics-line')].indexOf(root.activeElement);});
 const markerIndex=()=>page.evaluate(()=>{const root=document.querySelector('am-lyrics').shadowRoot;return [...root.querySelectorAll('.lyrics-line')].indexOf(root.querySelector('.spaceamp-controller-selected'));});
 const clockBefore=await page.evaluate(()=>{window.__originalPlayback={...SPACEAMP.getPlaybackState()};return __clock.position;});
 const focusedLabel=()=>page.evaluate(()=>document.activeElement.getAttribute('aria-label')||document.activeElement.textContent);
 const playerNode=()=>page.evaluate(()=>document.activeElement.matches('.np-progress')?'progress':document.activeElement.matches('#spaceampNowPlaying input[aria-label="Volume"]')?'volume':document.activeElement.textContent);
 await action('up');await action('up');assert.equal(await focusedLabel(),'Pausar');
 assert.equal(await page.evaluate(()=>document.activeElement.closest('.np-quick')),null);
 await action('left');await action('left');assert.equal(await focusedLabel(),'Anterior');
 await action('right');assert.equal(await focusedLabel(),'Pausar');await action('right');assert.equal(await focusedLabel(),'Próxima');
 await action('right');assert.equal(await markerIndex(),1);await action('left');assert.equal(await focusedLabel(),'Próxima');assert.equal(await markerIndex(),-1);
 // Face shortcuts preserve player/lyrics origin and consume one layer.
 await pad(3,500);assert.equal(await page.evaluate(()=>SPACEAMP.getPlaybackState().playing),false);assert.equal(await focusedLabel(),'Próxima');
 await pad(3,500);assert.equal(await page.evaluate(()=>SPACEAMP.getPlaybackState().playing),true);
 await pad(2,500);assert.equal(await playerNode(),'volume');const shortcutVolume=await page.evaluate(()=>SPACEAMP.getPlaybackState().volume);
 await action('left');assert.ok(await page.evaluate(()=>SPACEAMP.getPlaybackState().volume)<shortcutVolume);
 await action('back');assert.equal(await focusedLabel(),'Próxima');assert.equal(await page.evaluate(()=>SpaceAmpNowPlaying.isOpen()),true);
 await action('right');await action('down');const shortcutLine=await markerIndex();await action('tertiary');await page.waitForTimeout(30);assert.equal(await markerIndex(),shortcutLine);await action('tertiary');await page.waitForTimeout(30);assert.equal(await markerIndex(),shortcutLine);const shortcutSeek=await page.evaluate(()=>__seeks.length);
 await action('secondary');assert.equal(await markerIndex(),-1);await action('right');await action('primary');assert.equal(await markerIndex(),shortcutLine);assert.equal(await page.evaluate(()=>__seeks.length),shortcutSeek);
 await action('secondary');await page.evaluate(()=>{window.__shortcutOld=document.querySelector('am-lyrics');SPACEAMP.update({...SPACEAMP.getPlaybackState(),title:'Shortcut replacement'},true);});
 await page.waitForFunction(()=>document.querySelector('am-lyrics')!==__shortcutOld);await action('secondary');assert.equal(await markerIndex(),1);assert.equal(await page.evaluate(()=>__shortcutOld.shadowRoot.querySelector('.spaceamp-controller-selected')),null);
 await action('back');assert.equal(await focusedLabel(),'Próxima');
 // Options/B consumes exactly one layer and restores the original control.
 await action('menu');
 await action('up');await action('up');assert.equal(await page.evaluate(()=>document.activeElement.dataset.command),'previous');
 await action('down');assert.equal(await page.evaluate(()=>document.activeElement.dataset.command),'play');assert.equal(await page.evaluate(()=>XmbQuickMenu.isOpen()),true);
 assert.equal(await page.locator('#xmbQuickMenu [data-command="now-playing"]').isVisible(),false);
 await action('back');assert.equal(await focusedLabel(),'Próxima');assert.equal(await page.evaluate(()=>SpaceAmpNowPlaying.isOpen()),true);
 await pad(4,500);await pad(5,500);assert.deepEqual(await page.evaluate(()=>__skips),['previous','next']);assert.equal(await focusedLabel(),'Próxima');
 await action('down');await action('left');assert.equal(await playerNode(),'progress');
 await action('right');assert.equal(await playerNode(),'volume');assert.equal(await page.evaluate(()=>__clock.position),clockBefore);
 await page.evaluate(()=>SPACEAMP.progress({volume:0.4}));await action('primary');await action('right');
 assert.ok(Number(await page.locator('#spaceampNowPlaying input[aria-label="Volume"]').inputValue())>0.4);
 assert.equal(await playerNode(),'volume');assert.equal(await markerIndex(),-1);await action('primary');
 for(const state of ['hidden','disabled','inert']){
  await action('right');assert.equal(await markerIndex(),1);
  await page.evaluate(state=>{const node=document.querySelector('#spaceampNowPlaying input[aria-label="Volume"]');if(state==='inert')node.parentElement.inert=true;else node[state]=true;},state);
  await action('left');assert.equal(await playerNode(),'progress');assert.equal(await markerIndex(),-1);
  await page.evaluate(state=>{const node=document.querySelector('#spaceampNowPlaying input[aria-label="Volume"]');if(state==='inert')node.parentElement.inert=false;else node[state]=false;},state);
  await action('right');assert.equal(await playerNode(),'volume');
 }
 // Commands use current owners, including the existing preference persistence.
 await action('menu');
 const qmRow=id=>page.locator('#xmbQuickMenu [data-command="'+id+'"]');
 const qmClick=async id=>{await qmRow(id).click();await page.waitForTimeout(30);};
 // Rail topology and music face actions work across sections.
 await action('left');assert.equal(await page.evaluate(()=>document.activeElement.dataset.section),'music');
 await action('down');assert.equal(await page.evaluate(()=>document.activeElement.dataset.section),'system');await action('primary');
 assert.equal(await page.locator('#xmbQuickMenu .xqm-system').isVisible(),true);
 await action('secondary');assert.equal(await page.evaluate(()=>document.activeElement.dataset.command),'volume');
 const quickPlaying=await page.evaluate(()=>SPACEAMP.getPlaybackState().playing);await action('tertiary');await page.waitForTimeout(30);
 assert.equal(await page.evaluate(()=>SPACEAMP.getPlaybackState().playing),!quickPlaying);assert.equal(await page.evaluate(()=>document.activeElement.dataset.command),'volume');
 await action('tertiary');await page.waitForTimeout(30);
 for(const id of ['romanization','translation']){
  await qmRow(id).focus();await action('primary');await page.waitForTimeout(30);assert.match(await qmRow(id).textContent(),/ON/);
  await action('left');await page.waitForTimeout(30);assert.match(await qmRow(id).textContent(),/OFF/);
 }
 await qmClick('play');assert.equal(await page.evaluate(()=>SPACEAMP.getPlaybackState().playing),false);
 await qmClick('play');assert.equal(await page.evaluate(()=>SPACEAMP.getPlaybackState().playing),true);
 await qmRow('volume').focus();const realVolume=await page.evaluate(()=>SPACEAMP.getPlaybackState().volume);await action('right');
 assert.ok(await page.evaluate(()=>SPACEAMP.getPlaybackState().volume)>realVolume);assert.match(await qmRow('volume').textContent(),/%/);
 await qmClick('lyricsEnabled');assert.equal(await page.locator('#spaceampNowPlaying').evaluate(n=>n.classList.contains('np-no-lyrics')),true);
 await qmClick('lyricsEnabled');
 for(const [id,attribute,value] of [['visualizerMode','visualizerMode','audio'],['backgroundMode','backgroundMode','static'],['uiMode','uiMode','visible']]){
  await qmRow(id).focus();await action('right');
  assert.equal(await page.locator('#spaceampNowPlaying').evaluate((node,key)=>node.dataset[key],attribute),value);
  assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem('spaceamp-now-playing-preferences-v1'))[key],id),value);
  await action('left');
 }
 await qmClick('previous');await qmClick('next');assert.deepEqual(await page.evaluate(()=>__skips.slice(-2)),['previous','next']);
 // Video keeps its iframe; the system dialog is promoted above both popovers.
 await page.evaluate(()=>{window.__controllerFrame=document.createElement('iframe');__controllerFrame.src='about:blank';document.querySelector('#music .music-embed').append(__controllerFrame);SPACEAMP.update({...SPACEAMP.getPlaybackState(),source:'YouTube'},true);});
 await qmClick('video');
 assert.equal(await page.evaluate(()=>document.querySelector('.np-quick').matches(':popover-open')),true);
 assert.equal(await page.evaluate(()=>document.querySelector('#xmbQuickMenu').matches(':modal')),true);
 assert.equal(await qmRow('video').evaluate(node=>{const r=node.getBoundingClientRect();return !!document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('#xmbQuickMenu');}),true);
 assert.equal(await page.evaluate(()=>__controllerFrame.isConnected && document.querySelectorAll('audio,iframe').length),before.players+1);
 await action('tertiary');await page.waitForTimeout(30);await action('tertiary');await page.waitForTimeout(30);await pad(4);await pad(5);await action('secondary');assert.equal(await page.evaluate(()=>document.activeElement.dataset.command),'volume');
 fs.mkdirSync('artifacts/xmb-quick-menu',{recursive:true});await page.screenshot({path:'artifacts/xmb-quick-menu/video.png'});
 await action('back');assert.equal(await page.evaluate(()=>SpaceAmpNowPlaying.isOpen()),true);
 await action('secondary');assert.equal(await playerNode(),'volume');await action('right');await action('back');assert.equal(await page.evaluate(()=>SpaceAmpNowPlaying.isOpen()),true);
 await action('menu');await qmClick('video');await action('menu');
 assert.equal(await page.evaluate(()=>__controllerFrame.isConnected),true);
 await page.evaluate(()=>{__controllerFrame.remove();SPACEAMP.update(__originalPlayback,true);});
 // The quick bar remains usable by mouse; disabled lyrics does not break mesh.
 await page.locator('#spaceampNowPlaying [aria-label="Lyrics"]').click();
 await action('up');await action('left');await action('left');await action('right');await action('right');await action('right');assert.equal(await focusedLabel(),'Próxima');
 await action('down');await action('left');await action('right');await action('right');assert.equal(await playerNode(),'volume');
 await page.locator('#spaceampNowPlaying [aria-label="Lyrics"]').click();
 await action('down');await action('right');await action('left');
 const playerFocus=await page.evaluate(()=>document.activeElement.className);
 await action('right');assert.equal(await lyricIndex(),1);
 await action('down');await action('down');await action('up');assert.equal(await lyricIndex(),2);
 assert.equal(await page.evaluate(()=>__clock.position),clockBefore);
 const seeksBefore=await page.evaluate(()=>__seeks.length);
 await action('primary');assert.equal(await page.evaluate(()=>__clock.position),60);
 assert.equal(await page.evaluate(()=>__seeks.length),seeksBefore+1);
 await action('back');assert.equal(await page.evaluate(()=>SpaceAmpNowPlaying.isOpen()),true);
 assert.equal(await page.evaluate(()=>document.activeElement.className),playerFocus);
 await action('right');await action('down');assert.equal(await markerIndex(),2);
 await pad(4,500);await pad(5,500);assert.equal(await markerIndex(),2);
 await action('menu');const menuRowBefore=await page.evaluate(()=>document.activeElement.dataset.command);
 await pad(4,500);assert.equal(await page.evaluate(()=>XmbQuickMenu.isOpen()),true);assert.equal(await page.evaluate(()=>document.activeElement.dataset.command),menuRowBefore);
 await qmRow('play').focus();await action('left');await action('down');await action('primary');assert.equal(await page.evaluate(()=>document.activeElement.dataset.command),'fullscreen');
 await page.evaluate(()=>{window.__menuLifecycle={close:0,open:0};const menu=document.querySelector('#xmbQuickMenu');for(const method of ['close','showModal']){const original=menu[method].bind(menu);menu[method]=(...args)=>{__menuLifecycle[method==='close'?'close':'open']++;return original(...args);};}window.__skipChanges=true;});await pad(5,500);await page.evaluate(()=>{window.__skipChanges=false;});
 await page.evaluate(()=>{__skipChanges=true;});for(let i=0;i<3;i++)await pad(5);await page.evaluate(()=>{__skipChanges=false;});
 assert.match(await page.locator('#xmbQuickMenu h3').textContent(),/Shoulder/);
 assert.deepEqual(await page.evaluate(()=>__menuLifecycle),{close:0,open:0});assert.equal(await page.evaluate(()=>document.activeElement.dataset.command),'fullscreen');assert.equal(await page.locator('#xmbQuickMenu .xqm-system').isVisible(),true);
 await action('back');assert.equal(await page.evaluate(()=>SpaceAmpNowPlaying.isOpen()),true);assert.equal(await markerIndex(),1);
 await action('menu');await action('menu');assert.equal(await markerIndex(),1);
 await action('back');assert.equal(await markerIndex(),-1);assert.equal(await playerNode(),'volume');
 await action('right');await action('menu');await qmClick('lyricsEnabled');await action('back');
 assert.equal(await markerIndex(),-1);assert.equal(await playerNode(),'volume');
 await page.locator('#spaceampNowPlaying [aria-label="Lyrics"]').click();

 await action('right');
 await page.evaluate(()=>{window.__oldLyrics=document.querySelector('am-lyrics');SPACEAMP.update({...SPACEAMP.getPlaybackState(),title:'Replacement lyrics'},true);});
 await page.waitForFunction(()=>document.querySelector('am-lyrics')!==__oldLyrics && document.querySelector('am-lyrics').shadowRoot?.activeElement);
 assert.equal(await page.evaluate(()=>__oldLyrics.isConnected),false);assert.equal(await page.evaluate(()=>__oldLyrics.shadowRoot.querySelector('.spaceamp-controller-selected')),null);assert.equal(await markerIndex(),1);assert.equal(await lyricIndex(),1);
 await action('down');assert.equal(await lyricIndex(),2);
 await action('left');assert.equal(await page.evaluate(()=>document.activeElement.className),playerFocus);
 for(const mode of ['loading','empty','error']){
  await page.evaluate(mode=>document.querySelector('am-lyrics').render(mode),mode);
  await action('right');assert.equal(await lyricIndex(),-1);
  await action('menu');assert.equal(await qmRow('romanization').isVisible(),false);assert.equal(await qmRow('translation').isVisible(),false);await action('back');
 }
 await page.evaluate(()=>document.querySelector('am-lyrics').render('unsynced'));
 await action('right');const unsyncedBefore=await page.evaluate(()=>__clock.position);
 await action('down');await action('primary');
 assert.ok(await page.evaluate(()=>document.querySelector('am-lyrics').shadowRoot.querySelector('.lyrics-container').scrollTop)>0);
 assert.equal(await page.evaluate(()=>__clock.position),unsyncedBefore);
 await action('back');assert.equal(await page.evaluate(()=>SpaceAmpNowPlaying.isOpen()),true);
 // Mouse and native keyboard line activation remain intact.
 await page.evaluate(()=>document.querySelector('am-lyrics').render('synced'));
 await page.locator('am-lyrics button[aria-label="Toggle Romanization"]').click();
 await page.locator('am-lyrics button[aria-label="Toggle Translation"]').focus();await page.keyboard.press('Enter');
 await action('menu');assert.match(await qmRow('romanization').textContent(),/ON/);assert.match(await qmRow('translation').textContent(),/ON/);await action('back');
 await page.locator('am-lyrics .lyrics-line').nth(0).click();assert.equal(await page.evaluate(()=>__clock.position),20);
 await page.locator('am-lyrics .lyrics-line').nth(1).focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>__clock.position),40);

 await pad(1);await page.waitForFunction(()=>!SpaceAmpNowPlaying.isOpen());await page.waitForTimeout(300);
 assert.equal(await selected().getAttribute('data-index'),before.index);assert.equal(await page.locator('#xmb-fixture .xmb-items').evaluate(n=>n.scrollTop),before.scroll);assert.equal(await page.evaluate(()=>SPACEAMP.getPlaybackState().playing),true);
 await page.evaluate(()=>{window.__menuNode=document.activeElement;SPACEAMP.update({...SPACEAMP.getPlaybackState(),title:'Automatic next track'},true);window.dispatchEvent(new Event('spaceamp:trackchange'));});
 await page.waitForTimeout(100);
 assert.equal(await page.evaluate(()=>SpaceAmpNowPlaying.isOpen()),false);assert.equal(await page.evaluate(()=>XmbQuickMenu.isOpen()),false);
 assert.equal(await page.evaluate(()=>SPACEAMP.getPlaybackState().playing),true);
 assert.equal(await page.evaluate(()=>document.activeElement===__menuNode),true);
 await page.evaluate(()=>SPACEAMP.update(__originalPlayback,true));
 assert.equal(await selected().getAttribute('data-index'),before.index);
 assert.equal(await page.locator('#xmb-fixture .xmb-items').evaluate(n=>n.scrollTop),before.scroll);

 // Options opens over XMB without route/category/selection/scroll changes.
 await page.evaluate(()=>{window.__quickXmbOrigin=document.activeElement;});
 const menuContext=await page.evaluate(()=>({category:document.querySelector('#xmb-fixture .xmb-category[aria-pressed=true]').dataset.category,hash:location.hash,scroll:document.querySelector('#xmb-fixture .xmb-items').scrollTop,index:document.querySelector('#xmb-fixture .xmb-item[aria-pressed=true]').dataset.index}));
 await pad(9);assert.equal(await page.evaluate(()=>XmbQuickMenu.isOpen()),true);assert.equal(await page.evaluate(()=>SpaceAmpNowPlaying.isOpen()),false);
 assert.equal(await page.evaluate(()=>document.body.classList.contains('xmb-active')),true);
 assert.deepEqual(await page.evaluate(()=>({category:document.querySelector('#xmb-fixture .xmb-category[aria-pressed=true]').dataset.category,hash:location.hash,scroll:document.querySelector('#xmb-fixture .xmb-items').scrollTop,index:document.querySelector('#xmb-fixture .xmb-item[aria-pressed=true]').dataset.index})),menuContext);
 await page.locator('#xmbQuickMenu').evaluate(node=>Promise.all(node.getAnimations().map(animation=>animation.finished.catch(()=>{}))));
 const menuBox=await page.locator('#xmbQuickMenu').boundingBox();assert.equal(menuBox.x,0);assert.equal(menuBox.y,0);assert.equal(menuBox.height,900);
 await page.screenshot({path:'artifacts/xmb-quick-menu/xmb.png'});
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('#xmbQuickMenu').evaluate(node=>getComputedStyle(node).animationName),'none');
 await page.emulateMedia({reducedMotion:'no-preference'});await pad(1);
 assert.equal(await page.evaluate(()=>document.activeElement===__quickXmbOrigin),true,JSON.stringify(await page.evaluate(()=>({active:document.activeElement.className,origin:__quickXmbOrigin.className,connected:__quickXmbOrigin.isConnected,inert:__quickXmbOrigin.closest('[inert]')?.className}))));
 await pad(9);assert.equal(await page.locator('#xmbQuickMenu').count(),1);await pad(9);assert.equal(await page.evaluate(()=>XmbQuickMenu.isOpen()),false);
 await pad(9);await page.locator('#xmbQuickMenu [data-command="now-playing"]').click();await page.waitForSelector('#spaceampNowPlaying[open]');
 assert.equal(await page.evaluate(()=>XmbQuickMenu.isOpen()),false);assert.equal(await page.evaluate(()=>__plays.length),1);assert.equal(await page.evaluate(()=>__clock.position),40);
 await pad(1);await page.waitForTimeout(300);assert.equal(await selected().getAttribute('data-index'),menuContext.index);assert.equal(await page.locator('#xmb-fixture .xmb-items').evaluate(n=>n.scrollTop),menuContext.scroll);
 await page.evaluate(()=>{SPACEAMP.update(__originalPlayback,true);});
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
 await page.evaluate(()=>document.querySelector('#xmb-fixture .xmb-category[data-category=game]').click());await page.keyboard.press('Enter');assert.equal(await page.locator('#xmb-fixture').getAttribute('data-level'),'details');await page.keyboard.press('Escape');await pad(3,500);assert.deepEqual(await page.evaluate(()=>__pages),['game-0']);
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
 // System commands use the XMB owner's existing fullscreen and close paths.
 await action('menu');await qmRow('play').focus();await action('left');await action('down');await action('primary');
 await page.evaluate(()=>{
  window.__full=null;window.__fullCalls=[];
  Object.defineProperty(document,'fullscreenElement',{configurable:true,get:()=>__full});
  document.documentElement.requestFullscreen=async()=>{__fullCalls.push('enter');__full=document.documentElement;document.dispatchEvent(new Event('fullscreenchange'));};
  document.exitFullscreen=async()=>{__fullCalls.push('exit');__full=null;document.dispatchEvent(new Event('fullscreenchange'));};
 });
 await qmClick('fullscreen');assert.match(await qmRow('fullscreen').textContent(),/ON/);
 await qmClick('fullscreen');assert.match(await qmRow('fullscreen').textContent(),/OFF/);assert.equal(await page.evaluate(()=>__xmb.isActive()),true);
 assert.deepEqual(await page.evaluate(()=>__fullCalls),['enter','exit']);
 await qmClick('fullscreen');await page.evaluate(()=>document.exitFullscreen());assert.equal(await page.evaluate(()=>XmbQuickMenu.isOpen()),false);assert.equal(await page.evaluate(()=>__xmb.isActive()),true);
 await action('menu');await qmRow('play').focus();await action('left');await action('down');await action('primary');
 await page.evaluate(()=>{window.__exitOrder=[];const menu=document.querySelector('#xmbQuickMenu');const original=menu.close.bind(menu);menu.close=()=>{__exitOrder.push('menu');original();};const root=document.querySelector('#xmb-fixture');new MutationObserver(()=>{if(root.hidden)__exitOrder.push('xmb');}).observe(root,{attributes:true,attributeFilter:['hidden']});});
 await qmClick('exit-xmb');assert.equal(await page.evaluate(()=>__xmb.isActive()),false);assert.equal(await page.evaluate(()=>XmbQuickMenu.isOpen()),false);assert.deepEqual(await page.evaluate(()=>__exitOrder),['menu','xmb']);
 assert.deepEqual(errors,[]);fs.mkdirSync('artifacts/xmb-handoff',{recursive:true});await page.screenshot({path:'artifacts/xmb-handoff/final.png'});
 console.log('PASS: one browser/context; keyboard/gamepad, edge/repeat/deadzone, preserved context, shared clone cleanup, entry without restart, playback singleton, reduced motion, 390/820/1440.');await context.close();
 }finally{await browser?.close();web.closeAllConnections();await new Promise(r=>web.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
