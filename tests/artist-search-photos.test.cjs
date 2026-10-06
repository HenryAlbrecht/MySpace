const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createMusicCatalog } = require('../server/music-catalog.cjs');

test('artist photos enrich Apple rows without replacing canonical identities', async () => {
  const rows = [1, 2, 3].map(id => ({
    kind: 'artist', title: 'Oasis', catalogId: 'itunes:' + id, source: 'iTunes',
    topTracks: [{ title: 'Wonderwall', artist: 'Oasis' }],
  }));
  const names = [];
  const catalog = createMusicCatalog({youtubeMusic:{search:async()=>({items:[]}),searchTracks:async()=>[]},
    itunes: { search: async () => ({ items: rows }) },
    artistArtwork: { lookup: async name => {
      names.push(name);
      return 'https://cdn.example.test/oasis.jpg';
    } },
    deezer: { searchCatalog: () => { throw Error('secondary catalog forbidden'); } },
  });
  const { items } = await catalog.search('artist', 'Oasis');
  assert.deepEqual(items.map(row => row.catalogId), ['itunes:1', 'itunes:2', 'itunes:3']);
  assert.ok(items.every(row => row.source === 'iTunes' && row.image.endsWith('/oasis.jpg')));
  assert.deepEqual(names, ['Oasis', 'Oasis', 'Oasis']);
});

test('Apple artist failure does not silently switch catalogs', async () => {
  const catalog = createMusicCatalog({youtubeMusic:{search:async()=>({items:[]}),searchTracks:async()=>[]},
    itunes: { search: async () => { throw Error('offline'); } },
    deezer: { searchCatalog: () => { throw Error('wrong provider'); } },
  });
  await assert.rejects(catalog.search('artist', 'Oasis'), /offline/);
});
