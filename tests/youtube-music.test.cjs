const {test}=require('node:test'),assert=require('node:assert/strict');
const {createYouTubeMusicClient,parseSearchTracks,parseClientConfig}=require('../server/youtube-music.cjs');
const fixture=require('./fixtures/youtube-music-search.json');
const shell='ytcfg.set({"INNERTUBE_API_KEY":"fixture-key","INNERTUBE_CONTEXT":{"client":{"clientName":"WEB_REMIX","clientVersion":"fixture-version"}}});';
const target={title:"Heaven Knows I'm Miserable Now",artist:'The Smiths',albumTitle:'Hatful of Hollow',trackDuration:216};
const renderer=data=>data.contents.sectionListRenderer.contents[0].musicShelfRenderer.contents[0].musicResponsiveListItemRenderer;
test('minimal search fixture produces song metadata, canonical URL and duration',()=>{
 assert.deepEqual(parseSearchTracks(fixture),[{title:target.title,artist:target.artist,album:target.albumTitle,duration:216,videoId:'10z6-vQm23w',url:'https://www.youtube.com/watch?v=10z6-vQm23w',image:'https://i.ytimg.com/vi/10z6-vQm23w/default.jpg',resultType:'song'}]);
 for(const change of [r=>r.overlay.musicItemThumbnailOverlayRenderer.content.musicPlayButtonRenderer.playNavigationEndpoint.watchEndpoint.videoId='bad',r=>r.overlay.musicItemThumbnailOverlayRenderer.content.musicPlayButtonRenderer.playNavigationEndpoint.watchEndpoint.watchEndpointMusicSupportedConfigs.watchEndpointMusicConfig.musicVideoType='MUSIC_VIDEO_TYPE_UGC',r=>r.musicItemRendererDisplayPolicy='MUSIC_ITEM_RENDERER_DISPLAY_POLICY_GREY_OUT']){
  const data=structuredClone(fixture);change(renderer(data));assert.deepEqual(parseSearchTracks(data),[]);
 }
 assert.deepEqual(parseSearchTracks({contents:{unexpected:{}}}),[]);
});
test('client config is parsed as JSON without evaluating scripts',()=>{
 assert.equal(parseClientConfig(shell).client.clientVersion,'fixture-version');
 assert.throws(()=>parseClientConfig('ytcfg.set({danger:process.exit()})'));
 assert.equal(parseClientConfig('ytcfg.set({"noise":"} escaped \\" brace"});'+shell).key,'fixture-key');
});
test('guest search caches config/results, deduplicates requests, expires and returns isolated rows',async()=>{
 let time=0,shells=0,searches=0;
 const client=createYouTubeMusicClient({now:()=>time,ttl:100,fetcher:async(url,options)=>{
  assert.equal(new URL(url).hostname,'music.youtube.com');assert.equal(options.headers.Cookie,undefined);
  assert.ok(options.signal);
  if(options.method==='POST'){searches++;const body=JSON.parse(options.body);assert.equal(body.context.client.clientName,'WEB_REMIX');assert.equal(body.context.client.clientVersion,'fixture-version');assert.ok(body.params);return {ok:true,json:async()=>fixture};}
  shells++;return {ok:true,text:async()=>shell};
 }});
 const [a,b]=await Promise.all([client.searchTracks(target),client.searchTracks(target)]);assert.equal(searches,1);assert.equal(shells,1);a[0].title='changed';assert.notEqual(b[0].title,'changed');
 await client.searchTracks(target);assert.equal(searches,1);time=101;await client.searchTracks(target);assert.equal(searches,2);assert.equal(shells,1);
 time=4*60*60*1000+1;await client.searchTracks(target);assert.equal(shells,2);
});
test('timeout/errors release pending tasks and are not cached as success',async()=>{
 let calls=0;
 const client=createYouTubeMusicClient({timeout:10,fetcher:async(url,{signal,method})=>{
  if(!method)return {ok:true,text:async()=>shell};calls++;
  if(calls===1)return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));
  return {ok:true,json:async()=>fixture};
 }});
 const keepAlive=setTimeout(()=>{},100);try{await assert.rejects(client.searchTracks(target));assert.equal((await client.searchTracks(target)).length,1);}finally{clearTimeout(keepAlive);}
});
