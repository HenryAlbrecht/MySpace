// Public artist payloads audited this round are replayed; discovery scenarios use isolated fixtures.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(require('node:os').homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const {createServer}=require('../server.cjs');
const root='artifacts/duration-memory',audit=JSON.parse(fs.readFileSync(root+'/audit.json','utf8'));
(async()=>{const server=createServer();let browser;try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage(),errors=[],counts={},report=[];
 page.on('pageerror',error=>errors.push(error.message));
 const art=base+'/memory-fixture.svg';await context.route('**/memory-fixture.svg',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#334959"/><circle cx="230" cy="180" r="95" fill="#628597"/></svg>'}));
 const track=(title,id)=>({kind:'music',title,catalogId:'ytmusic:video:'+id,artist:'Artist',image:art,source:'YouTube Music',trackDuration:228,playbackSource:{type:'youtube',videoId:id}});
 const release=(title,id)=>({kind:'album',title,catalogId:'ytmusic:album:MPRE'+id,artist:'Artist',albumType:'single',releaseDate:'2026',image:art,source:'YouTube Music'});
 const artist=(title,id)=>({kind:'artist',title,catalogId:'ytmusic:artist:UC'+id,image:art,source:'YouTube Music'});
 const whale=release('Whale Net','whalenet123'),x=release('Album X','albumxxxx123'),y=release('Album Y','albumyyyy123'),creep=track('Creep','creep000001'),tx=track('Track X','track000001'),originArtist=artist('Origin artist','originartist123'),artistX=artist('Artist X','relatedartist123');
 const entities=new Map([...audit.map(row=>row.detail),whale,x,y,creep,tx,originArtist,artistX].map(item=>[item.catalogId,item]));
 let searchRelease,searchGate=new Promise(resolve=>searchRelease=resolve);
 await context.route('**/api/music/ytmusic/**',r=>{const url=new URL(r.request().url()),parts=url.pathname.split('/'),kind=parts.at(-2),id=parts.at(-1),key='ytmusic:'+(kind==='music'?'video':kind)+':'+id;return r.fulfill({json:entities.get(key)||{kind,catalogId:key,title:'Intent track',trackDuration:250,image:art,source:'YouTube Music'}});});
 await context.route('**/api/music/search?*',async r=>{const url=new URL(r.request().url()),q=url.searchParams.get('q')||url.searchParams.get('query');counts[q]=(counts[q]||0)+1;const real=audit.find(row=>row.detail.title===q);if(real){await searchGate;return r.fulfill({json:{items:real.search}});}return r.fulfill({json:{items:[y]}});});
 await context.route('**/api/music/recommendations?*',r=>{const title=new URL(r.request().url()).searchParams.get('title');return r.fulfill({json:{items:title===whale.title?[x]:title===creep.title?[tx]:title===originArtist.title?[artistX]:[]}});});
 await page.goto(base+'/#buscar');await page.waitForFunction(()=>window.TitlePages&&window.CollectionActions);
 for(const real of audit){
  await page.evaluate(item=>TitlePages.open(item),real.detail);await page.waitForSelector('.music-tracklist .music-track-duration',{state:'attached'});
  await page.evaluate(()=>{window.topRows=[...document.querySelectorAll('.music-tracklist .music-track-row')];window.topSlots=topRows.map(row=>row.querySelector('.music-track-duration'));window.hero=document.querySelector('.title-layout');});
  assert.equal(await page.locator('.music-tracklist .music-track-duration').count(),5);
  searchRelease();await page.waitForFunction(()=>[...document.querySelectorAll('.music-track-duration')].some(slot=>slot.textContent));
  const rows=await page.locator('.music-tracklist .music-track-row').evaluateAll(rows=>rows.map(row=>({title:row.querySelector('.music-track-title').textContent,id:row.dataset.catalogId,duration:row.querySelector('.music-track-duration').textContent})));
  assert.equal(rows.filter(row=>row.duration).length,real.name==='Goo Goo Dolls'?2:3);
  assert.equal(await page.evaluate(()=>hero===document.querySelector('.title-layout')&&topRows.every((row,index)=>row===document.querySelectorAll('.music-track-row')[index]&&topSlots[index]===row.querySelector('.music-track-duration'))),true);
  assert.equal(counts[real.detail.title],1);report.push({name:real.name,rows,extraSearches:counts[real.detail.title]});
  await page.locator('.music-tracklist').first().scrollIntoViewIfNeeded();await page.screenshot({path:root+'/'+real.name.replaceAll(' ','-')+'.png',fullPage:true});
  await page.locator('.music-tracklist').first().screenshot({path:root+'/'+real.name.replaceAll(' ','-')+'-tracks.png'});
  // A selected unresolved row can patch its existing slot when intent core supplies a clock.
  const unresolved=rows.find(row=>!row.duration);await page.locator('.music-track-row[data-catalog-id="'+unresolved.id+'"] .music-track-main').focus();await page.waitForFunction(id=>[...document.querySelectorAll('.music-track-row')].find(row=>row.dataset.catalogId===id)?.querySelector('.music-track-duration').textContent==='4:10',unresolved.id);
  assert.equal(await page.evaluate(()=>topRows.every((row,index)=>row===document.querySelectorAll('.music-track-row')[index]&&topSlots[index]===row.querySelector('.music-track-duration'))),true);
 }
 async function open(item,origin){await page.evaluate(({item,origin})=>TitlePages.open(item,{origin}),{item,origin});await page.waitForFunction(title=>document.querySelector('#titlePage h1')?.textContent===title,item.title);}
 const localOrigin={kind:whale.kind,catalogId:whale.catalogId,title:whale.title,surface:'title'};
 await open(whale);await page.locator('[data-title-discovery]').getByRole('button').first().click();await page.locator('[data-title-discovery] .discover-card').filter({hasText:'Album X'}).click();await page.waitForFunction(()=>document.querySelector('#titlePage h1')?.textContent==='Album X');
 assert.equal(await page.evaluate(()=>CollectionActions.getItems().length),0);
 await page.locator('.title-actions').getByRole('button',{name:'＋ adicionar à coleção',exact:true}).click();
 assert.deepEqual(await page.evaluate(()=>CollectionActions.getItems()[0].discoveryOrigin),localOrigin);
 await page.locator('#titlePage > .section-head').getByRole('button',{name:'← voltar',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#titlePage h1')?.textContent==='Whale Net');
 await page.locator('[data-title-discovery]').getByRole('button').first().click();assert.equal(await page.locator('[data-title-discovery] .discover-card').filter({hasText:'Album X'}).count(),0);
 assert.equal(await page.locator('[data-discovered-here] .discover-card').filter({hasText:'Album X'}).count(),1);
 // Manual search clears prior recommendation context, including for the same candidate.
 await open(y,localOrigin);await page.evaluate(()=>location.hash='#buscar/album/Album%20Y');await page.locator('#discoverPage .discover-card').filter({hasText:'Album Y'}).click();await page.waitForFunction(()=>document.querySelector('#titlePage h1')?.textContent==='Album Y');await page.evaluate(item=>CollectionActions.quickAdd(item),y);
 assert.equal(await page.evaluate(id=>CollectionActions.getItems().find(row=>row.catalogId===id).discoveryOrigin,y.catalogId),undefined);
 await open(y,localOrigin);await page.evaluate(id=>CollectionActions.updateItem(CollectionActions.getItems().find(row=>row.catalogId===id).id,{notes:'existing without origin'}),y.catalogId);assert.equal(await page.evaluate(id=>CollectionActions.getItems().find(row=>row.catalogId===id).discoveryOrigin,y.catalogId),undefined);
 await open(x,{...localOrigin,title:'Second origin',catalogId:y.catalogId});await page.evaluate(id=>CollectionActions.updateItem(CollectionActions.getItems().find(row=>row.catalogId===id).id,{notes:'Edited',discoveryOrigin:{kind:'album',catalogId:'ytmusic:album:MPREneworigin123',title:'Wrong',surface:'title'}}),x.catalogId);
 assert.deepEqual(await page.evaluate(id=>CollectionActions.getItems().find(row=>row.catalogId===id).discoveryOrigin,x.catalogId),localOrigin);
 const favorite=artist('Favorite via recommendation','favoriteartist123');entities.set(favorite.catalogId,favorite);await open(favorite,localOrigin);await page.locator('.title-actions').getByRole('button',{name:'☆ favoritar artista',exact:true}).click();assert.deepEqual(await page.evaluate(id=>CollectionActions.getItems().find(row=>row.catalogId===id).discoveryOrigin,favorite.catalogId),localOrigin);
 // Real global card path, with the existing blender result shape.
 await page.evaluate(({creep,tx})=>{CollectionActions.quickAdd(creep);Catalog.forCollection=async()=>({items:[{...tx,seedKind:creep.kind,seedCatalogId:creep.catalogId,seedTitle:creep.title}],seeds:1,failures:0});location.hash='#descobrir';},{creep,tx});await page.waitForSelector('#personalizedDiscovery:not([hidden])');await page.locator('#personalizedDiscovery').getByRole('button',{name:'carregar sugestões',exact:true}).click();await page.locator('#personalizedDiscovery .discover-card').click();await page.waitForFunction(()=>document.querySelector('#titlePage h1')?.textContent==='Track X');await page.locator('.title-actions').getByRole('button',{name:'＋ adicionar à coleção',exact:true}).click();
 assert.deepEqual(await page.evaluate(id=>CollectionActions.getItems().find(row=>row.catalogId===id).discoveryOrigin,tx.catalogId),{kind:'music',catalogId:creep.catalogId,title:'Creep',surface:'global'});
 // Direct hash navigation after leaving clears context; opening without options also clears it.
 const direct=release('Direct release','directalbum123');entities.set(direct.catalogId,direct);await open(direct,localOrigin);await page.evaluate(()=>location.hash='#perfil');await page.waitForFunction(()=>location.hash==='#perfil');await page.evaluate(id=>location.hash='#titulo/album/'+encodeURIComponent(id),direct.catalogId);await page.waitForFunction(()=>document.querySelector('#titlePage h1')?.textContent==='Direct release');await page.evaluate(item=>CollectionActions.quickAdd(item),direct);assert.equal(await page.evaluate(id=>CollectionActions.getItems().find(row=>row.catalogId===id).discoveryOrigin,direct.catalogId),undefined);
 for(const [kind,source,factory]of [['music',creep,track],['album',whale,release],['artist',originArtist,artist]]){
  const origin={kind:source.kind,catalogId:source.catalogId,title:source.title,surface:'title'};
  for(let i=0;i<8;i++){const item=factory('Discovered '+kind+' '+i,kind==='music'?'disc'+String(i).padStart(7,'0'):'discovered'+i+'123');entities.set(item.catalogId,item);await open(item,origin);await page.evaluate(item=>CollectionActions.quickAdd(item),item);}
  await open(source);const section=page.locator('[data-discovered-here]');await section.scrollIntoViewIfNeeded();assert.equal(await section.locator('.music-track-row,.discover-card').count(),3);
  const count=kind==='album'?10:8;await section.getByRole('button',{name:'ver todos ('+count+') →',exact:true}).click();assert.equal(await section.locator('.music-track-row,.discover-card').count(),count);
  await page.evaluate(()=>{window.stableHero=document.querySelector('.title-layout');window.stableRecommendations=document.querySelector('[data-title-discovery]');});
  if(kind==='music')assert.equal(await section.locator('.discover-card').count(),0);else{const bounds=await section.locator('.title-cover').first().boundingBox();assert.ok(Math.abs(bounds.width-bounds.height)<2);}
  await section.getByRole('button',{name:'recolher ↑',exact:true}).click();await page.screenshot({path:root+'/discovered-'+kind+'.png',fullPage:true});
  await page.evaluate(()=>CollectionActions.updateItem(CollectionActions.getItems().at(-1).id,{notes:'local update'}));assert.equal(await page.evaluate(()=>stableHero===document.querySelector('.title-layout')&&stableRecommendations===document.querySelector('[data-title-discovery]')),true);
 }
 // Remove a discovered item through the existing editor; only the local section updates.
 const doomed=await page.evaluate(()=>CollectionActions.getItems().at(-1));await page.evaluate(item=>CollectionActions.editItem(item),doomed);await page.locator('#resourceEditor .dialog-delete').click();await page.locator('#resourceEditor').getByRole('button',{name:'excluir',exact:true}).click();assert.equal(await page.evaluate(id=>CollectionActions.getItems().some(row=>row.id===id),doomed.id),false);assert.equal(await page.locator('[data-discovered-toggle]').textContent(),'ver todos (7) →');
 assert.deepEqual(errors,[]);fs.writeFileSync(root+'/browser.json',JSON.stringify({report,errors,counts},null,2));console.log('PASS: exact-ID artist duration batches, stable hero/rows/slots; local/global/manual/direct URL provenance, first origin wins, 3/8 preview, square releases/artists, music rows, collection patches/removal.');
 await context.close();
}finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}})().catch(error=>{console.error(error);process.exitCode=1;});
