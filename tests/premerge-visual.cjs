// One browser/context, three screenshots, local providers, no capture or calls.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(path.join(require('node:os').homedir(),
  '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const { createServer } = require('../server.cjs');
const output = 'artifacts/premerge';
fs.mkdirSync(output, { recursive: true });
const web = createServer({ music: {
  search: async () => ({ items: [] }), details: async () => ({}),
  summary: async () => ({}), recommendations: async () => ({ items: [] }),
} });
let browser;
(async () => {
  try {
    await new Promise(resolve => web.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({
      executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true,
    });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.route('https://**/*', route => route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:' + web.address().port + '/?voiceTransport=local#perfil');
    await page.waitForSelector('#globalSpaceAmp');
    assert.equal(await page.evaluate(() =>
      [Collection, CollectionActions, Catalog, TitlePages, MusicBridge, SPACEAMP, PARTY_ROOM].every(Boolean)), true);
    for (const [route, name, selector] of [
      ['#perfil', 'profile', '#globalSpaceAmp'],
      ['#colecao', 'collection', '#collectionPage'],
      ['#spacevoice', 'party', '#spaceVoicePage'],
    ]) {
      await page.evaluate(hash => { location.hash = hash; }, route);
      await page.waitForSelector(selector, { state: 'visible' });
      await page.waitForTimeout(200);
      assert.equal(await page.locator('audio').count(), 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await page.screenshot({ path: path.join(output, name + '.png'), fullPage: true });
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'visual.json'), JSON.stringify({ errors, contexts: 1, pages: 3 }));
    console.log('Profile, Collection, SPACEAMP and PARTY: boot/globals/assets/layout OK, one context.');
  } finally {
    await browser?.close();
    web.closeAllConnections();
    await new Promise(resolve => web.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
