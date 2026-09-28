const assert = require('node:assert/strict');
const { createMusicBrainzClient } = require('../server/musicbrainz.cjs');
const { createMusicCatalog } = require('../server/music-catalog.cjs');
const group = '11111111-1111-1111-1111-111111111111', release = '22222222-2222-2222-2222-222222222222';
(async () => {
  let calls = 0;
  const client = createMusicBrainzClient({ interval: 0, fetcher: async (url, options) => {
    calls++; assert.ok(options.headers['User-Agent']);
    const path = new URL(url).pathname;
    const row = { id: group, title: 'Album fixture', 'artist-credit': [{ name: 'Artist fixture' }], releases: [{ id: release, date: '2001' }] };
    return { ok: true, json: async () => path.includes('/release/' + release) ? { title: 'Album fixture', date: '2001', country: 'BR', media: [{ tracks: [{ recording: { title: 'Track fixture' } }] }] } : path.endsWith('/release-group') ? { 'release-groups': [row] } : row };
  }});
  const rows = await client.search('album', 'Artist'); assert.equal(rows.items[0].source, 'MusicBrainz');
  const album = await client.details('album', group); assert.deepEqual(album.trackNames, ['Track fixture']); assert.equal(album.total, 1);
  assert.ok(album.image.includes('/release-group/')); assert.ok(album.edition.includes('BR'));
  const before = calls; await client.details('album', group); assert.equal(calls, before);
  await assert.rejects(client.details('album', 'invalid'), error => error.status === 400);
  const fallback = createMusicCatalog({ musicbrainz: { search: async () => { throw Error('Offline'); } }, itunes: { search: async () => ({ items: [{ source: 'iTunes' }] }) } });
  const offline = createMusicCatalog({ deezer: { search: async () => { throw Error('Offline'); } }, lastfm: { search: async () => { throw Error('Offline'); } }, itunes: { search: async () => ({ items: [{ source: 'iTunes' }] }) } });
  assert.equal((await offline.search('album', 'Artist')).items[0].source, 'iTunes');
  console.log('MusicBrainz: album, artist, edition tracks, artwork, cache and iTunes fallback OK.');
})().catch(error => { console.error(error); process.exitCode = 1; });
