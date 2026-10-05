const {createIsrcEditionResolver} = require('./isrc-edition.cjs');
const { createMusicClient } = require("./music.cjs");
const { createArtistArtworkClient } = require("./artist-artwork.cjs");
const { createLastfmClient } = require("./lastfm.cjs");
const { createMusicBrainzClient } = require("./musicbrainz.cjs");
const { createYouTubeMusicClient } = require('./youtube-music.cjs');
const { matchPlayback } = require('./music-playback-matcher.cjs');
const MusicModel = require('../dist/music-model.js');
const nameKey = (value) =>
  String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

function matchesRecommendationNames(row, suggestion) {
  return (
    nameKey(row.title) === nameKey(suggestion.title) &&
    (suggestion.kind === "artist" || nameKey(row.artist) === nameKey(suggestion.artist))
  );
}
function createMusicCatalog({
  itunes = createMusicClient(),
  artistArtwork = createArtistArtworkClient(),
  lastfm = createLastfmClient(),
  musicbrainz = createMusicBrainzClient(),
  isrcEdition = createIsrcEditionResolver(),
  youtubeMusic = createYouTubeMusicClient(),
} = {}) {
  const recommendationStates = new Map(),
    recommendationPending = new Map();
  async function enrich(row, { verify = false } = {}) {
    if (row.kind !== "artist") return row;
    if (row.catalogId?.startsWith('ytmusic:') && row.image) return row;
    let tracks = row.topTracks || [];
    if (verify && !tracks.length && /^itunes:[1-9]\d*$/.test(row.catalogId || '') && itunes.artistTracks)
      tracks = await itunes.artistTracks(row.catalogId.split(":")[1]).catch(() => []);
    if (verify && !tracks.length) return { ...row, image: "", artworkSource: "" };
    let image = await artistArtwork.lookup(row.title, { tracks, verify }).catch(() => "");
    if (!image && !tracks.length && /^itunes:[1-9]\d*$/.test(row.catalogId || "") && itunes.artistTracks) {
      tracks = await itunes.artistTracks(row.catalogId.split(":")[1]).catch(() => []);
      if (tracks.length) image = await artistArtwork.lookup(row.title, { tracks }).catch(() => "");
    }
    return { ...row, image, artworkSource: image ? "Deezer" : "" };
  }
  return {
    tag: async (tag, section='info', page=1) => {
      const result=await lastfm.tag(tag,section,page);
      if(!['music','album','artist'].includes(section))return result;
      const items=[],outcomes=[];let index=0;
      await Promise.all(Array.from({length:2},async()=>{while(index<result.items.length){const position=index++,suggestion=result.items[position];try{
        const found=await youtubeMusic.search(section,section==='artist'?suggestion.title:suggestion.title+' '+suggestion.artist);
        const unique=new Map(found.items.filter(row=>MusicModel.validCatalogId(section,row.catalogId)&&matchesRecommendationNames(row,suggestion)).map(row=>[row.catalogId,row]));
        if(unique.size===1)items[position]=[...unique.values()][0];else outcomes.push('unmatched');
      }catch{outcomes.push('failed');}}}));
      return {...result,items:[...new Map(items.filter(Boolean).map(row=>[row.catalogId,row])).values()],partial:outcomes.length>0};
    },
    summary: async (kind, artist, title) => lastfm.summary(kind, artist, title),
    artistPhoto: async (name, catalogId = "") => ({
      image: (await enrich({ kind: "artist", title: name, catalogId })).image,
    }),
    search: async (kind, query, provider = "auto") => {
      if (!["auto", "itunes", "ytmusic"].includes(provider) || !['music','album','artist'].includes(kind) || typeof query !== 'string' || query.trim().length < 2 || query.length > 200) {
        const e = Error("Busca musical inválida.");
        e.status = 400;
        throw e;
      }
      const result = provider==='itunes' ? await itunes.search(kind,query) : await youtubeMusic.search(kind,query);
      if (kind !== "artist") return result;
      const items = result.items.slice();
      let next = 0;
      const names = new Map();
      const artistNameKey = (value) =>
        String(value || "")
          .normalize("NFC")
          .trim()
          .toLowerCase();
      for (const row of items) {
        const key = artistNameKey(row.title);
        names.set(key, (names.get(key) || 0) + 1);
      }
      await Promise.all(
        Array.from({ length: Math.min(3, items.length) }, async () => {
          while (next < items.length) {
            const index = next++,
              row = items[index],
              ambiguous = names.get(artistNameKey(row.title)) > 1;
            items[index] = await enrich(row, { verify: ambiguous });
            if (ambiguous)
              items[index].description = [
                ...(row.genres || []),
                "Artistas homônimos · " + (row.catalogId.startsWith('ytmusic:') ? 'YouTube Music ' + row.catalogId.split(':')[2] : 'Apple ' + row.catalogId.split(':')[1]),
              ].join(" · ");
          }
        }),
      );
      return { ...result, items };
    },
    details: async (kind, id, hint = {}) => {
      let row;
      if(String(id).startsWith('ytmusic:')){
        const match=String(id).match(/^ytmusic:(video|album|artist):([\w-]+)$/);
        if(!match || (kind==='music'?'video':kind)!==match[1]){const error=Error('Identidade musical inválida.');error.status=400;throw error;}
        // Browse IDs are never sent to Apple: retain the requested identity on failure.
        row=await enrich(await youtubeMusic.details(kind,match[2],hint));
        if(kind==='music'&&!row.releaseDate&&/^ytmusic:album:MPRE[\w-]{4,120}$/.test(row.albumCatalogId||'')){
          const album=await youtubeMusic.details('album',row.albumCatalogId.split(':')[2]).catch(()=>null);
          if(album?.releaseDate)row={...row,releaseDate:album.releaseDate};
        }
      }else row = await enrich(await itunes.details(kind, id));
      if (kind === 'music' && !row.isrc) {
        let identifier = await musicbrainz.recordingIsrc?.(row).catch(() => null);
        if(identifier?.isrc){
          // A recording code can identify another release edition. Preserve it
          // unless public metadata verifies a unique compatible catalog edition.
          const exact=await isrcEdition(row,[identifier.isrc]).catch(()=>null);
          if(!exact){const edition=await isrcEdition(row,undefined,[],{localizedAlbumFallback:true}).catch(()=>null);if(edition)identifier={isrc:edition,source:'lrc.red'};}
        }
        if (identifier?.candidates || identifier?.artistAliases) {
          const code = await isrcEdition(row, identifier.candidates, identifier.artistAliases).catch(() => null);
          identifier = code ? {isrc:code, source:'lrc.red'} : null;
        }
        if (!identifier) {
          let code = await isrcEdition(row, undefined, [], {localizedAlbumFallback:true}).catch(() => null);
          if (!code && musicbrainz.artistAliases) {
            const aliases = await musicbrainz.artistAliases(row.artist).catch(() => []);
            if (aliases.length) code = await isrcEdition(row, undefined, aliases, {localizedAlbumFallback:true}).catch(() => null);
          }
          if (code) identifier = {isrc:code, source:'lrc.red'};
        }
        row = {...row, isrcLookupVersion:11, ...(identifier ? {isrc:identifier.isrc, isrcSource:identifier.source || 'MusicBrainz', isrcRecordingId:identifier.recordingId} : {})};
      }
      const editorial = await lastfm
        .summary(kind, kind === "artist" ? row.title : row.artist, row.title)
        .catch(() => ({ unavailable: true }));
      if(!row.genres?.length&&editorial.genres?.length)row={...row,genres:editorial.genres,genresSource:'Last.fm'};
      return editorial.summary
        ? { ...row, summary: editorial.summary, summarySource: "Last.fm", summaryStatus: "available" }
        : { ...row, summaryStatus: editorial.unavailable ? "unavailable" : "missing" };
    },
    playbackSource: async (title, artist, {album='',duration} = {}) => {
      if(typeof title!=='string'||typeof artist!=='string'||!title.trim()||!artist.trim()||title.length>200||artist.length>200||typeof album!=='string'||album.length>300||duration!=null&&(!Number.isFinite(duration)||duration<=0||duration>86400)){
        const error=Error('Informe título, artista e metadata de reprodução válidos.');error.status=400;throw error;
      }
      try {
        const result=matchPlayback({title,artist,albumTitle:album,trackDuration:duration},await youtubeMusic.searchTracks({title,artist,albumTitle:album,trackDuration:duration}));
        if(result.status!=='not-found')return result;
      } catch { /* Public search can change or be unavailable; keep the existing fallback. */ }
      try {
        const fallback=await musicbrainz.playbackSource(title,artist);
        const source=fallback.source ? require('../dist/music-model.js').source(fallback.source) : null;
        const automatic=source?.type==='youtube'&&fallback.status==='matched';
        return {status:automatic?'matched':fallback.items?.length?'choose':'not-found',source:automatic?source:null,items:fallback.items||[],provider:'MusicBrainz'};
      }
      catch { return {status:'not-found',provider:'MusicBrainz',source:null,items:[],unavailable:true}; }
    },
    recommendations: async function recommendations(kind, artist, title, { reserve = false, videoId = '', albumId = '', artistId = '' } = {}) {
      if(kind==='artist'&&artistId){
        const detail=await youtubeMusic.details('artist',artistId);
        return {items:(detail.relatedArtists||[]).map(row=>({...row,recommendationSource:'YouTube Music'})),reserveAvailable:false,basis:'Artistas relacionados no YouTube Music'};
      }
      if(kind==='album'&&albumId){
        const album=await youtubeMusic.details('album',albumId);
        const seed=album.albumTracks?.find(track=>track.playbackSource?.videoId)?.playbackSource.videoId;
        const result=seed ? await youtubeMusic.radio(seed) : {items:[]};
        const seen=new Set(['ytmusic:album:'+albumId]);
        const items=result.items.filter(track=>/^ytmusic:album:MPRE[\w-]{4,120}$/.test(track.albumCatalogId||'')&&track.albumTitle&&!seen.has(track.albumCatalogId)&&seen.add(track.albumCatalogId)).map(track=>({kind:'album',catalogId:track.albumCatalogId,title:track.albumTitle,artist:track.artist,artistCatalogId:track.artistCatalogId,image:track.image,imageFallback:track.imageFallback,source:'YouTube Music',recommendationSource:'YouTube Music',url:'https://music.youtube.com/browse/'+track.albumCatalogId.split(':')[2]}));
        return {items,reserveAvailable:false,basis:'Álbuns do rádio no YouTube Music'};
      }
      if(kind==='music'&&videoId){
        const result=await youtubeMusic.radio(videoId);
        return {...result,items:result.items.map(row=>({...row,recommendationSource:'YouTube Music'}))};
      }
      const key = JSON.stringify([kind, artist, title]);
      if (recommendationPending.has(key)) {
        const previous = await recommendationPending.get(key);
        return reserve && previous.reserveAvailable
          ? recommendations(kind, artist, title, { reserve })
          : previous;
      }
      const task = (async () => {
        let state = recommendationStates.get(key);
        if (!state || state.expires < Date.now()) {
          const result = await lastfm.recommendations(kind, artist, title);
          state = {
            result,
            rows: result.items.slice(0, 48),
            items: [],
            outcomes: [],
            expires: Date.now() + 300000,
            limit: 0,
          };
          if (recommendationStates.size >= 40)
            recommendationStates.delete(recommendationStates.keys().next().value);
          recommendationStates.set(key, state);
        }
        const { result, rows, items, outcomes } = state,
          lookups = new Map();
        let next = 0;
        state.limit = Math.min(rows.length, state.limit ? state.limit + (reserve ? 6 : 0) : 6);
        const limit = state.limit;
        await Promise.all(
          Array.from({ length: Math.min(2, limit) }, async () => {
            while (next < limit) {
              const index = next++,
                suggestion = rows[index];
              if (outcomes[index] && outcomes[index].status !== "failed") {
                if (items[index]?.kind === "artist" && !items[index].image)
                  items[index] = await enrich(items[index]);
                continue;
              }
              try {
                const query=suggestion.kind==='artist'?suggestion.title:suggestion.title+' '+suggestion.artist;
                const lookupKey=suggestion.kind+':'+query;
                if(!lookups.has(lookupKey))lookups.set(lookupKey,youtubeMusic.search(suggestion.kind,query));
                const found=await lookups.get(lookupKey);
                const matches=found.items.filter(row=>row.kind===suggestion.kind&&matchesRecommendationNames(row,suggestion));
                const match=matches.length===1?matches[0]:null;
                if (
                  match &&
                  /^ytmusic:(?:video|album|artist):[\w-]+$/.test(match.catalogId) &&
                  match.kind === suggestion.kind &&
                  matchesRecommendationNames(match, suggestion)
                )
                  items[index] = { ...(await enrich(match)), recommendationSource: "Last.fm" };
                outcomes[index] = { status: items[index] ? "resolved" : "unmatched" };
              } catch (error) {
                outcomes[index] = { status: "failed", ...(error.providerFailure || { type: "unknown" }) };
              }
            }
          }),
        );
        const failed = outcomes.filter((o) => o.status === "failed"),
          failures = failed.length,
          unmatched = outcomes.filter((o) => o.status === "unmatched").length;
        if (limit && failures === limit) {
          const error = Error(
            "Não foi possível consultar o YouTube Music para identificar as recomendações. Tente novamente.",
          );
          error.status = 503;
          error.resolution = {
            status: "unavailable",
            failures,
            total: limit,
            causes: failed.map(({ status, ...cause }) => cause),
          };
          throw error;
        }
        const seen = new Set(),
          resolution = {
            failures,
            unmatched,
            total: limit,
            status: failures ? "partial" : unmatched === limit && limit ? "unmatched" : "complete",
          };
        if (failures) resolution.causes = failed.map(({ status, ...cause }) => cause);
        return {
          ...result,
          items: items.filter((row) => row && !seen.has(row.catalogId) && seen.add(row.catalogId)),
          resolution,
          reserveAvailable: limit < rows.length,
        };
      })().finally(() => recommendationPending.delete(key));
      recommendationPending.set(key, task);
      return task;
    },
  };
}
module.exports = { createMusicCatalog };
