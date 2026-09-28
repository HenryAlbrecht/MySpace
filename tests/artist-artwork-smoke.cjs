const assert = require('node:assert/strict');
const { createArtistArtworkClient } = require('../server/artist-artwork.cjs');
(async () => {
  let calls = 0;
  const client = createArtistArtworkClient({ fetcher: async url => {
    calls++; assert.equal(new URL(url).hostname, 'www.last.fm');
    return { ok: true, text: async () => '<meta content="https://lastfm-img.freetls.fastly.net/i/u/photo.jpg" property="og:image">' };
  } });
  const results = await Promise.all([client.lookup('Green Day'), client.lookup('Green Day')]);
  assert.equal(results[0], 'https://lastfm-img.freetls.fastly.net/i/u/photo.jpg'); assert.equal(calls, 1);
  await client.lookup('Green Day'); assert.equal(calls, 1);
  const malicious = createArtistArtworkClient({ fetcher: async () => ({ ok: true, text: async () => '<meta property="og:image" content="https://other.example/photo.jpg">' }) });
  assert.equal(await malicious.lookup('Artist'), '');
  const offline = createArtistArtworkClient({ fetcher: async () => { throw Error('Offline'); } });
  assert.equal(await offline.lookup('Artist'), '');
  const fallback = createArtistArtworkClient({ fetcher: async url => url.includes('api.deezer.com')
    ? { ok: true, json: async () => ({ data: [{ name: 'DJ Radiohead', picture_big: 'https://cdn-images.dzcdn.net/wrong.jpg' }, { name: 'Radiohead', picture_big: 'https://cdn-images.dzcdn.net/correct.jpg' }] }) }
    : { ok: true, text: async () => '<meta property="og:image" content="https://lastfm-img.freetls.fastly.net/i/u/ar0/753c0e5b1b3e0c92deaed5f9a7d36552.jpg">' } });
  assert.equal(await fallback.lookup('Radiohead'), 'https://cdn-images.dzcdn.net/correct.jpg');
  const missingPage = createArtistArtworkClient({ fetcher: async url => url.includes('api.deezer.com') ? { ok: true, json: async () => ({ data: [{ name: 'Artist', picture_big: 'https://cdn-images.dzcdn.net/fallback.jpg' }] }) } : { ok: false } });
  assert.equal(await missingPage.lookup('Artist'), 'https://cdn-images.dzcdn.net/fallback.jpg');
  console.log('Artist photos: metadata parsing, host validation, cache, deduplication and unavailable source OK.');
})().catch(error => { console.error(error); process.exitCode = 1; });
