// Real YT search snapshots; restricted delivery; official component, delayed provider.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(require('os').homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const {createServer}=require('../server.cjs'),{createMusicArtwork}=require('../server/music-artwork.cjs');
const live=process.env.SPACEAMP_LIVE==='1',root='artifacts/spaceamp-regressions';fs.mkdirSync(root,{recursive:true});
const rows=JSON.parse(fs.readFileSync(live?root+'/live-artwork.json':'tests/fixtures/spaceamp-youtube-artwork.json'));
const requests=[],errors=[],report=[],deliveries=[];
const yt=live?require('../server/youtube-music.cjs').createYouTubeMusicClient():null;
const artwork=live?createMusicArtwork():createMusicArtwork({fetcher:async(url,options)=>{deliveries.push({url,redirect:options.redirect});return new Response(fs.readFileSync('tests/fixtures/spaceamp-palette.png'),{headers:{'content-type':'image/png'}});}});
const music={search:async(kind,query)=>live?yt.search(kind,query):({items:rows.map(r=>r.item)}),details:async(_kind,id)=>rows.find(r=>r.item.catalogId.endsWith(id))?.item||{},recommendations:async()=>({items:[]}),summary:async()=>({})};
const web=createServer({artwork,music});let browser;
(async()=>{try{
 await new Promise(r=>web.listen(0,'127.0.0.1',r));browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:900},...(process.env.SPACEAMP_RECORD?{recordVideo:{dir:root+'/video',size:{width:1440,height:900}}}:{})});
 await context.addInitScript(()=>{
  window.position=23.7;window.duration=200;window.textureCalls=0;window.decodeErrors=[];
  const bitmap=createImageBitmap;window.createImageBitmap=async(...args)=>{try{return await bitmap(...args);}catch(e){decodeErrors.push(e.name);throw e;}};
  window.YT={Player:class{constructor(frame,{events}){this.events=events;this.url=(typeof frame==='string'?document.getElementById(frame)?.src:frame.src||'')?.replace('/embed/','/watch?v=')||'';setTimeout(()=>events.onReady({target:this}),0);}getVideoUrl(){return this.url;}getPlayerState(){return this.state??-1;}getCurrentTime(){return position;}getDuration(){return duration;}playVideo(){this.state=1;this.events.onStateChange({target:this,data:1});}pauseVideo(){this.state=2;this.events.onStateChange({target:this,data:2});}seekTo(t){position=t;}setVolume(){}destroy(){}}};
 });
 await context.route('https://www.youtube.com/embed/**',r=>r.fulfill({body:'<html></html>',contentType:'text/html'}));
 await context.route('**/vendor/kawarp/dist/index.js',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync('dist/vendor/kawarp/dist/index.js','utf8')+'\nconst TestKawarpLoad=Kawarp.prototype.loadImageElement;Kawarp.prototype.loadImageElement=function(...args){textureCalls++;return TestKawarpLoad.apply(this,args);};'}));
 const ttml='<tt xmlns="http://www.w3.org/ns/ttml" xmlns:lrc="http://lrc.red/lyric-ttml-internal" lrc:timing="Line"><body dur="120.000"><div>'+Array.from({length:30},(_,i)=>`<p begin="${(i*4).toFixed(3)}" end="${(i*4+4).toFixed(3)}">Delayed presentation lyric ${i+1}</p>`).join('')+'</div></body></tt>';
 if(!live)await context.route('**/vendor/am-lyrics-1.7.4.js',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync('dist/vendor/am-lyrics-1.7.4.js','utf8')+`\nconst TestLyricsComponent=customElements.get('am-lyrics');TestLyricsComponent.fetchLyricsFromLrcRed=async()=>{await new Promise(r=>setTimeout(r,250));return {lines:TestLyricsComponent.parseTTML(${JSON.stringify(ttml)}).lines,source:'Delayed test provider'};};`}));
 await context.route(/^https:\/\/(lh3\.googleusercontent\.com|yt3\.googleusercontent\.com)\//,r=>r.abort());
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.stack));page.on('request',r=>{if(r.url().includes('/api/music/artwork'))requests.push(r.url());});
 await page.goto('http://127.0.0.1:'+web.address().port+'/?voiceTransport=local#buscar');await page.waitForSelector('#globalSpaceAmp',{state:'attached'});await page.evaluate(()=>import('./vendor/am-lyrics-1.7.4.js'));
 async function filters(){return page.evaluate(()=>{const c=document.querySelector('am-lyrics'),r=c.shadowRoot,n=r.querySelector('.lyrics-container');return {style:!!r.getElementById('spaceamp-lyrics-motion-profile'),classes:n.className,lines:[...r.querySelectorAll('.lyrics-line:not(.lyrics-footer):not(.lyrics-gap)')].map(l=>({classes:l.className,filter:getComputedStyle(l).filter,opacity:getComputedStyle(l).opacity})),user:c.isUserScrolling};});}
 for(const row of rows){
  await page.evaluate(()=>{location.hash='buscar';});await page.getByRole('combobox',{name:'Tipo de mídia',exact:true}).selectOption('music');await page.getByRole('searchbox',{name:'Buscar título',exact:true}).fill(row.query);await page.locator('#discoverPage').getByRole('button',{name:'buscar',exact:true}).click();
  await page.locator('#discoverPage .discover-card').filter({has:page.locator('strong').filter({hasText:row.item.title})}).first().click();await page.waitForFunction(title=>document.querySelector('#titlePage h1')?.textContent===title,row.item.title);
  await page.evaluate(d=>{duration=d;},row.item.trackDuration);await page.getByRole('button',{name:'tocar agora',exact:false}).click();await page.waitForFunction(title=>SPACEAMP.getState().title===title&&SPACEAMP.getState().playing,row.item.title);await page.evaluate(()=>SpaceAmpNowPlaying.open());
  await page.waitForFunction(()=>document.querySelector('#spaceampNowPlaying').dataset.atmosphere==='kawarp').catch(async e=>{console.log('DIAG',await page.evaluate(()=>({state:SPACEAMP.getState(),cover:document.querySelector('.np-cover')?.outerHTML,shell:document.querySelector('#spaceampNowPlaying')?.dataset,textureCalls,decodeErrors})),errors,deliveries);throw e;});
  await page.waitForFunction(()=>document.querySelector('am-lyrics')?.shadowRoot?.querySelector('.lyrics-line:not(.lyrics-footer):not(.lyrics-gap)'));
  if(live)await page.evaluate(()=>{const lines=document.querySelector('am-lyrics').lyrics;position=lines[Math.min(3,lines.length-1)].timestamp/1000+.3;SPACEAMP.progress({position});});await page.waitForTimeout(2000);
  const snapshot=await page.evaluate(async()=>{const s=SPACEAMP.getState(),shell=document.querySelector('#spaceampNowPlaying'),image=document.querySelector('.np-cover');await image.decode();const c=document.createElement('canvas');c.width=c.height=1;const ctx=c.getContext('2d');ctx.drawImage(image,0,0,1,1);const pixels=[...ctx.getImageData(0,0,1,1).data],b=await createImageBitmap(image),bitmap=[b.width,b.height];b.close();return {title:s.title,artwork:s.artwork,delivery:Artwork.url(s.artwork),queue:SPACEAMP.getState().queue,cover:image.src,palette:shell.dataset.palette,atmosphere:shell.dataset.atmosphere,pixels,bitmap,textureCalls,decodeErrors};});
  assert.equal(snapshot.artwork,row.item.image);assert.equal(snapshot.atmosphere,'kawarp');assert.ok(snapshot.textureCalls>report.length);assert.deepEqual(snapshot.decodeErrors,[]);
  if(!live){await page.evaluate(()=>SPACEAMP.pause());await page.waitForTimeout(300);await page.evaluate(()=>{const root=document.querySelector('am-lyrics').shadowRoot,line=root.querySelector('.next-active-line');line.classList.add('pre-active');line.style.setProperty('filter','blur(.02em)','important');});await page.waitForTimeout(1000);}
  const paint=await filters();assert.equal(paint.style,true);
  if(!live){await page.evaluate(()=>document.querySelector('am-lyrics').shadowRoot.getElementById('spaceamp-lyrics-motion-profile').remove());await page.waitForFunction(()=>document.querySelector('am-lyrics').shadowRoot.getElementById('spaceamp-lyrics-motion-profile'));}
  if(!live){const active=paint.lines.find(l=>l.classes.split(' ').includes('active')),pre=paint.lines.find(l=>l.classes.includes('pre-active')),far=paint.lines.find(l=>l.classes.includes('far-line')),near=paint.lines.find(l=>!l.classes.includes('active')&&!l.classes.includes('far-line'));
   assert.ok(active&&pre&&far&&near,'all paint roles rendered');assert.equal(active.filter,'none');assert.equal(pre.filter,'none');assert.equal(near.filter,'blur(1.2px)');assert.ok(Math.abs(parseFloat(far.filter.slice(5))-1.8)<.02);
  }
  await page.screenshot({path:root+'/'+(live?'live-':'test-')+report.length+'.png'});report.push({...snapshot,paint});
  await page.evaluate(()=>{window.previousLyrics=document.querySelector('am-lyrics');SpaceAmpNowPlaying.close();});
 }
 await page.evaluate(()=>SpaceAmpNowPlaying.open());await page.waitForFunction(()=>document.querySelector('am-lyrics')?.shadowRoot?.querySelector('.lyrics-line:not(.lyrics-footer)'));assert.equal(await page.evaluate(()=>previousLyrics===document.querySelector('am-lyrics')),false);
 if(!live){
  for(const row of rows.slice(0,2)){
   await page.evaluate(async item=>{window.previousLyrics=document.querySelector('am-lyrics');await SPACEAMP.play(MusicModel.queueTrack(item));},row.item);await page.waitForFunction(title=>SPACEAMP.getState().title===title&&SPACEAMP.getState().playing,row.item.title);
   await page.waitForFunction(()=>document.querySelector('am-lyrics')?.shadowRoot?.querySelector('.lyrics-line:not(.lyrics-footer)'));await page.waitForTimeout(1200);assert.equal(await page.evaluate(()=>previousLyrics===document.querySelector('am-lyrics')),false);assert.equal((await filters()).style,true);
  }
  await page.waitForTimeout(1000);const box=await page.locator('am-lyrics').locator('.lyrics-container').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.wheel(0,160);await page.waitForTimeout(1000);
  const scrolling=await filters();assert.equal(scrolling.user,true);assert.ok(scrolling.lines.every(l=>l.filter==='none'));await page.waitForTimeout(5800);const recovered=await filters();assert.equal(recovered.user,false);assert.ok(recovered.lines.some(l=>l.filter.includes('blur')));
  await page.locator('am-lyrics').locator('.lyrics-line:not(.lyrics-footer)').nth(8).click();await page.waitForTimeout(1000);assert.ok((await filters()).lines.some(l=>l.filter.includes('blur')));
  await page.evaluate(()=>{position=12.5;SPACEAMP.progress({position});});await page.waitForTimeout(1000);assert.equal((await filters()).user,false);
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelector('#spaceampNowPlaying').dataset.atmosphere==='static');await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForFunction(()=>document.querySelector('#spaceampNowPlaying').dataset.atmosphere==='kawarp').catch(async e=>{console.log('DIAG',await page.evaluate(()=>({state:SPACEAMP.getState(),cover:document.querySelector('.np-cover')?.outerHTML,shell:document.querySelector('#spaceampNowPlaying')?.dataset,textureCalls,decodeErrors})),errors,deliveries);throw e;});
 }
 const legacyChecks=[],apple=live&&fs.existsSync(root+'/legacy-artwork.json')?JSON.parse(fs.readFileSync(root+'/legacy-artwork.json')):{title:'Apple legacy fixture',artist:'',source:'áudio',sourceUrl:'legacy',artwork:'profile-art.png?apple'};
 for(const legacy of [apple,{title:'Local artwork',artist:'',source:'local',sourceUrl:'blob:local-test',artwork:'profile-art.png?local'}]){
  const before=await page.evaluate(()=>textureCalls);await page.evaluate(s=>SPACEAMP.update(s,true,{available:true}),legacy);await page.waitForFunction(count=>textureCalls>count&&document.querySelector('#spaceampNowPlaying').dataset.atmosphere==='kawarp',before);await page.waitForFunction(()=>document.querySelector('.np-cover').dataset.artworkState==='ready');legacyChecks.push({title:legacy.title,artwork:legacy.artwork,atmosphere:await page.locator('#spaceampNowPlaying').getAttribute('data-atmosphere')});
 }
 assert.deepEqual(errors,[]);const video=page.video();await context.close();if(video)fs.copyFileSync(await video.path(),root+'/'+(live?'live':'regression')+'.webm');fs.writeFileSync(root+'/'+(live?'live':'regression')+'-report.json',JSON.stringify({report,requests,deliveries,legacyChecks,errors},null,2));console.log(JSON.stringify({checks:report.map(r=>({title:r.title,host:new URL(r.artwork).hostname,atmosphere:r.atmosphere,palette:r.palette,profile:r.paint.style})),legacyChecks,errors}));
}finally{await browser?.close();web.closeAllConnections();await new Promise(r=>web.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});











