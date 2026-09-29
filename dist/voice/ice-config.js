/* ICE configuration lives in memory; credentials never enter profile storage. */
(function(root) {
 const DEFAULT_STUN=['stun:stun.l.google.com:19302'];
 const policy=value=>value==='relay'?'relay':'all';
 const urls=value=>(Array.isArray(value)?value:String(value||'').split(/[\s,]+/)).filter(v=>typeof v==='string'&&/^(stun|stuns|turn|turns):[^\s]+$/i.test(v)).slice(0,16);
 function fallback(){return {iceServers:[{urls:[...DEFAULT_STUN]}],expiresAt:0,turn:false};}
 function normalize(value) {
  if(!Array.isArray(value?.iceServers)||value.iceServers.length>16)throw Error('Invalid ICE configuration');
  const iceServers=value.iceServers.map(s=>{
   const list=urls(s.urls);if(!list.length)throw Error('Invalid ICE URLs');
   const entry={urls:list};
   if(list.some(u=>/^turns?:/i.test(u))){
    if(typeof s.username!=='string'||typeof s.credential!=='string'||s.username.length>256||s.credential.length>256)throw Error('Invalid TURN credentials');
    entry.username=s.username;entry.credential=s.credential;
   }return entry;
  });
  const turn=iceServers.some(s=>s.urls.some(u=>/^turns?:/i.test(u)));
  const expiresAt=Number(value.expiresAt)||0;
  if(turn&&expiresAt<=0)throw Error('Missing TURN expiry');
  return {iceServers,expiresAt,turn};
 }
 function createCache({request,now=Date.now,refreshMarginMs=60000}) {
  let cached=null,pending=null;
  return {
   get() {
    if(cached&&(!cached.turn||cached.expiresAt-now()>refreshMarginMs))return Promise.resolve(cached);
    if(pending)return pending;
    pending=Promise.resolve().then(request).then(normalize).then(value=>{
     if(value.turn&&value.expiresAt<=now())throw Error('Expired TURN credentials');
     cached=value;return value;
    }).finally(()=>{pending=null;});return pending;
   },
   clear(){cached=null;},
  };
 }
 const api={DEFAULT_STUN,urls,policy,fallback,normalize,createCache};root.PARTY_ICE=api;
 if(typeof module!=='undefined')module.exports=api;
})(globalThis);
