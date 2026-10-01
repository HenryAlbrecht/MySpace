/* Shared, bounded, unauthenticated room metadata and URL helpers. */
(function(root) {
  // Leaves room for the presence envelope under the server's 64 KiB inbound WebSocket limit.
  const MAX_AVATAR=60000,MAX_PARTICIPANTS=64;
  const validRoomId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(id);
  function roomName(value) {
    if(typeof value!=='string'||value.length>48||/[\u0000-\u001f\u007f]/.test(value))return null;
    return value.trim()||'geral';
  }
  function shortCode(id) {
    let hash=2166136261;for(const char of String(id))hash=Math.imul(hash^char.charCodeAt(0),16777619);
    return (hash>>>0).toString(16).padStart(8,'0').slice(0,6).toUpperCase();
  }
  function createRecents(storage) {
    const key='party-recent-rooms-v1';
    function list(){try{const data=JSON.parse(storage?.getItem(key)||'[]');if(!Array.isArray(data))return [];const seen=new Set();return data.filter(e=>e&&validRoomId(e.roomId)&&e.roomId!=='geral'&&roomName(e.name)!==null&&Number.isSafeInteger(e.lastVisited)&&e.lastVisited>=0).sort((a,b)=>b.lastVisited-a.lastVisited).filter(e=>{if(seen.has(e.roomId))return false;seen.add(e.roomId);return true;}).slice(0,5).map(e=>({roomId:e.roomId,name:roomName(e.name),lastVisited:e.lastVisited}));}catch{return [];}}
    function save(items){try{storage?.setItem(key,JSON.stringify(items.slice(0,5)));}catch{}return items;}
    return {list,visit(roomId,name='geral',lastVisited=Date.now()){if(!validRoomId(roomId)||roomName(name)===null)return list();return save([{roomId,name:roomName(name),lastVisited},...list().filter(e=>e.roomId!==roomId)].sort((a,b)=>b.lastVisited-a.lastVisited));},rename(roomId,name){if(roomName(name)===null)return;save(list().map(e=>e.roomId===roomId?{...e,name:roomName(name)}:e));},remove(roomId){save(list().filter(e=>e.roomId!==roomId));}};
  }
  function avatar(value,{allowHttp=false}={}) {
    if(value==null||value==='')return '';
    if(typeof value!=='string'||value.length>MAX_AVATAR)return null;
    if(/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(value))return value;
    if(value.length>2048)return null;
    try {const url=new URL(value);if(url.username||url.password)return null;return url.protocol==='https:'||(allowHttp&&url.protocol==='http:')?url.href:null;}catch{return null;}
  }
  function metadata(value,{allowHttp=false}={}) {
    if(!value||typeof value!=='object'||Array.isArray(value))return null;
    if(value.displayName!==undefined&&(typeof value.displayName!=='string'||value.displayName.length>64))return null;
    const image=avatar(value.avatar,{allowHttp});if(image===null)return null;
    return {displayName:value.displayName?.trim()||'Convidado',avatar:image};
  }
  function profile(value,href) {
    let image=typeof value.avatar==='string'?value.avatar:'';
    if(image&&!image.startsWith('data:'))try{image=new URL(image,href).href;}catch{image='';}
    return {displayName:typeof value.name==='string'?value.name.trim().slice(0,64)||'Convidado':'Convidado',avatar:avatar(image,{allowHttp:true})||''};
  }
  function secureId(crypto=root.crypto) {
    if(crypto?.randomUUID)return crypto.randomUUID();
    if(!crypto?.getRandomValues)throw Error('Este navegador não fornece geração segura de salas.');
    return Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
  }
  function parse(href) {const url=new URL(href);const id=url.searchParams.get('party');return id!=='geral'&&validRoomId(id)?id:null;}
  function roomUrl(href,id) {if(!validRoomId(id))throw Error('Sala inválida.');const url=new URL(href);url.searchParams.set('party',id);url.hash='spacevoice';return url.href;}
  function invite(href,id) {return roomUrl(href,id);}
  root.PARTY_ROOM={MAX_AVATAR,MAX_PARTICIPANTS,validRoomId,roomName,shortCode,createRecents,avatar,metadata,profile,secureId,parse,roomUrl,invite};
  if(typeof module!=='undefined')module.exports=root.PARTY_ROOM;
})(globalThis);
