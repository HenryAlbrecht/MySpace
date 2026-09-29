const { WebSocketServer } = require('ws');
const { randomUUID } = require('node:crypto');
const iceAPI=require('./ice-config.cjs');
const roomAPI = require('../dist/voice/room-metadata.js');
function createSignalingServer(options = {}) {
  const {maxRooms=128,maxRoomMembers=64,maxClients=512,env=process.env,iceProviderOptions={},allowHttpAvatars=env.NODE_ENV!=='production',...socketOptions}=options;
  const iceConfig=iceAPI.readConfig(env),iceLimit=iceAPI.createLimiter(),iceProvider=iceAPI.createProvider(iceConfig,iceProviderOptions);
  if(env.NODE_ENV==='production'&&(iceConfig.provider==='metered'||(iceConfig.turn.length&&iceConfig.secret))&&!iceConfig.origins.length)throw Error('PARTY_ALLOWED_ORIGINS required for production TURN');
  const verifyClient=({origin})=>iceConfig.origins.length?iceConfig.origins.includes(origin):env.NODE_ENV!=='production'||(iceConfig.provider!=='metered'&&!iceConfig.secret);
  const wss = new WebSocketServer({ port:8787, host:'0.0.0.0', maxPayload:65536, ...socketOptions, verifyClient });
  const rooms=new Map(),history=new Map();
  const application=new Set(['chat-message','typing-start','typing-stop']);
  const send=(socket,message)=>{if(socket.readyState===1)socket.send(JSON.stringify(message));};
  function snapshot(roomId) {
    const room=rooms.get(roomId);if(!room)return;
    const participants=[...room].map(([clientId,e])=>({clientId,...e.metadata,inCall:e.inCall}));
    for(const [id,e] of room)if(e.presence)send(e.socket,{type:'presence-snapshot',roomId,to:id,payload:{participants}});
  }
  wss.on('connection',(socket,request)=>{
    if(wss.clients.size>maxClients){socket.close(1013,'Capacity');return;}
    let identity,chatTimes=[],typingTimes=[],presenceTimes=[],restartTimes=[];
    const limited=(times,maximum)=>{const now=Date.now();while(times.length&&times[0]<=now-5000)times.shift();if(times.length>=maximum)return true;times.push(now);return false;};
    const chatError=(roomId,code,text)=>send(socket,{type:'chat-error',roomId,to:identity?.from,payload:{code,text}});
    const presenceError=(roomId,text)=>send(socket,{type:'presence-error',roomId,to:identity?.from,payload:{text}});
    let alive=true;socket.on('pong',()=>alive=true);socket.checkAlive=()=>{if(!alive)return socket.terminate();alive=false;socket.ping();};
    function entry(){return identity&&rooms.get(identity.roomId)?.get(identity.from);}
    function leaveCall(reason='left-call') {
      const e=entry();if(!e?.inCall)return;
      e.inCall=false;
      for(const [id,other] of rooms.get(identity.roomId))if(id!==identity.from&&other.inCall)send(other.socket,{type:'leave',...identity,payload:{reason}});
      snapshot(identity.roomId);
    }
    function leaveRoom(reason='left-room') {
      if(!identity)return;
      leaveCall(reason);const {roomId,from}=identity,room=rooms.get(roomId);room?.delete(from);
      if(!room?.size){rooms.delete(roomId);history.delete(roomId);}else snapshot(roomId);
      identity=null;
    }
    function joinCall() {
      const e=entry();if(!e||e.inCall)return;
      const room=rooms.get(identity.roomId),existing=[...room].filter(([id,other])=>id!==identity.from&&other.inCall).map(([id])=>id);
      e.inCall=true;
      send(socket,{type:'peers',roomId:identity.roomId,to:identity.from,payload:{peers:existing}});
      send(socket,{type:'chat-history',roomId:identity.roomId,to:identity.from,payload:{messages:history.get(identity.roomId)||[]}});
      for(const id of existing)send(room.get(id).socket,{type:'join',...identity,payload:{reply:true}});
      snapshot(identity.roomId);
    }
    socket.on('message',(raw,binary)=>{
      if(binary)return;
      let m;try{m=JSON.parse(raw.toString());}catch{return;}
      if(!m||!['presence-join','presence-update','presence-leave','join','leave','offer','answer','ice','participant-state','ice-config-request','ice-restart-request',...application].includes(m.type))return;
      if(application.has(m.type)) {
        const e=entry();
        if(!e?.inCall||m.roomId!==identity.roomId||m.to!==undefined){chatError(identity?.roomId||m.roomId,'membership','Entre na chamada para enviar mensagens.');return;}
        if(m.type==='chat-message') {
          if(typeof m.payload?.text!=='string'||!m.payload.text.trim()||m.payload.text.length>2000||(m.payload.authorName!==undefined&&(typeof m.payload.authorName!=='string'||m.payload.authorName.length>64))){chatError(identity.roomId,'invalid','Mensagem inválida ou acima de 2000 caracteres.');return;}
          if(limited(chatTimes,5)){chatError(identity.roomId,'rate-limit','Aguarde alguns segundos antes de enviar outra mensagem.');return;}
          const message={id:randomUUID(),roomId:identity.roomId,authorId:identity.from,authorName:e.presence?e.metadata.displayName:m.payload.authorName?.trim()||'Convidado',text:m.payload.text.trim(),createdAt:Date.now()};
          const messages=history.get(identity.roomId)||[];messages.push(message);if(messages.length>50)messages.shift();history.set(identity.roomId,messages);
          for(const other of rooms.get(identity.roomId).values())if(other.inCall)send(other.socket,{type:'chat-message',...identity,payload:message});
        }else{
          if(limited(typingTimes,8))return;
          const authorName=e.presence?e.metadata.displayName:typeof m.payload?.authorName==='string'?m.payload.authorName.trim().slice(0,64)||'Convidado':'Convidado';
          for(const [id,other] of rooms.get(identity.roomId))if(id!==identity.from&&other.inCall)send(other.socket,{type:m.type,...identity,payload:{authorName}});
        }return;
      }
      const validId=id=>typeof id==='string'&&id.length>0&&id.length<=128;
      if(!roomAPI.validRoomId(m.roomId)||!validId(m.from)||(m.to!==undefined&&!validId(m.to)))return;
      if(!identity) {
        if(!['presence-join','join'].includes(m.type)||m.to!==undefined)return;
        const data=m.type==='presence-join'?roomAPI.metadata(m.payload,{allowHttp:allowHttpAvatars}):{displayName:'Convidado',avatar:''};
        if(!data){socket.close(1008,'Invalid metadata');return;}
        const room=rooms.get(m.roomId)||new Map();
        if(room.has(m.from)){socket.close(1008,'Duplicate clientId');return;}
        if(room.size>=maxRoomMembers||(!rooms.has(m.roomId)&&rooms.size>=maxRooms)){socket.close(1013,'Room capacity');return;}
        identity={roomId:m.roomId,from:m.from};rooms.set(m.roomId,room);
        room.set(m.from,{socket,metadata:data,presence:m.type==='presence-join',inCall:false});
        if(m.type==='join')joinCall();else snapshot(m.roomId);
        return;
      }
      // All authority now belongs to this socket's registered identity.
      if(m.roomId!==identity.roomId||m.from!==identity.from)return;
      if(m.type==='ice-config-request') {
        if(m.to!==undefined||typeof m.payload?.requestId!=='string'||!/^ice-[a-zA-Z0-9-]{1,64}$/.test(m.payload.requestId)||Object.keys(m.payload).length!==1)return;
        const owner={...identity};
        if(!iceLimit.allow(socket,request.socket.remoteAddress||'unknown')){send(socket,{type:'ice-config',roomId:owner.roomId,to:owner.from,payload:{requestId:m.payload.requestId,error:'rate-limit'}});return;}
        void iceProvider.getIceConfiguration().then(config=>{if(identity?.roomId===owner.roomId&&identity?.from===owner.from)send(socket,{type:'ice-config',roomId:owner.roomId,to:owner.from,payload:{requestId:m.payload.requestId,...config}});}).catch(()=>{});return;
      }
      if(m.type==='presence-leave'){leaveRoom();socket.close(1000);return;}
      if(m.type==='presence-update'||m.type==='presence-join') {
        if(!entry().presence||limited(presenceTimes,10))return;
        const data=roomAPI.metadata(m.payload,{allowHttp:allowHttpAvatars});
        if(!data){presenceError(identity.roomId,'Metadata inválida.');return;}
        entry().metadata=data;snapshot(identity.roomId);return;
      }
      if(m.type==='leave'){if(entry().presence)leaveCall();else {leaveRoom();socket.close(1000);}return;}
      if(m.type==='join'&&!entry().inCall){if(!m.to)joinCall();return;}
      if(!entry().inCall)return;
      if(m.type==='ice-restart-request'){if(limited(restartTimes,3))return;m.payload=null;}
      if(m.type==='participant-state'&&typeof m.payload?.micMuted!=='boolean')return;
      if(!['join','participant-state'].includes(m.type)&&!m.to)return;
      if(m.type==='participant-state')m.payload={micMuted:m.payload.micMuted};
      const message={type:m.type,...identity,to:m.to,payload:m.payload};
      for(const [id,other] of rooms.get(identity.roomId))if(other.inCall&&id!==identity.from&&(!m.to||id===m.to))send(other.socket,message);
    });
    socket.on('close',()=>leaveRoom('signaling-disconnected'));socket.on('error',()=>{leaveRoom('signaling-disconnected');socket.terminate();});
  });
  const heartbeat=setInterval(()=>{for(const socket of wss.clients)socket.checkAlive?.();},15000);heartbeat.unref();wss.on('close',()=>clearInterval(heartbeat));
  return {wss,rooms,history};
}
if(require.main===module){
 try{process.loadEnvFile?.(require('node:path').join(__dirname,'..','.env'));}catch(error){if(error.code!=='ENOENT')throw error;}
 const {wss}=createSignalingServer({port:Number(process.env.VOICE_PORT||8787),host:process.env.VOICE_HOST||'0.0.0.0'});
 wss.on('listening',()=>console.log('PARTY signaling na porta '+wss.address().port));wss.on('error',error=>{console.error(error.message);process.exitCode=1;});
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{for(const socket of wss.clients)socket.terminate();wss.close();});
}
module.exports={createSignalingServer};
