/* Library references are metadata, never inferred playback. */
(function(root){
 function url(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password&&u.href.length<=2048?u.href:'';}catch{return '';}}
 function source(value){
  if(value==null)return null;if(typeof value!=='object'||Array.isArray(value))throw Error('Fonte de reprodução inválida.');
  if(value.type==='local'&&typeof value.fileRef==='string'&&/^[\w-]{1,128}$/.test(value.fileRef))return {type:'local',fileRef:value.fileRef};
  if(value.type==='youtube'){const link=url(value.url||(value.videoId?'https://www.youtube.com/watch?v='+value.videoId:''));if(link){const u=new URL(link),host=u.hostname.replace(/^www\./,''),id=host==='youtu.be'?u.pathname.slice(1):['youtube.com','music.youtube.com','m.youtube.com'].includes(host)?u.searchParams.get('v')||u.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1]:'';if(/^[\w-]{11}$/.test(id||''))return {type:'youtube',url:link,videoId:id};}}
  if(value.type==='audio'&&url(value.url))return {type:'audio',url:url(value.url)};
  throw Error('Use um vídeo YouTube/YouTube Music ou arquivo local válido.');
 }
 function references(item){const input=item.metadataSources||{},result={};for(const key of ['deezerId','deezerUrl','lastfmUrl','catalogId','artistCatalogId','albumCatalogId']){const value=input[key]??item[key];if(typeof value==='string'&&value.length<=2048)result[key]=key.endsWith('Url')?url(value):value;}
  if(/^deezer:\d+$/.test(item.catalogId||''))result.deezerId=item.catalogId.slice(7);
  const link=url(item.url);if(link){const host=new URL(link).hostname.replace(/^www\./,'');if(host==='deezer.com')result.deezerUrl=link;if(host==='last.fm')result.lastfmUrl=link;}return result;
 }
 function library(item){return {...item,metadataSources:references(item),playbackSource:source(item.playbackSource)};}
 function queueTrack(item){const s=source(item.playbackSource);if(!s)throw Error('Vincule uma fonte de reprodução antes de tocar.');return {title:item.title,artist:item.artist||'',album:item.image||item.artwork||'',albumTitle:item.albumTitle||'',metadataSources:references(item),playbackSource:s,collectionId:item.id||'',url:s.type==='local'?'':s.url,local:s.type==='local',fileRef:s.fileRef||''};}
 function sameItem(a,b){return a.kind===b.kind&&!!((a.id&&a.id===b.id)||(a.catalogId&&a.catalogId===b.catalogId));}
 function sameWork(a,b){const key=v=>String(v||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();return sameItem(a,b)||(a.kind===b.kind&&['music','album','artist'].includes(a.kind)&&!!key(a.title)&&key(a.title)===key(b.title)&&(a.kind==='artist'||!!key(a.artist)&&key(a.artist)===key(b.artist)));}

 root.MusicModel={url,source,references,library,queueTrack,sameItem,sameWork};if(typeof module!=='undefined')module.exports=root.MusicModel;
})(globalThis);
