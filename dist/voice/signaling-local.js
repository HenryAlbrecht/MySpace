/* Development-only transport: same browser/storage partition and origin, no authority. */
(function(root){
 function createLocalVoiceSignaling({clientId,roomId,onMessage,onStatus=()=>{},Channel=root.BroadcastChannel}) {
  if(!Channel)throw Error('BroadcastChannel indisponível neste navegador.');
  const api=root.PARTY_ROOM || (typeof require==='function'?require('./room-metadata.js'):null);
  const channel=new Channel('spacevoice-signaling'),participants=new Map();let closed=false,local=null,inCall=false;
  let roomName='geral',nameVersion={at:0,from:''};
  const publish=()=>{if(local)onMessage({type:'presence-snapshot',roomId,to:clientId,payload:{participants:[...participants.values()],roomName}});};
  function acceptName(payload){const name=api.roomName(payload?.roomName),version=payload?.nameVersion;if(name===null||!Number.isSafeInteger(version?.at)||version.at<0||typeof version.from!=='string')return;if(version.at>nameVersion.at||version.at===nameVersion.at&&version.from>nameVersion.from){roomName=name;nameVersion=version;}}
  const post=(type,to,payload)=>channel.postMessage({type,roomId,from:clientId,to,payload});
  const self=()=>({clientId,...local,inCall});
  channel.onmessage=({data:m})=>{
    if(closed||!m||m.roomId!==roomId||m.from===clientId||typeof m.from!=='string'||(m.to&&m.to!==clientId))return;
    if(['presence-join','presence-update'].includes(m.type)) {
      const value=api.metadata(m.payload,{allowHttp:true});if(!value||participants.size>=api.MAX_PARTICIPANTS&&!participants.has(m.from))return;
      participants.set(m.from,{clientId:m.from,...value,inCall:m.payload?.inCall===true});publish();
      if(m.type==='presence-join'&&local)post('presence-snapshot',m.from,{participants:[self()],roomName,nameVersion});return;
    }
    if(m.type==='presence-snapshot') {
      // Each BC peer announces only itself; no shared authority or history server.
      for(const item of (m.payload?.participants||[]).slice(0,api.MAX_PARTICIPANTS)) {
        if(item.clientId!==m.from)continue;const value=api.metadata(item,{allowHttp:true});
        if(value&&(participants.has(m.from)||participants.size<api.MAX_PARTICIPANTS))participants.set(m.from,{clientId:m.from,...value,inCall:item.inCall===true});
      }acceptName(m.payload);publish();return;
    }
    if(m.type==='room-rename'){if(local&&participants.has(m.from)){acceptName(m.payload);publish();}return;}
    if(m.type==='presence-leave') {const old=participants.get(m.from);participants.delete(m.from);publish();if(old?.inCall)onMessage({type:'leave',roomId,from:m.from});return;}
    if(!['join','leave','offer','answer','ice','participant-state','ice-restart-request','chat-message','typing-start','typing-stop'].includes(m.type))return;
    if(!local||(!inCall&&!['chat-message','typing-start','typing-stop'].includes(m.type)))return;
    onMessage(m);
  };
  return { local:true,
    send(type,to,payload) {
      if(closed)return false;
      if(type==='room-rename'){
        const name=api.roomName(payload?.name);if(!local||name===null)return false;
        roomName=name;nameVersion={at:Math.max(Date.now(),nameVersion.at+1),from:clientId};post(type,to,{roomName,nameVersion});publish();return true;
      }
      if(['chat-message','typing-start','typing-stop'].includes(type)&&!local)return false;
      if(type==='presence-join'||type==='presence-update') {
        const value=api.metadata(payload,{allowHttp:true});if(!value)return false;local=value;participants.set(clientId,self());post(type,to,{...value,inCall});publish();onStatus('conectado');return true;
      }
      if(type==='presence-leave') {post(type);participants.clear();local=null;return true;}
      if(type==='join'&&!to) {
        inCall=true;if(local){participants.set(clientId,self());post('presence-update',undefined,self());publish();onMessage({type:'peers',roomId,to:clientId,payload:{peers:[...participants.values()].filter(p=>p.clientId!==clientId&&p.inCall).map(p=>p.clientId)}});}
      }
      if(type==='leave'){inCall=false;if(local){participants.set(clientId,self());post('presence-update',undefined,self());publish();}}
      if(type==='chat-message') {
        if(typeof payload?.text!=='string'||!payload.text.trim()||payload.text.length>2000)return false;
        payload={id:root.crypto?.randomUUID?.()||clientId+':'+Date.now()+':'+Math.random(),roomId,authorId:clientId,authorName:local?.displayName||(typeof payload.authorName==='string'?payload.authorName.trim().slice(0,64)||'Convidado':'Convidado'),text:payload.text.trim(),createdAt:Date.now()};
      }
      post(type,to,payload);if(type==='chat-message')onMessage({type,roomId,from:clientId,to,payload});if(type==='join'&&!to)onStatus('conectado');return true;
    },
    close(){closed=true;channel.onmessage=null;channel.close();participants.clear();},
  };
 }
 root.createLocalVoiceSignaling=createLocalVoiceSignaling;
 if(typeof module!=='undefined')module.exports=createLocalVoiceSignaling;
})(globalThis);
