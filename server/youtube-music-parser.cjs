// Small guest-catalog parser. Renderer details never leave this module.
const MusicModel = require('../dist/music-model.js');
const VIDEO = /^[\w-]{11}$/;
const validBrowse = (kind, id) => typeof id === 'string' && (kind === 'album' ? /^MPRE[\w-]{4,120}$/ : /^UC[\w-]{8,80}$/).test(id);
const text = value => String(value?.simpleText || value?.runs?.map(run => run.text || '').join('') || '').trim();
function collect(root, name) {
  const results = []; let visited = 0;
  function visit(value, depth) {
    if (!value || typeof value !== 'object' || depth > 32 || ++visited > 20000) return;
    if (value[name]) results.push(value[name]);
    for (const child of Object.values(value)) visit(child, depth + 1);
  }
  visit(root, 0); return results;
}
function image(value, resize = true) {
  const thumbnails = collect(value, 'thumbnails').flat().filter(row => /^https:\/\/(?:[\w-]+\.)*(?:ytimg\.com|googleusercontent\.com|ggpht\.com)\//.test(row.url || ''));
  const selected = thumbnails.sort((a,b) => (b.width || 0) - (a.width || 0))[0]?.url || '';
  // Music artwork uses Google's resizable image CDN. Search often supplies
  // only w120-h120; request the same asset at cover size, never a video still.
  if (resize && /^https:\/\/(?:[\w-]+\.)*(?:googleusercontent\.com|ggpht\.com)\//.test(selected))
    return selected.replace(/^https:\/\/yt3\.googleusercontent\.com\//,'https://lh3.googleusercontent.com/').replace(/=w(\d+)-h(\d+)(?=-|$)/, (_,w,h) => '=w'+Math.max(800,Number(w))+'-h'+Math.max(800,Number(h)));
  return selected;
}
function duration(value) {
  if (!/^\d+(?::[0-5]\d){1,2}$/.test(value || '')) return undefined;
  const result = value.split(':').reduce((sum, n) => sum * 60 + Number(n), 0);
  return result > 0 && result <= 86400 ? result : undefined;
}
function endpointKind(endpoint) {
  const type = endpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType;
  return type === 'MUSIC_PAGE_TYPE_ALBUM' ? 'album' : type === 'MUSIC_PAGE_TYPE_ARTIST' ? 'artist' : '';
}
function credits(runs) {
  const names = [], result = {};
  for (const run of runs || []) {
    const endpoint = run.navigationEndpoint?.browseEndpoint, kind = endpointKind(endpoint);
    if (kind === 'artist' && validBrowse(kind, endpoint.browseId)) {
      names.push(run.text); result.artistCatalogId ||= 'ytmusic:artist:' + endpoint.browseId;
    } else if (kind === 'album' && validBrowse(kind, endpoint.browseId)) {
      result.albumTitle = run.text; result.albumCatalogId = 'ytmusic:album:' + endpoint.browseId;
    }
  }
  if (names.length) result.artist = [...new Set(names)].join(' · ');
  return result;
}
function song(row, fallback = {}) {
  // An album can carry a play-video overlay; classify browse entities first.
  if (row.navigationEndpoint?.browseEndpoint) return null;
  if (row.musicItemRendererDisplayPolicy === 'MUSIC_ITEM_RENDERER_DISPLAY_POLICY_GREY_OUT') return null;
  const watch = row.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint || row.navigationEndpoint?.watchEndpoint;
  const videoId = watch?.videoId || row.playlistItemData?.videoId;
  const type = watch?.watchEndpointMusicSupportedConfigs?.watchEndpointMusicConfig?.musicVideoType;
  if (!VIDEO.test(videoId || '') || type !== 'MUSIC_VIDEO_TYPE_ATV' && !(fallback.albumCatalogId && (!type || type === 'MUSIC_VIDEO_TYPE_OMV'))) return null;
  const columns = row.flexColumns || [], column = i => columns[i]?.musicResponsiveListItemFlexColumnRenderer?.text;
  const title = text(column(0));
  const runs = columns.slice(1).flatMap(c => c.musicResponsiveListItemFlexColumnRenderer?.text?.runs || []);
  const metadata = {...fallback, ...credits(runs)};
  if (!title || !metadata.artist) return null;
  const clock = [...runs, ...(row.fixedColumns || []).flatMap(c => c.musicResponsiveListItemFixedColumnRenderer?.text?.runs || [])].map(r => duration(r.text)).find(n => n != null);
  return {kind:'music', catalogId:'ytmusic:video:' + videoId, videoId, source:'YouTube Music', title,
    artist:metadata.artist, albumTitle:metadata.albumTitle || '', artistCatalogId:metadata.artistCatalogId || '', albumCatalogId:metadata.albumCatalogId || '',
    image:image(row.thumbnail) || fallback.image || '', imageFallback:image(row.thumbnail,false) || fallback.imageFallback || '', ...(clock != null ? {trackDuration:clock} : {}),
    url:'https://music.youtube.com/watch?v=' + videoId, description:[metadata.artist,metadata.albumTitle].filter(Boolean).join(' · '),
    playbackSource:MusicModel.source({type:'youtube',videoId,url:'https://www.youtube.com/watch?v=' + videoId}), metadataSources:{youtubeMusicId:videoId}};
}
function browseRow(row, fallback = {}) {
  const endpoint = row.navigationEndpoint?.browseEndpoint, kind = endpointKind(endpoint), id = endpoint?.browseId;
  if (!kind || !validBrowse(kind,id)) return null;
  const title = text(row.title || row.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text);
  const subtitle = row.subtitle || row.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text;
  if (!title) return null;
  const credit = {...fallback,...credits(subtitle?.runs)};
  const words = text(subtitle), year = words.match(/(?:^|\D)((?:19|20)\d{2})(?:\D|$)/)?.[1];
  return {kind,catalogId:'ytmusic:' + kind + ':' + id,browseId:id,source:'YouTube Music',title,
    artist:kind === 'artist' ? title : credit.artist || '', artistCatalogId:credit.artistCatalogId || '', image:image(row.thumbnailRenderer || row.thumbnail),imageFallback:image(row.thumbnailRenderer || row.thumbnail,false),
    description:words, url:'https://music.youtube.com/browse/' + id,...(year ? {releaseDate:year} : {}),
    ...(kind === 'album' ? {albumType:/\bsingle\b/i.test(words)?'single':/\bEP\b/.test(words)?'ep':'album'} : {})};
}
function unique(rows, limit = 40) {
  const seen = new Set(); return rows.filter(row => row && !seen.has(row.catalogId) && seen.add(row.catalogId)).slice(0,limit);
}
function parseSearch(kind, payload) {
  const rows = collect(payload,'musicResponsiveListItemRenderer').map(row => kind === 'music' ? song(row) : browseRow(row));
  if (kind !== 'music') rows.push(...collect(payload,'musicTwoRowItemRenderer').map(row => browseRow(row)));
  return unique(rows.filter(row => row?.kind === kind));
}
function parseBrowse(kind, id, payload) {
  if (!validBrowse(kind,id)) throw Error('Invalid YouTube Music browse identity');
  const header = ['musicResponsiveHeaderRenderer','musicDetailHeaderRenderer','musicImmersiveHeaderRenderer','musicVisualHeaderRenderer']
    .flatMap(name => collect(payload,name))[0];
  const title = text(header?.title);
  if (!title) throw Error('YouTube Music details unavailable');
  const headerRuns = [...(header.subtitle?.runs || []),...(header.straplineTextOne?.runs || [])];
  const metadata = credits(headerRuns), artwork = image(header.thumbnail || header.foregroundThumbnail || header);
  const result = {kind,catalogId:'ytmusic:' + kind + ':' + id,browseId:id,source:'YouTube Music',title,image:artwork,imageFallback:image(header.thumbnail || header.foregroundThumbnail || header,false),
    artist:kind === 'artist' ? title : metadata.artist || '',artistCatalogId:metadata.artistCatalogId || '',url:'https://music.youtube.com/browse/' + id};
  const year = text(header.subtitle).match(/(?:^|\D)((?:19|20)\d{2})(?:\D|$)/)?.[1];
  if (year) result.releaseDate = year;
  const fallback = kind === 'album' ? {artist:result.artist,artistCatalogId:result.artistCatalogId,albumTitle:title,albumCatalogId:result.catalogId,image:artwork} : {artist:title,artistCatalogId:result.catalogId};
  const shelves = [...collect(payload,'musicPlaylistShelfRenderer'),...collect(payload,'musicShelfRenderer')];
  const tracks = unique(shelves.flatMap(shelf => collect(shelf.contents,'musicResponsiveListItemRenderer')).map(row => song(row,fallback)),kind === 'album' ? 200 : 40);
  if (kind === 'album') {result.albumTracks=tracks;result.trackNames=tracks.map(row=>row.title);result.total=tracks.length;result.unit='faixas';}
  else {
    result.topTracks = tracks.slice(0,8);
    result.topAlbums = unique(collect(payload,'musicCarouselShelfRenderer').flatMap(shelf => {
      const label=text(shelf.header?.musicCarouselShelfBasicHeaderRenderer?.title);
      return collect(shelf.contents,'musicTwoRowItemRenderer').map(row => {
        const album=browseRow(row,fallback);
        if(album?.kind==='album' && /singles|eps/i.test(label) && !(/singles/i.test(label)&&/eps/i.test(label))) album.albumType=/eps/i.test(label)?'ep':'single';
        return album;
      });
    })).filter(row => row.kind === 'album');
  }
  return result;
}
module.exports = {parseSearch,parseBrowse,validBrowse,duration};
