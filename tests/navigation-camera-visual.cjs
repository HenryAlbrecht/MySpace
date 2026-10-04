// Local scroll/geometry fixture: one browser/context, no providers or capture.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(path.join(require('node:os').homedir(),
  '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const { createServer } = require('../server.cjs');
const phase = process.argv[2] || 'after';
const output = path.resolve('artifacts/navigation-camera', phase);
fs.mkdirSync(output, { recursive: true });
const web = createServer({ music: {
  search: async () => ({ items: [] }), details: async () => ({}),
  summary: async () => ({}), recommendations: async () => ({ items: [] }), artistPhoto: async () => ({}),
} });
let browser;
(async () => {
  try {
    await new Promise(resolve => web.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.route('https://**/*', route => route.abort());
    await context.addInitScript(() => {
      localStorage.setItem('myspace-collection-view', 'list');
      sessionStorage.setItem('myspace-reading-positions', JSON.stringify(
        ['#perfil','#fotos','#buscar','#descobrir','#spacevoice'].map(hash=>[hash,500])));
      localStorage.setItem('myspace-extras-v1', JSON.stringify({ version: 1,
        items: ['film', 'series', 'game'].flatMap(kind => Array.from({ length: 40 }, (_, n) => ({
          id: kind + n, kind, title: kind + ' fixture ' + n, status: 'planned',
          progress: 0, total: 0, image: '/profile-art.png',
        }))),
      }));
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${web.address().port}/?voiceTransport=local#colecao/film`);
    await page.waitForSelector('#collectionPage');
    await page.evaluate(() => {
      window.__scrollCalls = [];
      const original = window.scrollTo.bind(window);
      window.scrollTo = options => { __scrollCalls.push(options); return original(options); };
    });

    await page.evaluate(() => { Catalog.details=async item=>item; Catalog.summary=async item=>item; });
    async function route(hash) {
      await page.evaluate(hash=>{
        const link = !hash.includes('/') && document.querySelector('.nav a[data-route="'+hash.slice(1)+'"]');
        if (link) link.click(); else location.hash=hash;
      },hash);
      await page.waitForTimeout(300);
    }
    async function setY() {
      await page.evaluate(()=>scrollTo({top:900,behavior:'instant'}));
      await page.waitForTimeout(60);
    }
    const results = [];
    for (const surface of ['#spacevoice','#perfil','#fotos','#buscar','#descobrir']) {
      await route('#colecao/film'); await setY();
      await route(surface);
      const entryY = await page.evaluate(()=>scrollY);
      assert.ok(entryY<2, surface+' header entry');
      await route('#colecao/film');
      const y=await page.evaluate(()=>scrollY); assert.ok(y<2,surface+' new entry '+y);
      results.push({surface,entryY,collectionY:y});
    }
    await setY(); await route('#colecao/series');
    assert.ok(Math.abs(await page.evaluate(()=>scrollY)-900)<2);
    await page.evaluate(()=>{
      window.cameraTitle = {kind:'game',catalogId:'itunes:camera-fixture',title:'Camera fixture',summary:Array(80).fill('Long fixture description for scroll verification.').join('\n\n')};
      TitlePages.open(cameraTitle);
    });
    await page.waitForTimeout(350);
    assert.ok(await page.evaluate(()=>scrollY)<2);
    await page.evaluate(()=>scrollTo({top:400,behavior:'instant'}));
    await page.waitForTimeout(80);
    assert.ok(await page.evaluate(()=>scrollY)>200,'title fixture scrolls');
    await page.evaluate(()=>TitlePages.open(cameraTitle));
    await page.waitForTimeout(250);
    assert.ok(await page.evaluate(()=>scrollY)<2,'same title clicked again opens at top');
    await page.goBack(); await page.waitForTimeout(350);
    assert.ok(await page.evaluate(()=>scrollY)<2,'programmatic title without Collection origin returns at top');
    await page.evaluate(() => { Catalog.details = async item => ({...item, summary:Array(80).fill('Long cached detail description.').join('\n\n')}); });
    await page.locator('.list-entry').first().dblclick();
    await page.waitForTimeout(250);
    await page.evaluate(()=>scrollTo({top:400,behavior:'instant'}));
    await page.waitForTimeout(80);
    await page.goBack(); await page.waitForTimeout(250);
    await page.locator('.list-entry').first().dblclick();
    await page.waitForTimeout(250);
    assert.ok(await page.evaluate(()=>scrollY)<2,'actual collection item after browser Back opens at top');
    await page.goBack(); await page.waitForTimeout(250);
    await page.locator('.list-entry').nth(1).dblclick();
    await page.waitForTimeout(250);
    assert.ok(await page.evaluate(()=>scrollY)<2,'different collection item opens at top');
    await page.getByRole('button',{name:'← voltar',exact:true}).click();
    await page.waitForTimeout(250);
    await route('#spacevoice');
    await page.goBack(); await page.waitForTimeout(350);
    assert.ok(await page.evaluate(()=>scrollY)<2,'main surface Back');
    await page.goForward(); await page.waitForTimeout(250);
    await page.goBack(); await page.waitForTimeout(350);
    assert.ok(await page.evaluate(()=>scrollY)<2,'main surface Forward/Back');
    await page.locator('.list-entry').first().click();
    for(let index=0;index<18;index++)await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(350);
    const down=await page.evaluate(()=>scrollY);assert.ok(down>200,'keyboard down');
    for(let index=0;index<18;index++)await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(350);
    assert.ok(await page.evaluate(()=>scrollY)<2,'first item camera top');
    await page.evaluate(()=>scrollTo({top:200,behavior:'instant'}));
    await page.keyboard.press('ArrowUp');await page.waitForTimeout(350);
    assert.ok(await page.evaluate(()=>scrollY)<2,'first boundary camera top');
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.evaluate(()=>scrollTo({top:200,behavior:'instant'}));
    await page.keyboard.press('ArrowUp');
    assert.ok(await page.evaluate(()=>scrollY)<2,'reduced instant');
    await page.locator('.list-entry').last().click();
    const boundary=await page.evaluate(async()=>{
      const detail=document.querySelector('.collection-list-detail');const image=detail.querySelector('img');
      let count=0;const observer=new MutationObserver(rows=>count+=rows.length);observer.observe(detail,{childList:true,subtree:true,attributes:true});
      for(let index=0;index<8;index++)document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
      await new Promise(requestAnimationFrame);observer.disconnect();return {count,same:image===detail.querySelector('img')};
    });
    assert.deepEqual(boundary,{count:0,same:true});assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({results,down,boundary,errors},null,2));
    console.log('Navigation camera: entry, title return, history, categories and keyboard passed.');
  } finally {await browser?.close();await new Promise(resolve=>web.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
