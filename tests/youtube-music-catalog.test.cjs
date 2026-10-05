const {test}=require('node:test'),assert=require('node:assert/strict');
const {parseSearch,parseBrowse,parseRadio,duration}=require('../server/youtube-music-parser.cjs');
const {createYouTubeMusicClient,FILTERS}=require('../server/youtube-music.cjs');
const {createMusicCatalog}=require('../server/music-catalog.cjs');
const model=require('../dist/music-model.js');
const fixture=structuredClone(require('./fixtures/youtube-music-search.json'));
const artistId='UCXExK7We8VKsIzFFQYNEgBg',albumId='MPREb_JmBafQLPQZT';
test('radio parser rejects seed, duplicate, invalid and unavailable entries and retains bound playback metadata',()=>{
 const video={videoId:'abcdefghijk',title:{simpleText:'Related song'},longBylineText:{runs:[{text:'Artist',navigationEndpoint:{browseEndpoint:{browseId:artistId,browseEndpointContextSupportedConfigs:{browseEndpointContextMusicConfig:{pageType:'MUSIC_PAGE_TYPE_ARTIST'}}}}}]},lengthText:{simpleText:'3:20'},thumbnail:{thumbnails:[{url:'https://lh3.googleusercontent.com/fixture_radio_123=w544-h544-rj',width:544}]}};
 const rows=parseRadio({contents:[video,video,{...video,videoId:'seedvideo12'},{...video,videoId:'bad'},{...video,videoId:'unavailable',unplayableText:{simpleText:'Unavailable'}}].map(playlistPanelVideoRenderer=>({playlistPanelVideoRenderer}))},'seedvideo12');
 assert.equal(rows.length,1);assert.equal(rows[0].playbackSource.videoId,video.videoId);assert.equal(rows[0].trackDuration,200);assert.equal(rows[0].artist,'Artist');
});
test('radio cache shares next requests and never queries Last.fm or searches per recommendation',async()=>{
 let calls=0;const client=createYouTubeMusicClient({fetcher:async(url,options)=>{if(!options?.body)return {ok:true,text:async()=> 'ytcfg.set({"INNERTUBE_API_KEY":"key","INNERTUBE_CLIENT_VERSION":"1"});'};calls++;const body=JSON.parse(options.body);assert.equal(body.playlistId,'RDAMVMabcdefghijk');assert.ok(url.includes('/next?'));return {ok:true,json:async()=>({})};}});
 await Promise.all([client.radio('abcdefghijk'),client.radio('abcdefghijk')]);await client.radio('abcdefghijk');assert.equal(calls,1);assert.throws(()=>client.radio('bad'),{status:400});
 const row={kind:'music',catalogId:'ytmusic:video:related1234'};
 const catalog=createMusicCatalog({youtubeMusic:{radio:async id=>{assert.equal(id,'abcdefghijk');return {items:[row]};}},lastfm:{recommendations:async()=>{throw Error('should not query Last.fm');}}});
 assert.equal((await catalog.recommendations('music','Artist','Song',{videoId:'abcdefghijk'})).items[0].recommendationSource,'YouTube Music');
});
test('existing Last.fm description request exposes its genre tags',async()=>{
 const payload={track:{wiki:{summary:'Description'},toptags:{tag:[{name:'Rock'}]}}};
 const client=require('../server/lastfm.cjs').createLastfmClient({env:{LASTFM_API_KEY:'fixture'},interval:0,fetcher:async()=>({ok:true,json:async()=>payload})});
 assert.deepEqual((await client.summary('music','Artist','Song')).genres,['Rock']);
});
test('YouTube track details inherit release year from their linked album and optional Last.fm tags without replacing identity',async()=>{
 const row={kind:'music',catalogId:'ytmusic:video:abcdefghijk',title:'Song',artist:'Artist',albumCatalogId:'ytmusic:album:'+albumId,isrc:'JPK652300130'};
 const make=genres=>createMusicCatalog({youtubeMusic:{details:async kind=>kind==='album'?{releaseDate:'2024'}:{...row}},lastfm:{summary:async()=>({genres})}});
 const detail=await make(['Rock']).details('music',row.catalogId);
 assert.equal(detail.catalogId,row.catalogId);assert.equal(detail.releaseDate,'2024');assert.deepEqual(detail.genres,['Rock']);assert.equal(detail.genresSource,'Last.fm');
 assert.equal((await make([]).details('music',row.catalogId)).genres,undefined);
});
const txt=value=>({runs:[{text:value}]}),browse=(kind,id)=>({browseId:id,browseEndpointContextSupportedConfigs:{browseEndpointContextMusicConfig:{pageType:'MUSIC_PAGE_TYPE_'+kind.toUpperCase()}}});
const art={musicThumbnailRenderer:{thumbnail:{thumbnails:[{width:120,url:'https://i.ytimg.com/small.jpg'},{width:600,url:'https://i.ytimg.com/large.jpg'},{width:900,url:'http://bad.test/art.jpg'}]}}};
const album={title:txt('Album'),subtitle:txt('2024'),navigationEndpoint:{browseEndpoint:browse('album',albumId)},thumbnailRenderer:art};
const song=structuredClone(fixture.contents.sectionListRenderer.contents[0].musicShelfRenderer.contents[0].musicResponsiveListItemRenderer);
song.flexColumns[1].musicResponsiveListItemFlexColumnRenderer.text.runs[0].navigationEndpoint.browseEndpoint=browse('artist',artistId);
song.flexColumns[1].musicResponsiveListItemFlexColumnRenderer.text.runs[2].navigationEndpoint.browseEndpoint=browse('album',albumId);
fixture.contents.sectionListRenderer.contents[0].musicShelfRenderer.contents[0].musicResponsiveListItemRenderer=song;
const albumPayload={header:{musicResponsiveHeaderRenderer:{title:txt('Album'),thumbnail:art,straplineTextOne:{runs:[{text:'Artist',navigationEndpoint:{browseEndpoint:browse('artist',artistId)}}]}}},contents:[{musicPlaylistShelfRenderer:{contents:[{musicResponsiveListItemRenderer:song}]}}]};
test('artist recommendations parse related artist identities and bypass Last.fm',async()=>{
 const related={title:txt('Related artist'),navigationEndpoint:{browseEndpoint:browse('artist','UCrelatedartist123')},thumbnailRenderer:art};
 const payload={header:{musicImmersiveHeaderRenderer:{title:txt('Artist')}},contents:[{musicCarouselShelfRenderer:{contents:[{musicTwoRowItemRenderer:related},{musicTwoRowItemRenderer:related},{musicTwoRowItemRenderer:album}]}}]};
 const detail=parseBrowse('artist',artistId,payload);
 assert.equal(detail.relatedArtists.length,1);assert.equal(detail.relatedArtists[0].title,'Related artist');assert.ok(detail.relatedArtists[0].image);
 const catalog=createMusicCatalog({youtubeMusic:{details:async(kind,id)=>{assert.equal(kind,'artist');assert.equal(id,artistId);return detail;}},lastfm:{recommendations:async()=>{throw Error('must not query Last.fm');}}});
 const result=await catalog.recommendations('artist','Artist','Artist',{artistId});
 assert.equal(result.items[0].recommendationSource,'YouTube Music');
});
test('search retains standalone release year and album identity without mistaking album titles for years',()=>{
 const dated=structuredClone(song);dated.flexColumns[1].musicResponsiveListItemFlexColumnRenderer.text.runs.push({text:' · '},{text:'2018'});
 const row=parseSearch('music',{musicResponsiveListItemRenderer:dated})[0];
 assert.equal(row.releaseDate,'2018');assert.equal(row.albumCatalogId,'ytmusic:album:'+albumId);
 const payload=structuredClone(albumPayload);payload.header.musicResponsiveHeaderRenderer.subtitle=txt('2018');
 assert.equal(parseBrowse('album',albumId,payload).albumTracks[0].releaseDate,'2018');
});
test('known search year skips album detail fetch; album recommendations use YouTube radio only',async()=>{
 let albumCalls=0;const row={kind:'music',catalogId:'ytmusic:video:abcdefghijk',title:'Song',artist:'Artist',releaseDate:'2018',albumCatalogId:'ytmusic:album:'+albumId,isrc:'JPK652300130'};
 const catalog=createMusicCatalog({youtubeMusic:{details:async kind=>{if(kind==='music')return row;albumCalls++;return {albumTracks:[{playbackSource:{videoId:'abcdefghijk'}}]};},radio:async()=>({items:[{albumCatalogId:'ytmusic:album:MPRErelated123',albumTitle:'Related album',artist:'Artist',image:'fixture'}, {albumCatalogId:row.albumCatalogId,albumTitle:'Seed',artist:'Artist'}]})},lastfm:{summary:async()=>({}),recommendations:async()=>{throw Error('Last.fm should not seed album recommendations');}}});
 assert.equal((await catalog.details('music',row.catalogId)).releaseDate,'2018');assert.equal(albumCalls,0);
 const result=await catalog.recommendations('album','Artist','Album',{albumId});
 assert.equal(result.items.length,1);assert.equal(result.items[0].title,'Related album');assert.equal(result.items[0].kind,'album');
});
test('catalog parser validates song identity/source, duration and rejects videos/foreign entities',()=>{
 const rows=parseSearch('music',fixture);assert.equal(rows.length,1);assert.equal(rows[0].catalogId,'ytmusic:video:10z6-vQm23w');assert.equal(rows[0].trackDuration,216);assert.equal(model.queueTrack(rows[0]).playbackSource.videoId,'10z6-vQm23w');
 assert.equal(parseSearch('music',{contents:[{musicResponsiveListItemRenderer:song},{musicResponsiveListItemRenderer:song}]}).length,1);
 const bad=structuredClone(song);bad.overlay.musicItemThumbnailOverlayRenderer.content.musicPlayButtonRenderer.playNavigationEndpoint.watchEndpoint.watchEndpointMusicSupportedConfigs.watchEndpointMusicConfig.musicVideoType='MUSIC_VIDEO_TYPE_UGC';
 assert.deepEqual(parseSearch('music',{musicResponsiveListItemRenderer:bad}),[]);
 assert.equal(duration('1:02:03'),3723);assert.equal(duration('2:60'),undefined);
 const row={...album,overlay:song.overlay};assert.equal(parseSearch('music',{musicResponsiveListItemRenderer:row}).length,0);
 assert.equal(parseSearch('album',{musicTwoRowItemRenderer:row})[0].image,'https://i.ytimg.com/large.jpg');assert.equal(parseSearch('artist',{musicTwoRowItemRenderer:row}).length,0);
});
test('new catalog artwork requests cover resolution from the same resizable CDN asset',()=>{
 const withArt=url=>parseSearch('album',{musicTwoRowItemRenderer:{...album,thumbnailRenderer:{thumbnails:[{width:120,url}]}}})[0].image;
 assert.equal(withArt('https://yt3.googleusercontent.com/same-art=w120-h120-l90-rj'),'https://lh3.googleusercontent.com/same-art=w800-h800-l90-rj');
 assert.equal(withArt('https://lh3.ggpht.com/same-art=w1200-h1200-rj'),'https://lh3.ggpht.com/same-art=w1200-h1200-rj');
 assert.equal(withArt('https://i.ytimg.com/vi/10z6-vQm23w/default.jpg'),'https://i.ytimg.com/vi/10z6-vQm23w/default.jpg');
 const row=parseSearch('album',{musicTwoRowItemRenderer:{...album,thumbnailRenderer:{thumbnails:[{width:120,url:'https://yt3.googleusercontent.com/asset=w120-h120-l90-rj'}]}}})[0];
 assert.equal(row.imageFallback,'https://yt3.googleusercontent.com/asset=w120-h120-l90-rj');assert.notEqual(row.image,row.imageFallback);
});
test('album browse retains official-video first track, ordered shelves and header metadata; artist carousels carry art/type',()=>{
 const payload=structuredClone(albumPayload),first=payload.contents[0].musicPlaylistShelfRenderer.contents[0].musicResponsiveListItemRenderer;
 first.overlay.musicItemThumbnailOverlayRenderer.content.musicPlayButtonRenderer.playNavigationEndpoint.watchEndpoint.watchEndpointMusicSupportedConfigs.watchEndpointMusicConfig.musicVideoType='MUSIC_VIDEO_TYPE_OMV';first.flexColumns=first.flexColumns.slice(0,1);delete first.thumbnail;
 payload.recommendations={musicResponsiveListItemRenderer:song};const row=parseBrowse('album',albumId,payload);
 assert.equal(row.albumTracks.length,1);assert.equal(row.albumTracks[0].artist,'Artist');assert.equal(row.albumTracks[0].albumCatalogId,row.catalogId);assert.equal(row.albumTracks[0].image,row.image);assert.equal(row.trackNames[0],row.albumTracks[0].title);
 const person=parseBrowse('artist',artistId,{header:{musicImmersiveHeaderRenderer:{title:txt('Artist'),thumbnail:art}},contents:[{musicCarouselShelfRenderer:{header:{musicCarouselShelfBasicHeaderRenderer:{title:txt('Singles')}},contents:[{musicTwoRowItemRenderer:album}]}},{musicShelfRenderer:{contents:[{musicResponsiveListItemRenderer:song}]}}]});
 assert.equal(person.topAlbums[0].albumType,'single');assert.ok(person.topAlbums[0].image);assert.equal(person.topTracks.length,1);assert.throws(()=>parseBrowse('album',artistId,payload));assert.throws(()=>parseBrowse('artist',artistId,{}));
});
test('guest catalog uses separate filters, bounded cache, request dedup and exact song rehydration',async()=>{
 const calls=[];let time=0;const client=createYouTubeMusicClient({now:()=>time,ttl:100,fetcher:async(url,options)=>{
  assert.equal(new URL(url).hostname,'music.youtube.com');assert.equal(options.headers.Cookie,undefined);
  if(!options.method)return{ok:true,text:async()=> 'ytcfg.set({"INNERTUBE_API_KEY":"fixture","INNERTUBE_CLIENT_VERSION":"1"});'};
  const body=JSON.parse(options.body);calls.push({url,body});return{ok:true,json:async()=>url.includes('/browse?')?albumPayload:body.params===FILTERS.music?fixture:{musicTwoRowItemRenderer:{...album,navigationEndpoint:{browseEndpoint:browse(body.params===FILTERS.album?'album':'artist',body.params===FILTERS.album?albumId:artistId)}}}};
 }});
 const [a,b]=await Promise.all([client.search('music','Song'),client.search('music','Song')]);assert.equal(calls.length,1);a.items[0].title='mutated';assert.notEqual(b.items[0].title,a.items[0].title);
 assert.equal((await client.details('music','10z6-vQm23w')).catalogId,b.items[0].catalogId);assert.equal(calls.length,1);
 await client.search('album','Album');await client.search('artist','Artist');assert.deepEqual(calls.map(c=>c.body.params),Object.values(FILTERS));
 await client.details('album',albumId);await client.details('album',albumId);assert.equal(calls.filter(c=>c.url.includes('/browse?')).length,1);
 time=101;await client.details('music','10z6-vQm23w',{title:'Song'});assert.equal(calls.filter(c=>c.body.params===FILTERS.music).length,2);
 await assert.rejects(client.details('music','dQw4w9WgXcQ',{title:'Song'}),/disponíveis/);assert.throws(()=>client.search('playlist','Song'),{status:400});assert.throws(()=>client.details('artist',albumId),{status:400});
});
test('new catalog searches use YouTube only; Apple remains explicit legacy access; browse failure never changes identity',async()=>{
 let apple=0;const emptyApple={search:async()=>{apple++;return{provider:'iTunes',items:[{kind:'music',catalogId:'itunes:1'}]};},details:async()=>{throw Error('must not replace browse');}};
 for(const state of ['success','empty','error']){const c=createMusicCatalog({itunes:emptyApple,youtubeMusic:{search:async()=>{if(state==='error')throw Error('timeout');return{provider:'YouTube Music',items:state==='success'?parseSearch('music',fixture):[]};},details:async()=>{throw Error('browse offline');}}});if(state==='error')await assert.rejects(c.search('music','Song'),/timeout/);else assert.equal((await c.search('music','Song')).provider,'YouTube Music');await assert.rejects(c.details('album','ytmusic:album:'+albumId),/browse offline/);}
 assert.equal(apple,0);
});

test('Last.fm recommendations resolve only unique matching YouTube catalog entities',async()=>{
 const suggestions=['music','album','artist'].map(kind=>({kind,title:kind==='artist'?'Artist':'Song',artist:'Artist'}));
 let apple=0;
 const catalog=createMusicCatalog({itunes:{search:async()=>{apple++;throw Error('legacy search forbidden');}},lastfm:{recommendations:async()=>({items:suggestions})},youtubeMusic:{search:async(kind)=>({items:[{kind,title:kind==='artist'?'Artist':'Song',artist:'Artist',catalogId:'ytmusic:'+({music:'video:abcdefghijk',album:'album:MPREtestalbum',artist:'artist:UCtestartist123'}[kind]),image:'https://lh3.googleusercontent.com/fixture_123456=w800-h800-rj'}]})}});
 const result=await catalog.recommendations('music','Artist','Seed');
 assert.equal(result.items.length,3);assert.equal(apple,0);assert.ok(result.items.every(row=>row.catalogId.startsWith('ytmusic:')&&row.recommendationSource==='Last.fm'));
});
test('recording dedupe is cross-provider, conservative, edition-aware and leaves ambiguity separate',()=>{
 const a={kind:'music',id:'old',catalogId:'itunes:1',title:'Song',artist:'Artist',albumTitle:'Album',trackDuration:210,playbackSource:{type:'local',fileRef:'manual'}};
 const b={...a,id:undefined,catalogId:'ytmusic:video:10z6-vQm23w',playbackSource:{type:'youtube',videoId:'10z6-vQm23w'}};
 assert.equal(model.findRecording([a],b),a);assert.equal(model.findRecording([a,{...a,id:'other',catalogId:'itunes:2'}],b),null);assert.equal(model.findRecording([{...a,catalogId:'ytmusic:video:dQw4w9WgXcQ'}],b),null);
 for(const patch of [{albumTitle:''},{trackDuration:230},{title:'Song (Live)'},{isrc:'USABC1234567'}])assert.equal(model.recordingMatch({...a,isrc:'USABC1234568'},{...b,...patch}),0);
 assert.ok(model.sameWork(a,{...b,albumTitle:'Other'}));assert.equal(model.recordingMatch(a,{...b,albumTitle:'Other'}),0);
 assert.equal(model.library({...a,metadataSources:{youtubeMusicId:'10z6-vQm23w'}}).metadataSources.youtubeMusicId,'10z6-vQm23w');assert.equal(model.queueTrack(a).fileRef,'manual');assert.ok(model.validCatalogId('music','itunes:1'));
});
