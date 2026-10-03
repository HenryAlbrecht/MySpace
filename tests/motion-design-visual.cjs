// One local browser/context. Exercises presentation, never providers or capture.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(path.join(require('node:os').homedir(),
  '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const { createServer } = require('../server.cjs');
const output = path.resolve('artifacts/motion-design');
fs.mkdirSync(output, { recursive: true });
const web = createServer({ music: {
  search: async () => ({ items: [] }), summary: async () => ({}),
  recommendations: async () => ({ items: [] }), artistPhoto: async () => ({}), details: async () => ({}),
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
    await page.goto(`http://127.0.0.1:${web.address().port}/?voiceTransport=local#perfil`);
    await page.waitForSelector('.motion-nav-indicator');

    async function navigate(hash, selector) {
      return page.evaluate(async ({ hash, selector }) => {
        const routed = new Promise(resolve => window.addEventListener('hashchange', resolve, { once: true }));
        location.hash = hash;
        await routed;
        const target = document.querySelector(selector);
        return target.getAnimations().map(animation => animation.effect.getKeyframes());
      }, { hash, selector });
    }
    const forward = await navigate('#colecao', '#collectionPage');
    assert.ok(forward.some(frames => frames[0].transform === 'translateX(14px)'));
    // Freeze the actual animation at three times, for a repeatable visual sequence.
    await page.evaluate(() => {
      const animation = document.querySelector('#collectionPage').getAnimations()[0];
      animation.pause();
      window.__motionCapture = animation;
    });
    for (const time of [0, 80, 200]) {
      await page.evaluate(time => { __motionCapture.currentTime = time; }, time);
      await page.screenshot({ path: path.join(output, `collection-${time}.png`) });
    }
    await page.evaluate(() => __motionCapture.cancel());
    const backward = await navigate('#perfil', '.columns > aside');
    assert.ok(backward.some(frames => frames[0].transform === 'translateX(-12px)'));
    await page.evaluate(() => {
      Catalog.details = () => new Promise(resolve => { window.__finishDetails = resolve; });
      Catalog.summary = async item => item;
      window.__motionItem = { kind: 'music', catalogId: 'itunes:motion-fixture',
        title: 'Motion fixture', artist: 'Fixture', image: '/profile-art.png' };
      TitlePages.open(__motionItem);
    });
    await page.waitForFunction(() => document.querySelector('#titlePage .title-cover')?.getAnimations().length > 0);
    await page.screenshot({ path: path.join(output, 'title-entry.png') });
    await page.evaluate(() => __finishDetails({ ...__motionItem, title: 'Enriched fixture' }));
    await page.waitForFunction(() => document.querySelector('#titlePage h1')?.textContent === 'Enriched fixture');
    assert.equal(await page.locator('#titlePage .title-cover').evaluate(node => node.getAnimations().length), 0);
    await navigate('#spacevoice', '#spaceVoicePage');
    await page.locator('.party-chat-toggle').click();
    assert.ok(await page.locator('.party-context-rail').evaluate(node => node.getAnimations().length > 0));
    await page.evaluate(() => Promise.all(document.getAnimations()
      .filter(animation => animation.effect.getComputedTiming().iterations !== Infinity)
      .map(animation => animation.finished.catch(() => {}))));
    await page.evaluate(() => {
      const party = document.querySelector('.spacevoice');
      const box = party.querySelector('.spacevoice-avatar').getBoundingClientRect();
      window.__avatarBefore = { left: box.left, top: box.top, width: box.width };
      party.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      party.dataset.mode = 'screen';
    });
    await page.waitForFunction(() => document.querySelector('.spacevoice-avatar').getAnimations().length > 0);
    const avatarFrames = await page.locator('.spacevoice-avatar').first().evaluate(node =>
      node.getAnimations()[0].effect.getKeyframes());
    assert.ok(avatarFrames[0].transform.includes('translate('));
    const continuity = await page.locator('.spacevoice-avatar').first().evaluate(node => {
      const animation = node.getAnimations()[0];
      animation.pause();
      animation.currentTime = 0;
      const box = node.getBoundingClientRect();
      return ['left', 'top', 'width'].every(key => Math.abs(box[key] - __avatarBefore[key]) < 1);
    });
    assert.equal(continuity, true);
    await page.screenshot({ path: path.join(output, 'party-context.png') });

    await page.getByRole('button', { name: '▧ APARÊNCIA', exact: true }).click();
    assert.equal(await page.locator('dialog[open]').evaluate(node => getComputedStyle(node).animationName), 'desktop-dialog-in');
    await page.screenshot({ path: path.join(output, 'dialog.png') });
    await page.keyboard.press('Escape');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const reduced = await navigate('#buscar', '#discoverPage');
    assert.equal(reduced.length, 0);
    assert.equal(await page.locator('.motion-nav-indicator').evaluate(node => node.getAnimations().length), 0);
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({
      errors, forward, backward, avatarFrames, reducedMotion: true, browserContexts: 1,
    }, null, 2));
    console.log('Motion design: route direction, frame sequence, PARTY FLIP, dialog and reduced motion passed.');
  } finally {
    await browser?.close();
    web.closeAllConnections();
    await new Promise(resolve => web.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
