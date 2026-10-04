// Official component, deterministic TTML and provider clock; one browser/context.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(require('node:os').homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const {createServer}=require('../server.cjs');const web=createServer({music:{search:async()=>({items:[]}),details:async()=>({}),summary:async()=>({}),recommendations:async()=>({items:[]})}});let browser;
(async()=>{try{
 fs.mkdirSync('artifacts/spaceamp-lyrics-motion',{recursive:true});
 const modulePath='artifacts/video-comparison/am-lyrics-1.7.4.js';
 const official=fs.existsSync(modulePath)?fs.readFileSync(modulePath,'utf8'):await (await fetch('https://cdn.jsdelivr.net/npm/@uimaxbai/am-lyrics@1.7.4/dist/src/am-lyrics.min.js')).text();
 const lines=Array.from({length:14},(_,i)=>`<p begin="${i*3}s" end="${i*3+3}s">Fixture line ${i+1} with a continuous scroll</p>`).join('');
 const ttml=`<tt xmlns="http://www.w3.org/ns/ttml"><body><div>${lines}</div></body></tt>`;
 await new Promise(r=>web.listen(0,'127.0.0.1',r));browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const context=await browser.newContext({viewport:{width:1600,height:900}});
 await context.route('https://**/*',r=>r.request().url().includes('/am-lyrics.min.js')?r.fulfill({contentType:'text/javascript',body:`for(const n of document.querySelectorAll('am-lyrics'))n.setAttribute('ttml',${JSON.stringify(ttml)});\n`+official+"\nwindow.__lyricsLoads=0;const Component=customElements.get('am-lyrics'),fetchLyrics=Component.prototype.fetchLyrics;Component.prototype.fetchLyrics=function(...args){__lyricsLoads++;return fetchLyrics.apply(this,args);};"}):r.abort());
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+web.address().port+'/?voiceTransport=local');await page.waitForSelector('#globalSpaceAmp');
 await page.evaluate(()=>{window.__position=1;window.__duration=0;SPACEAMP.configure({getPlaybackTime:()=>({position:__position,duration:__duration}),pause:()=>SPACEAMP.update(SPACEAMP.getState(),false),play:()=>SPACEAMP.update(SPACEAMP.getState(),true),seek:t=>{__position=t;SPACEAMP.progress({position:t});}});SPACEAMP.update({title:'Lyrics motion fixture',artist:'Fixture',source:'YouTube',sourceUrl:'fixture',artwork:'profile-art.png'},true,{available:true});SpaceAmpNowPlaying.open();});
 
 await page.waitForFunction(()=>document.querySelector('am-lyrics')?.shadowRoot?.querySelectorAll('.lyrics-line').length>=10);
 // A duration that arrives after lyrics are ready must not refetch or replace them.
 await page.waitForTimeout(300);const baselineLoads=await page.evaluate(()=>{window.__originalLyrics=document.querySelector('am-lyrics');return __lyricsLoads;});
 await page.evaluate(()=>{__duration=42;SPACEAMP.progress({duration:42});});await page.waitForTimeout(500);
 assert.equal(await page.evaluate(()=>__lyricsLoads),baselineLoads);
 assert.equal(await page.evaluate(()=>__originalLyrics===document.querySelector('am-lyrics')),true);
 assert.equal(await page.locator('am-lyrics').getAttribute('line-motion'),'uniform');
 // Actual upstream DOM is observed only in this test, never patched by production.
 const metrics={};
 for(const mode of ['cascade','uniform']){
   await page.evaluate(mode=>{document.querySelector('am-lyrics').setAttribute('line-motion',mode);__position=4.5;SPACEAMP.progress({position:4.5});},mode);await page.waitForTimeout(1500);
   const recording=page.evaluate(()=>new Promise(resolve=>{
     const component=document.querySelector('am-lyrics'),rows=[...component.shadowRoot.querySelectorAll('.lyrics-line')],samples=[];const start=performance.now();
     function tick(now){const t=(now-start)/1000;__position=4.5+t;samples.push({t,y:rows.slice(1,6).map(n=>n.getBoundingClientRect().top)});if(t<3)requestAnimationFrame(tick);else resolve(samples);}
     requestAnimationFrame(tick);
   }));
   for(let i=0;i<6;i++){await page.waitForTimeout(450);await page.screenshot({path:'artifacts/spaceamp-lyrics-motion/'+mode+'-'+i+'.png'});}
   metrics[mode]=await recording;
 }
 const summary={};for(const [mode,frames] of Object.entries(metrics)){let maxStep=0,maxVelocity=0;for(let i=1;i<frames.length;i++){const dt=frames[i].t-frames[i-1].t;if(dt>.08)continue;for(let row=0;row<5;row++){const d=Math.abs(frames[i].y[row]-frames[i-1].y[row]);maxStep=Math.max(maxStep,d);maxVelocity=Math.max(maxVelocity,d/dt);}}const displacement=Math.max(...Array.from({length:5},(_,row)=>Math.max(...frames.map(f=>f.y[row]))-Math.min(...frames.map(f=>f.y[row]))));const first=frames[0].y,rowSpread=Math.max(...frames.map(f=>{const shifts=f.y.map((y,i)=>y-first[i]);return Math.max(...shifts)-Math.min(...shifts);}));summary[mode]={frames:frames.length,maxStep,maxVelocity,displacement,rowSpread};}
 assert.ok(summary.uniform.frames>60);assert.ok(summary.uniform.displacement>50,'Lyrics must actually move');assert.ok(summary.cascade.rowSpread>10);assert.ok(summary.uniform.rowSpread<1,'Rows must move together without corrective staggering');assert.ok(summary.uniform.maxVelocity<1400,JSON.stringify(summary));
 await page.locator('.np-progress').fill('0.5');await page.waitForTimeout(1000);
 await page.locator('am-lyrics').locator('.lyrics-line').nth(8).click();
 assert.equal(await page.evaluate(()=>__position),24);
 await page.evaluate(()=>SPACEAMP.update(SPACEAMP.getState(),false,{playbackStatus:'loading'}));assert.equal(await page.getByRole('button',{name:'Pausar',exact:true}).count(),1);
 await page.getByRole('button',{name:'Pausar',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Reproduzir',exact:true}).count(),1);
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>{__position=24;SPACEAMP.progress({position:24});});await page.waitForTimeout(200);
 assert.deepEqual(errors,[]);fs.writeFileSync('artifacts/spaceamp-lyrics-motion/metrics.json',JSON.stringify({summary,metrics},null,2));console.log('Official am-lyrics motion:',JSON.stringify(summary));
 await context.close();
 }finally{await browser?.close();web.closeAllConnections();await new Promise(r=>web.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
