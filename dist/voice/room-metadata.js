/* Shared, bounded, unauthenticated room metadata and URL helpers. */
(function(root) {
  const MAX_AVATAR=8192,MAX_PARTICIPANTS=64;
  const validRoomId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(id);
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
  function parse(href) {const url=new URL(href);const id=url.searchParams.get('party');return id===null?'geral':validRoomId(id)?id:null;}
  function roomUrl(href,id) {if(!validRoomId(id))throw Error('Sala inválida.');const url=new URL(href);url.searchParams.set('party',id);url.hash='spacevoice';return url.href;}
  function invite(href,id) {
    const url=new URL(roomUrl(href,id));
    // Local transport overrides are not portable outside the current machine.
    if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname)){url.searchParams.delete('voiceWsUrl');url.searchParams.delete('voiceTransport');}
    return url.href;
  }
  root.PARTY_ROOM={MAX_AVATAR,MAX_PARTICIPANTS,validRoomId,avatar,metadata,profile,secureId,parse,roomUrl,invite};
  if(typeof module!=='undefined')module.exports=root.PARTY_ROOM;
})(globalThis);
