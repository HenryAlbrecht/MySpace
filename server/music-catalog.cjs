const { createMusicClient } = require('./music.cjs');
const { createLastfmClient } = require('./lastfm.cjs');
const { createMusicBrainzClient } = require('./musicbrainz.cjs');
const { createArtistArtworkClient } = require('./artist-artwork.cjs');
const { createDeezerClient } = require('./deezer.cjs');
function createMusicCatalog({ deezer = createDeezerClient(), itunes = createMusicClient(), musicbrainz = createMusicBrainzClient(), lastfm = createLastfmClient(), artistArtwork = createArtistArtworkClient() } = {}) {
  const clean = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  async function findItunesMatch(row) {
    const candidates = await itunes.search(row.kind, row.artist + ' ' + row.title);
    return candidates.items.find(candidate => clean(candidate.artist) === clean(row.artist) && clean(candidate.title) === clean(row.title));
  }
  async function recommendationArtwork(row) {
    if (row.image) return row;
    if (row.kind === 'artist') {
      return { ...row, image: await artistArtwork.lookup(row.title).catch(() => ''), artworkSource: 'Last.fm / Deezer' };
    }
    try {
      const candidates = await deezer.search(row.kind, row.artist + ' ' + row.title);
      const match = candidates.items.find(candidate => clean(candidate.artist) === clean(row.artist) && clean(candidate.title) === clean(row.title));
      if (match?.image) return { ...row, image: match.image, artworkSource: 'Deezer' };
    } catch { /* Match both artist and title before borrowing an album cover. */ }
    try {
      const match = await findItunesMatch(row);
      if (match?.image) return { ...row, image: match.image, artworkSource: 'iTunes' };
    } catch { /* Artwork is optional; retain the recommendation if iTunes fails. */ }
    try {
      const detail = await lastfm.details(row.kind, row.artist, row.title);
      if (detail.image) return { ...row, image: detail.image, artworkSource: 'Last.fm' };
    } catch { /* A missing cover must not discard a recommendation. */ }
    return row;
  }
  async function artworkItems(rows) {
    const items = rows.map(row => ({ ...row })); let next = 0;
    await Promise.all(Array.from({ length: Math.min(3, items.length) }, async () => {
      while (next < items.length) { const index = next++; items[index] = await recommendationArtwork(items[index]); }
    }));
    return items;
  }
  return {
    ...itunes,
    artistAlbums: (id, offset) => deezer.albums(id, offset),
    search: async (kind, query, provider = 'auto') => {
      if (provider === 'auto' || provider === 'deezer') {
        try { const result = await deezer.search(kind, query); if (result.items.length || provider === 'deezer') return { ...result, items: await artworkItems(result.items) }; }
        catch (error) { if (error.status === 400 || provider === 'deezer') throw error; }
      }
      if (kind === 'artist') { const result = await lastfm.search(kind, query); return { ...result, items: await artworkItems(result.items) }; }
      if (provider === 'itunes') return itunes.search(kind, query);
      try {
        const result = await (provider === 'musicbrainz' ? musicbrainz : lastfm).search(kind, query);
        if (result.items.length || ['musicbrainz','lastfm'].includes(provider)) return { ...result, items: provider === 'musicbrainz' ? result.items : await artworkItems(result.items) };
      } catch (error) { if (error.status === 400 || ['musicbrainz','lastfm'].includes(provider)) throw error; }
      return itunes.search(kind, query);
    },
    deezerDetails: async (kind, id) => {
      const row = await deezer.details(kind, id);
      if (!row.image) Object.assign(row, await recommendationArtwork(row));
      if (kind === 'artist') {
        row.topTracks = await artworkItems(row.topTracks || []);
        row.topAlbums = await artworkItems(row.topAlbums || []);
      }
      try {
        const info = await lastfm.details(kind, row.artist, kind === 'artist' ? '' : row.title);
        row.summary = info.summary || ''; row.summarySource = row.summary ? 'Last.fm' : '';
        row.genres = row.genres?.length ? row.genres : info.genres;
        row.listeners = info.listeners; row.playcount = info.playcount;
        if (kind === 'artist') row.similarArtists = await artworkItems(info.similarArtists || []);
      } catch { /* Deezer stays usable when Last.fm is unavailable. */ }
      return row;
    },
    lastfmDetails: async (kind, artist, title) => {
      const row = await lastfm.details(kind, artist, title);
      if (kind === 'artist') {
        row.image = row.image || await artistArtwork.lookup(row.title);
        row.similarArtists = await artworkItems(row.similarArtists || []);
        for (const field of ['topTracks', 'topAlbums']) {
          const items = row[field] || []; let next = 0;
          await Promise.all(Array.from({ length: Math.min(3, items.length) }, async () => {
            while (next < items.length) { const index = next++; items[index] = await recommendationArtwork(items[index]); }
          }));
        }
        return row;
      }
      try {
        const match = await findItunesMatch(row);
        if (match) {
          row.image = row.image || match.image; row.previewUrl = match.previewUrl || ''; row.previewSource = row.previewUrl ? 'iTunes' : '';
          row.releaseDate = match.releaseDate || ''; row.itunesUrl = match.url || '';
          if (kind === 'album' && !row.trackNames?.length) { const detail = await itunes.details(kind, match.catalogId.split(':')[1]); row.trackNames = detail.trackNames || []; row.total = row.trackNames.length; }
        }
      } catch { /* Last.fm remains usable without iTunes enrichment. */ }
      return row;
    },
    recommendations: async (kind, artist, title) => {
      const result = await lastfm.recommendations(kind, artist, title);
      const items = result.items.map(row => ({ ...row }));
      let next = 0;
      // Limit concurrent artwork lookups and preserve the Last.fm ranking.
      await Promise.all(Array.from({ length: Math.min(3, items.length) }, async () => {
        while (next < items.length) {
          const index = next++;
          items[index] = await recommendationArtwork(items[index]);
        }
      }));
      return { ...result, items };
    },
    musicBrainzDetails: (kind, id) => musicbrainz.details(kind, id),
  };
}
module.exports = { createMusicCatalog };
