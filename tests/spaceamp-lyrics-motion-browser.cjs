// Official component, deterministic TTML and provider clock; one browser/context.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(require('node:os').homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const {createServer}=require('../server.cjs');const web=createServer({music:{search:async()=>({items:[]}),details:async()=>({}),summary:async()=>({}),recommendations:async()=>({items:[]})}});let browser;
(async()=>{try{
 fs.mkdirSync('artifacts/spaceamp-lyrics-motion',{recursive:true});
 const modulePath='dist/vendor/am-lyrics-1.7.4.js';
 const official=fs.existsSync(modulePath)?fs.readFileSync(modulePath,'utf8'):await (await fetch('https://cdn.jsdelivr.net/npm/@uimaxbai/am-lyrics@1.7.4/dist/src/am-lyrics.min.js')).text();
 const ttml=fs.existsSync('artifacts/golden-hour.ttml')?fs.readFileSync('artifacts/golden-hour.ttml','utf8'):'<tt xmlns="http://www.w3.org/ns/ttml"><body><div>'+Array.from({length:30},(_,i)=>`<p begin="${i}s" end="${i+1}s">Deterministic baseline line ${i+1}</p>`).join('')+'</div></body></tt>';
 await new Promise(r=>web.listen(0,'127.0.0.1',r));browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const context=await browser.newContext({viewport:{width:1600,height:900}});
 await context.route('**/*',r=>r.request().url().includes('/vendor/am-lyrics-1.7.4.js')?r.fulfill({contentType:'text/javascript',body:`for(const n of document.querySelectorAll('am-lyrics'))n.setAttribute('ttml',${JSON.stringify(ttml)});\n`+official+"\nwindow.__lyricsLoads=0;const Component=customElements.get('am-lyrics'),fetchLyrics=Component.prototype.fetchLyrics;Component.prototype.fetchLyrics=function(...args){__lyricsLoads++;return fetchLyrics.apply(this,args);};"}):r.request().url().startsWith("https://")?r.abort():r.continue());
 const mode='B';
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const variant of ['B']){

  await page.goto('http://127.0.0.1:'+web.address().port+'/?voiceTransport=local');await page.waitForSelector('#globalSpaceAmp');
  await page.evaluate(()=>{window.__position=20;SPACEAMP.configure({getPlaybackTime:()=>({position:__position,duration:184.135}),pause:()=>SPACEAMP.update(SPACEAMP.getPlaybackState(),false),play:()=>SPACEAMP.update(SPACEAMP.getPlaybackState(),true),seek:t=>{__position=t;SPACEAMP.progress({position:t});}});SPACEAMP.update({title:'Prime Time Golden Hour Show (Soundtrack)',artist:'Shiori Sasaki, ATLUS Sound Team & ATLUS GAME MUSIC',source:'YouTube',sourceUrl:'fixture',artwork:'profile-art.png'},true,{available:true});SpaceAmpNowPlaying.open();});
  await page.waitForFunction(()=>document.querySelector('am-lyrics')?.shadowRoot?.querySelector('.lyrics-line'));
  if(mode==='B'){
   const component=page.locator('am-lyrics');assert.equal(await component.getAttribute('line-motion'),'uniform');assert.equal(await component.getAttribute('no-blur'),null);assert.equal(await component.getAttribute('autoscroll'),'');assert.equal(await component.getAttribute('interpolate'),'');
   assert.ok(await page.evaluate(()=>document.querySelector('am-lyrics').duration>0));
  }
  const scrollStart=await page.evaluate(()=>document.querySelector('am-lyrics').shadowRoot.querySelector('.lyrics-container').scrollTop);
  await page.waitForFunction(()=>document.querySelector('am-lyrics').shadowRoot.getElementById('spaceamp-lyrics-motion-profile'));
  const measurements=[];
  for(const [index,boundary] of [23.4,25.74,28.38].entries()) {
   const samples=[];
   for(const offset of [-200,-100,0,100,200,400]) {
    await page.evaluate(position=>{__position=position;SPACEAMP.progress({position});},boundary+offset/1000);
    await page.waitForTimeout(100);
    samples.push(await page.evaluate(index=>{
     const root=document.querySelector('am-lyrics').shadowRoot;
     const line=[...root.querySelectorAll('.lyrics-line:not(.lyrics-gap)')][6+index];
     const selectors=['.lyrics-line-container','.main-vocal-container','.lyrics-word','.char'];
     return {x:selectors.map(selector=>{const n=line.querySelector(selector);if(n)return n.getBoundingClientRect().left;if(selector!=='.char')throw Error('Missing '+selector);const word=line.querySelector('.lyrics-word');const walker=document.createTreeWalker(word,NodeFilter.SHOW_TEXT);const text=walker.nextNode();const range=document.createRange();range.setStart(text,0);range.setEnd(text,1);return range.getBoundingClientRect().left;}), geometry:[...root.querySelectorAll('.char,.char-motion,.lyrics-line-container,.main-vocal-container')].every(n=>getComputedStyle(n).transform==='none')};
    },index));
    await page.screenshot({path:`artifacts/spaceamp-lyrics-motion/transition-${index}-${offset}.png`});
   }
   for(let part=0;part<4;part++)assert.ok(Math.max(...samples.map(s=>s.x[part]))-Math.min(...samples.map(s=>s.x[part]))<.5,'horizontal drift '+part);
   assert.ok(samples.every(s=>s.geometry),'glyph/line geometry must remain neutral');measurements.push(samples);
  }
  fs.writeFileSync('artifacts/spaceamp-lyrics-motion/measurements.json',JSON.stringify(measurements,null,2));
  await page.evaluate(()=>{__position=25.9;SPACEAMP.progress({position:25.9});});await page.waitForTimeout(100);
  if(mode==='B'){
   const scrollEnd=await page.evaluate(()=>document.querySelector('am-lyrics').shadowRoot.querySelector('.lyrics-container').scrollTop);assert.ok(Math.abs(scrollEnd-scrollStart)>10,'upstream autoscroll must move');
   assert.ok(Math.abs(await page.evaluate(()=>document.querySelector('am-lyrics').currentTime)-25900)<.01);
   await page.evaluate(()=>SPACEAMP.pause());assert.equal(await page.evaluate(()=>SPACEAMP.getPlaybackState().playing),false);
   await page.waitForTimeout(150);assert.ok(Math.abs(await page.evaluate(()=>document.querySelector('am-lyrics').currentTime)-25900)<.01);await page.evaluate(()=>SPACEAMP.play());
   await page.locator('am-lyrics').locator('.lyrics-line').nth(8).click();assert.notEqual(await page.evaluate(()=>__position),25.9);
   // Word-sync exercises the upstream WAAPI glyph animations as well as line scale.
   await page.evaluate(()=>{
    const ttml='<tt xmlns="http://www.w3.org/ns/ttml" xmlns:itunes="http://music.apple.com/lyric-ttml-internal" itunes:timing="Word"><body><div>'+Array.from({length:4},(_,i)=>`<p begin="${i*2}s" end="${i*2+2}s"><span begin="${i*2}s" end="${i*2+1}s">Stable </span><span begin="${i*2+1}s" end="${i*2+2}s">highlight</span></p>`).join('')+'</div></body></tt>';
    document.querySelector('am-lyrics').setAttribute('ttml',ttml);__position=0;SPACEAMP.progress({position:0});
   });
   await page.waitForFunction(()=>document.querySelector('am-lyrics').shadowRoot.querySelector('.char'));
   const wordFrames=[];
   for(const boundary of [2,4,6]) {
    const samples=[];
    for(const offset of [-200,-100,0,100,200,400]) {
     await page.evaluate(t=>{__position=t;SPACEAMP.progress({position:t});},boundary+offset/1000);await page.waitForTimeout(100);
     samples.push(await page.evaluate(index=>{
      const root=document.querySelector('am-lyrics').shadowRoot,line=[...root.querySelectorAll('.lyrics-line:not(.lyrics-gap)')][index];
      return {x:['.lyrics-line-container','.main-vocal-container','.lyrics-word','.char'].map(s=>line.querySelector(s).getBoundingClientRect().left),geometry:[...root.querySelectorAll('.char,.char-motion')].every(n=>getComputedStyle(n).transform==='none'),paint:root.querySelector('.char').getAttribute('style')};
     },boundary/2));
    }
    for(let part=0;part<4;part++)assert.ok(Math.max(...samples.map(s=>s.x[part]))-Math.min(...samples.map(s=>s.x[part]))<.5,'word-sync horizontal drift');
    assert.ok(samples.every(s=>s.geometry));wordFrames.push(samples);
   }
   assert.ok(new Set(wordFrames.flat().map(s=>s.paint)).size>1,'temporal glyph paint must continue changing');
   fs.writeFileSync('artifacts/spaceamp-lyrics-motion/word-measurements.json',JSON.stringify(wordFrames,null,2));
   await page.evaluate(()=>SPACEAMP.update({title:'Track change',artist:'Fixture',source:'local',sourceUrl:'other'},true,{available:true}));assert.equal(await page.locator('am-lyrics').getAttribute('song-title'),'Track change');
  }
 }
 assert.deepEqual(errors,[]);console.log('PASS: paint-only profile; three transitions, horizontal drift <0.5px, neutral glyph geometry, upstream scroll, seek, pause/resume, track change.');
 await context.close();
 }finally{await browser?.close();web.closeAllConnections();await new Promise(r=>web.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
