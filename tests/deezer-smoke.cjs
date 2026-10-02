const assert = require('node:assert/strict');
const { createDeezerClient } = require('../server/deezer.cjs');
const { createMusicCatalog } = require('../server/music-catalog.cjs');
(async () => {
  let calls = 0;
  const artist = { id: 415, name: 'Nirvana', picture_big: 'https://example.com/artist.jpg' };
  const deezer = createDeezerClient({ fetcher: async url => {
    calls++; const path = new URL(url).pathname;
    const data = path.startsWith('/search/') ? { data: [{ id: 998, name: 'NIRVÁNA', nb_fan: 1 }, { ...artist, nb_fan: 100000 }, artist, { id: 999, name: 'Other Nirvana', picture_big: 'https://example.com/other.jpg' }] }
      : path.endsWith('/top') ? { data: [{ id: 12, title: 'Song', artist, album: { cover_big: 'https://example.com/album.jpg' } }] }
      : path.endsWith('/albums') ? { data: [{ id: 13, title: 'Album', cover_big: 'https://example.com/album.jpg' }] } : artist;
    return { ok: true, json: async () => data };
  } });
  const search = await deezer.search('artist', 'nirvana'); assert.equal(search.items.length, 3); assert.equal(search.items[0].catalogId, 'deezer:415');
  const before = calls; await deezer.search('artist', 'nirvana'); assert.equal(calls, before);
  const catalog = createMusicCatalog({ deezer, artistArtwork: { lookup: async () => '' }, lastfm: { details: async () => ({ summary: 'Biography', similarArtists: [], listeners: '100' }) } });
  const info = await catalog.deezerDetails('artist', '415');
  assert.equal(info.summary, 'Biography'); assert.equal(info.image, artist.picture_big); assert.equal(info.topTracks[0].artistCatalogId, 'deezer:415'); assert.equal(info.topAlbums.length, 1);
  assert.equal((await catalog.search('artist', 'nirvana')).items[0].source, 'Deezer');
  await assert.rejects(deezer.details('artist', '415;'), error => error.status === 400);
  const enriched = createMusicCatalog({ deezer: { searchCatalog: async kind => ({ items: [{ kind, title: 'Song', artist: 'Artist', image: '' }] }) }, itunes: { search: async () => { throw Error('No Apple fallback'); } } });
  assert.equal((await enriched.search('music', 'Song')).items[0].image, '');
  const namesakes = createDeezerClient({ fetcher: async () => ({ ok: true, json: async () => ({ data: [{ id: 792, name: 'BoA', nb_fan: 47000 }, { id: 74211202, name: 'bôa', nb_fan: 23000 }, { id: 5298187, name: 'BOA', nb_fan: 149 }, { id: 74211202, name: 'bôa', nb_fan: 23000 }] }) }) });
  assert.equal((await namesakes.search('artist', 'boa')).items.length, 3, 'Namesakes with distinct IDs survive; repeated IDs do not');
  assert.equal((await namesakes.search('artist', 'bôa')).items[0].catalogId, 'deezer:74211202');
  let albumFailure = true;
  const partial = createDeezerClient({ fetcher: async url => { const path = new URL(url).pathname; return path.endsWith('/albums') ? { ok: !albumFailure, json: async () => ({data:[{id:200,title:'Recovered album',cover_big:'https://example.com/album.jpg'}]}) } : {ok:true,json:async()=>path.endsWith('/top')?{data:[]}:artist}; } });
  assert.equal((await partial.details('artist','415')).discographyUnavailable,true);
  albumFailure = false;
  assert.equal((await partial.details('artist','415')).discographyUnavailable,false);
  const versions = createDeezerClient({fetcher:async url => ({ok:true,json:async()=>new URL(url).pathname.startsWith('/search/') ? {data:[{id:1,title:'Song',artist:{id:2,name:'Artist'},album:{id:10,title:'Original'}},{id:3,title:'Song',artist:{id:2,name:'Artist'},album:{id:11,title:'Compilation'}},{id:4,title:'Song',title_version:'Live',artist:{id:2,name:'Artist'},album:{id:12,title:'Concert'},explicit_lyrics:true}]} : {id:Number(new URL(url).pathname.split('/').pop()),release_date:'2001-01-01'}})});
  const editions=await versions.search('music','Song');assert.equal(editions.items.length,3,'Different albums and live versions survive');assert.ok(editions.items.every(row=>row.releaseDate==='2001-01-01'));assert.equal(editions.items.find(row=>row.catalogId==='deezer:4').title,'Song Live');assert.equal(editions.items.find(row=>row.catalogId==='deezer:4').explicit,true);
  console.log('Deezer: stable IDs, deduplication, cache, artist catalog and Last.fm biography enrichment OK.');
})().catch(error => { console.error(error); process.exitCode = 1; });

