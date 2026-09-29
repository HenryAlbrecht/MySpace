const {createHmac,randomUUID}=require('node:crypto');
const ICE=require('../dist/voice/ice-config.js');
function readConfig(env=process.env) {
 const stun=ICE.urls(env.PARTY_STUN_URLS||ICE.DEFAULT_STUN).filter(u=>/^stuns?:/i.test(u));
 const turn=ICE.urls(env.PARTY_TURN_URLS).filter(u=>/^turns?:/i.test(u));
 const ttl=Number(env.PARTY_TURN_TTL||3600);
 if(!Number.isInteger(ttl)||ttl<120||ttl>86400)throw Error('PARTY_TURN_TTL must be 120..86400 seconds');
 return {stun,turn,secret:env.PARTY_TURN_SECRET||'',ttl,origins:String(env.PARTY_ALLOWED_ORIGINS||'').split(',').map(v=>v.trim()).filter(Boolean)};
}
function issue(config,{now=Date.now(),suffix=randomUUID()}={}) {
 const iceServers=config.stun.length?[{urls:config.stun}]:[];
 let expiresAt=0;
 if(config.turn.length&&config.secret) {
  const expiry=Math.floor(now/1000)+config.ttl;expiresAt=expiry*1000;
  const username=`${expiry}:${suffix}`;
  iceServers.push({urls:config.turn,username,credential:createHmac('sha1',config.secret).update(username).digest('base64')});
 }return {iceServers,expiresAt,turn:expiresAt>0};
}
function createLimiter({windowMs=60000,socketMax=6,ipMax=30,now=Date.now}={}) {
 const ips=new Map(),sockets=new WeakMap();
 function allow(socket,ip) {
  const time=now();for(const [key,list] of ips)if(!list.length||list[list.length-1]<=time-windowMs)ips.delete(key);
  const prune=list=>list.filter(t=>t>time-windowMs);
  const own=prune(sockets.get(socket)||[]),shared=prune(ips.get(ip)||[]);
  if(own.length>=socketMax||shared.length>=ipMax||(!ips.has(ip)&&ips.size>=4096))return false;
  own.push(time);shared.push(time);sockets.set(socket,own);ips.set(ip,shared);return true;
 }return {allow};
}
module.exports={readConfig,issue,createLimiter};
