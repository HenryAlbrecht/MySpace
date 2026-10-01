/* Internal track snapshot; only confirmed audio playback becomes Now Playing. */
(function(root){
 function track(value={},embed=null){
  const source=embed?.provider==='youtube'?(String(value.musicUrl||value.url).includes('music.youtube.com')?'YouTube Music':'YouTube'):embed?.provider==='spotify'?'Spotify':value.local||!value.musicUrl&&!value.url?'local':'áudio';
  const id=embed?.provider==='youtube'?new URL(embed.url).searchParams.get('v'):null;
  return {title:String(value.song??value.title??'Nenhuma música'),artist:String(value.artist||''),artwork:String(value.album||'')||(id?'https://i.ytimg.com/vi/'+id+'/hqdefault.jpg':''),source,sourceUrl:String(value.musicUrl??value.url??'')};
 }
 function create({target=root,storage}={}){
  const key='spaceamp-party-music-v1';let current=track(),playing=false,shared=true,navigation={};
  try{shared=storage?.getItem(key)!=='false';}catch{}
  const snapshot=()=>({...current,playing,shared});
  function emit(type){target?.dispatchEvent?.(new root.CustomEvent(type,{detail:snapshot()}));}
  return {getState:snapshot,getNowPlaying(){if(!shared||!playing)return null;return {title:current.title.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,80)||'Sem título',artist:current.artist.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,80),playing:true};},
   setNavigation(value){navigation=value;},previous(){return navigation.previous?.();},next(){return navigation.next?.();},
   update(next,isPlaying=false){const changed=JSON.stringify(current)!==JSON.stringify(next),stateChanged=playing!==!!isPlaying;current={...next};playing=!!isPlaying;if(changed)emit('spaceamp:trackchange');if(stateChanged)emit('spaceamp:playstate');},
   share(value){shared=!!value;try{storage?.setItem(key,String(shared));}catch{}emit('spaceamp:privacy');}
  };
 }
 root.SpaceAmp={track,create};if(typeof module!=='undefined')module.exports=root.SpaceAmp;
})(globalThis);
