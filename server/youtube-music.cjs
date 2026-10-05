// Guest search only. No player, stream, account cookies or media requests.
const {normalize}=require('./music-playback-matcher.cjs');
const SONGS_FILTER='EgWKAQIIAWoMEA4QChADEAQQCRAF';
const ID=/^[\w-]{11}$/;
const GUEST_HEADERS={'Accept-Language':'en-US,en;q=0.9','User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36'};
function parseClientConfig(html) {
  const config={}; let offset=0;
  while((offset=html.indexOf('ytcfg.set(',offset))>=0){
    const start=html.indexOf('{',offset+10);if(start<0)break;
    let depth=0,quoted=false,escape=false,end=start;
    for(;end<html.length;end++){
      const c=html[end];
      if(quoted){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')quoted=false;}
      else if(c==='"')quoted=true;else if(c==='{')depth++;else if(c==='}'&&!--depth){end++;break;}
    }
    try{Object.assign(config,JSON.parse(html.slice(start,end)));}catch{}
    offset=Math.max(end,offset+10);
  }
  const original=config.INNERTUBE_CONTEXT?.client||{};
  const version=original.clientVersion||config.INNERTUBE_CLIENT_VERSION;
  if(typeof config.INNERTUBE_API_KEY!=='string'||!version)throw Error('YouTube Music search configuration unavailable');
  return {key:config.INNERTUBE_API_KEY,client:{clientName:'WEB_REMIX',clientVersion:version,hl:'en',gl:'US',...(original.visitorData||config.VISITOR_DATA?{visitorData:original.visitorData||config.VISITOR_DATA}:{})}};
}
function parseSearchTracks(payload) {
  const rows=[],seen=new Set();
  function visit(value,depth=0){
    if(!value||typeof value!=='object'||depth>30||rows.length>=20)return;
    if(value.musicResponsiveListItemRenderer){
      const item=value.musicResponsiveListItemRenderer;
      const play=item.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint;
      const watch=play||item.navigationEndpoint?.watchEndpoint;
      const videoId=watch?.videoId||item.playlistItemData?.videoId;
      const type=watch?.watchEndpointMusicSupportedConfigs?.watchEndpointMusicConfig?.musicVideoType;
      if(type!=='MUSIC_VIDEO_TYPE_ATV'||!ID.test(videoId||'')||seen.has(videoId)||item.musicItemRendererDisplayPolicy==='MUSIC_ITEM_RENDERER_DISPLAY_POLICY_GREY_OUT')return;
      const columns=item.flexColumns||[],text=index=>columns[index]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs||[];
      const title=text(0).map(run=>run.text||'').join('');
      const runs=[...text(1),...text(2)];let artist=[],album='',duration;
      for(const run of runs){
        const browse=run.navigationEndpoint?.browseEndpoint;
        const pageType=browse?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType;
        if(browse&&(pageType==='MUSIC_PAGE_TYPE_ARTIST'||browse.browseId?.startsWith('UC')))artist.push(run.text);
        else if(browse&&(pageType==='MUSIC_PAGE_TYPE_ALBUM'||browse.browseId?.startsWith('MPRE')))album=run.text;
        else if(/^\d+(?::\d{2}){1,2}$/.test(run.text||''))duration=run.text.split(':').reduce((sum,n)=>sum*60+Number(n),0);
      }
      const image=item.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.at(-1)?.url||'';
      if(!title||!artist.length)return;
      seen.add(videoId);rows.push({title,artist:artist.join(' · '),album,duration,videoId,url:'https://www.youtube.com/watch?v='+videoId,image:/^https:\/\/(?:[\w-]+\.)*(?:ytimg\.com|googleusercontent\.com|ggpht\.com)\//.test(image)?image:'',resultType:'song'});
      return;
    }
    for(const child of Object.values(value))visit(child,depth+1);
  }
  visit(payload);return rows;
}
function createYouTubeMusicClient({fetcher=fetch,now=Date.now,timeout=8000,ttl=15*60*1000}={}) {
  const cache=new Map(),pending=new Map();let config,configAt=0,configTask;
  async function getConfig(signal){
    if(config&&now()-configAt<4*60*60*1000)return config;
    if(configTask)return configTask;
    configTask=(async()=>{
      const response=await fetcher('https://music.youtube.com/',{signal,headers:GUEST_HEADERS});
      if(!response.ok)throw Error('YouTube Music unavailable');
      config=parseClientConfig(await response.text());configAt=now();return config;
    })().finally(()=>configTask=null);return configTask;
  }
  return {searchTracks(target){
    const key=JSON.stringify([normalize(target.title),normalize(target.artist),normalize(target.albumTitle||target.album),target.trackDuration||target.duration||0]);
    const found=cache.get(key);if(found&&now()-found.at<ttl)return Promise.resolve(structuredClone(found.rows));
    if(pending.has(key))return pending.get(key).then(structuredClone);
    const task=(async()=>{
      const signal=AbortSignal.timeout(timeout),settings=await getConfig(signal);
      const response=await fetcher('https://music.youtube.com/youtubei/v1/search?'+new URLSearchParams({key:settings.key,prettyPrint:'false'}),{method:'POST',signal,headers:{...GUEST_HEADERS,'Content-Type':'application/json'},body:JSON.stringify({context:{client:settings.client},query:target.title+' '+target.artist,params:SONGS_FILTER})});
      if(!response.ok){if(response.status===400||response.status===403)config=null;throw Error('YouTube Music search unavailable');}
      const rows=parseSearchTracks(await response.json());
      if(cache.size>=80)cache.delete(cache.keys().next().value);cache.set(key,{at:now(),rows});return rows;
    })().finally(()=>pending.delete(key));pending.set(key,task);return task.then(structuredClone);
  }};
}
module.exports={createYouTubeMusicClient,parseSearchTracks,parseClientConfig};
