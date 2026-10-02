const { createMusicClient } = require('./music.cjs');
const { createArtistArtworkClient } = require('./artist-artwork.cjs');
const { createLastfmClient } = require('./lastfm.cjs');
const { createMusicBrainzClient } = require('./musicbrainz.cjs');
const nameKey = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
function createMusicCatalog({ itunes = createMusicClient(), artistArtwork = createArtistArtworkClient(), lastfm = createLastfmClient(), musicbrainz = createMusicBrainzClient() } = {}) {
  async function enrich(row) {
    if (row.kind !== 'artist') return row;
    const image = await artistArtwork.lookup(row.title).catch(() => '');
    return { ...row, image, artworkSource: image ? 'Deezer' : '' };
  }
  return {
    summary: async (kind,artist,title) => lastfm.summary(kind,artist,title),
    artistPhoto: async name => ({image:await artistArtwork.lookup(name).catch(()=>'' )}),
    search: async (kind, query, provider = 'auto') => {
      if (!['auto','itunes'].includes(provider)) { const e=Error('O catálogo musical usa Apple/iTunes.');e.status=400;throw e; }
      const result=await itunes.search(kind,query);
      if(kind!=='artist')return result;
      const items=result.items.slice();let next=0;
      await Promise.all(Array.from({length:Math.min(3,items.length)},async()=>{while(next<items.length){const index=next++;items[index]=await enrich(items[index]);}}));
      return {...result,items};
    },
    details: async (kind,id) => {
      const row = await enrich(await itunes.details(kind,id));
      const editorial = await lastfm.summary(kind,kind==='artist'?row.title:row.artist,row.title).catch(()=>({unavailable:true}));
      return editorial.summary ? {...row,summary:editorial.summary,summarySource:'Last.fm',summaryStatus:'available'} : {...row,summaryStatus:editorial.unavailable?'unavailable':'missing'};
    },
    playbackSource: async (title,artist) => {
      const result=await musicbrainz.playbackSource(title,artist);
      // Suggestions are never saved automatically, even for a single exact result.
      return {status:result.items.length?'choose':'not-found',items:result.items,source:null,provider:'MusicBrainz'};
    },
    recommendations: async (kind,artist,title) => {
      const result = await lastfm.recommendations(kind,artist,title);
      const rows=result.items.slice(0,24),items=new Array(rows.length);let next=0;
      await Promise.all(Array.from({length:Math.min(3,rows.length)},async()=>{
        while(next<rows.length){const index=next++,suggestion=rows[index];
          try {
            const found=await itunes.search(suggestion.kind,suggestion.kind==='artist'?suggestion.title:suggestion.title+' '+suggestion.artist);
            const match=found.items.find(row=>nameKey(row.title)===nameKey(suggestion.title) && (suggestion.kind==='artist'||nameKey(row.artist)===nameKey(suggestion.artist)));
            if(match)items[index]={...await enrich(match),recommendationSource:'Last.fm'};
          } catch {}
        }
      }));
      const seen=new Set();return {...result,items:items.filter(row=>row&&!seen.has(row.catalogId)&&seen.add(row.catalogId))};
    }
  };
}
module.exports={createMusicCatalog};
