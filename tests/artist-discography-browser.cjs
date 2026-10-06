// Real local CORE/FULL HTTP flow; guest responses are deterministic fixtures.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require(
  path.join(
    require('node:os').homedir(),
    '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright',
  ),
);
const { createServer } = require('../server.cjs');
const { createYouTubeMusicClient } = require('../server/youtube-music.cjs');
const { createMusicCatalog } = require('../server/music-catalog.cjs');
const fixture = require('./fixtures/youtube-music-artist-sections.json');
let release;
const gate = new Promise((resolve) => {
  release = resolve;
});
const calls = [];
const client = createYouTubeMusicClient({
  fetcher: async (_url, options) => {
    if (!options?.body)
      return {
        ok: true,
        text: async () =>
          'ytcfg.set({"INNERTUBE_API_KEY":"fixture","INNERTUBE_CLIENT_VERSION":"1"});',
      };
    const body = JSON.parse(options.body);
    if (body.query) return { ok: true, json: async () => ({}) }; // Existing artist photo lookup only.
    calls.push(body);
    let payload;
    if (body.browseId === fixture.artistId) payload = fixture.artist;
    else {
      await gate;
      payload =
        body.params === 'albums%3D'
          ? fixture.albums
          : body.params === 'singles%3D'
            ? fixture.singles
            : body.continuation === 'page-1'
              ? fixture.continuation
              : fixture.final;
    }
    return { ok: true, json: async () => structuredClone(payload) };
  },
});
const music = createMusicCatalog({
  youtubeMusic: client,
  lastfm: {
    summary: async () => ({}),
    recommendations: async () => ({ items: [] }),
  },
  artistArtwork: { lookup: async () => '' },
});
const server = createServer({ music });
(async () => {
  let browser;
  try {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({
      executablePath:
        'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      headless: true,
    });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    await context.route('https://**/*', (route) => route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(
      'http://127.0.0.1:' + server.address().port + '/?voiceTransport=local',
    );
    await page.waitForFunction(() => window.TitlePages);
    await page.evaluate(
      (id) =>
        TitlePages.open({
          kind: 'artist',
          catalogId: 'ytmusic:artist:' + id,
          title: 'Fixture Artist',
        }),
      fixture.artistId,
    );
    await page.waitForFunction(
      () =>
        document.querySelector('.artist-discography .title-notice')
          ?.textContent === '3 lançamentos',
    );
    const section = page.locator('.artist-discography');
    await section.locator('.discography-sort').selectOption('old');
    await section.locator('.discography-filter button[data-value=all]').focus();
    await page.evaluate(() => {
      const section = document.querySelector('.artist-discography');
      section.scrollIntoView();
      window.originalDiscography = section;
      window.originalCards = [...section.querySelectorAll('.discover-card')];
      window.originalFocus = document.activeElement;
      window.originalScroll = scrollY;
    });
    release();
    await page.waitForFunction(
      () =>
        document.querySelector('.artist-discography .title-notice')
          ?.textContent === '7 lançamentos',
    );
    assert.equal(
      await page.evaluate(
        () =>
          originalDiscography ===
            document.querySelector('.artist-discography') &&
          originalCards.every((card) => card.isConnected) &&
          originalFocus === document.activeElement &&
          originalScroll === scrollY,
      ),
      true,
    );
    assert.equal(
      await section.locator('.discography-sort').inputValue(),
      'old',
    );
    assert.equal(await section.locator('.discover-card').count(), 7);
    assert.equal(
      calls.filter((body) => body.browseId?.startsWith('MPRE')).length,
      0,
    );
    assert.equal(
      calls.length,
      5,
      'one artist CORE and four bounded section pages, no N+1',
    );
    for (const [filter, count] of [
      ['album', 4],
      ['ep', 1],
      ['single', 1],
      ['all', 7],
    ]) {
      await section
        .locator('.discography-filter button[data-value=' + filter + ']')
        .click();
      assert.equal(await section.locator('.discover-card').count(), count);
    }
    for (const [sort, first] of [
      ['title', 'Continuation album'],
      ['recent', 'Fixture EP'],
      ['old', 'Unknown type'],
    ]) {
      await section.locator('.discography-sort').selectOption(sort);
      assert.equal(
        await section.locator('.discover-card strong').first().textContent(),
        first,
      );
    }
    // Subsequent pointer interactions retain the existing intent-prefetch policy.
    assert.equal(
      calls.filter((body) => !body.browseId?.startsWith('MPRE')).length,
      5,
    );
    assert.deepEqual(errors, []);
    fs.mkdirSync('artifacts/artist-sections', { recursive: true });
    await page.screenshot({
      path: 'artifacts/artist-sections/discography.png',
    });
    console.log(
      'PASS: real CORE/FULL HTTP 3→7, same section/cards/focus/scroll/sort, complete filters and sorting, no per-release browse.',
    );
  } finally {
    release();
    await browser?.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
