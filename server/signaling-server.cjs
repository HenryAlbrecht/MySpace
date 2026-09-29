const { WebSocketServer } = require('ws');
const { randomUUID } = require('node:crypto');
function createSignalingServer(options = {}) {
  const wss = new WebSocketServer({ port:8787, host:'0.0.0.0', maxPayload:65536, ...options });
  const rooms = new Map();
  const history = new Map(); // Ephemeral and bounded; empty rooms release history.
  const application = new Set(['chat-message','typing-start','typing-stop']);
  const send = (socket, message) => { if (socket.readyState === 1) socket.send(JSON.stringify(message)); };
  wss.on('connection', socket => {
    let identity;
    let chatTimes = [], typingTimes = [];
    const limited = (times, maximum) => { const now = Date.now(); while (times.length && times[0] <= now - 5000) times.shift(); if (times.length >= maximum) return true; times.push(now); return false; };
    const chatError = (roomId, code, text) => send(socket,{type:'chat-error',roomId,to:identity?.from,payload:{code,text}});
    let alive = true;
    socket.on('pong', () => { alive = true; });
    socket.checkAlive = () => { if (!alive) return socket.terminate(); alive = false; socket.ping(); };
    function leave() {
      if (!identity) return;
      const { roomId, from } = identity, room = rooms.get(roomId);
      room.delete(from);
      for (const other of room.values()) send(other, { type:'leave', roomId, from });
      if (!room.size) { rooms.delete(roomId); history.delete(roomId); }
      identity = null;
    }
    socket.on('message', (raw, binary) => {
      if (binary) return;
      let m; try { m = JSON.parse(raw.toString()); } catch { return; }
      if (!m || !['join','leave','offer','answer','ice','participant-state',...application].includes(m.type)) return;
      const validId = id => typeof id === 'string' && id.length > 0 && id.length <= 128;
      // Application messages use socket-owned membership, never a supplied author/from.
      if (application.has(m.type)) {
        if (!identity || m.roomId !== identity.roomId || m.to !== undefined) { chatError(identity?.roomId || m.roomId,'membership','Entre nesta sala para enviar mensagens.'); return; }
        if (m.type === 'chat-message') {
          if (typeof m.payload?.text !== 'string' || !m.payload.text.trim() || m.payload.text.length > 2000 || (m.payload.authorName !== undefined && (typeof m.payload.authorName !== 'string' || m.payload.authorName.length > 64))) { chatError(identity.roomId,'invalid','Mensagem inválida ou acima de 2000 caracteres.'); return; }
          if (limited(chatTimes,5)) { chatError(identity.roomId,'rate-limit','Aguarde alguns segundos antes de enviar outra mensagem.'); return; }
          const message = {id:randomUUID(),roomId:identity.roomId,authorId:identity.from,authorName:m.payload.authorName?.trim() || 'Convidado',text:m.payload.text.trim(),createdAt:Date.now()};
          const messages = history.get(identity.roomId) || []; messages.push(message); if (messages.length > 50) messages.shift(); history.set(identity.roomId,messages);
          for (const other of rooms.get(identity.roomId).values()) send(other,{type:'chat-message',...identity,payload:message});
        } else {
          if (limited(typingTimes,8)) return;
          const authorName = typeof m.payload?.authorName === 'string' ? m.payload.authorName.trim().slice(0,64) || 'Convidado' : 'Convidado';
          for (const [id,other] of rooms.get(identity.roomId)) if (id !== identity.from) send(other,{type:m.type,...identity,payload:{authorName}});
        }
        return;
      }
      if (!validId(m.roomId) || !validId(m.from) || (m.to !== undefined && !validId(m.to))) return;
      if (!identity) {
        if (m.type !== 'join' || m.to !== undefined) return;
        const room = rooms.get(m.roomId) || new Map();
        if (room.has(m.from)) { socket.close(1008, 'Duplicate clientId'); return; }
        identity = { roomId:m.roomId, from:m.from };
        rooms.set(m.roomId, room);
        const existing = [...room.keys()];
        room.set(m.from, socket);
        send(socket, { type:'peers', roomId:m.roomId, to:m.from, payload:{peers:existing} });
        send(socket, { type:'chat-history', roomId:m.roomId, to:m.from, payload:{messages:history.get(m.roomId) || []} });
        for (const id of existing) send(room.get(id), { type:'join', ...identity, payload:{reply:true} });
        return;
      }
      if (m.roomId !== identity.roomId || m.from !== identity.from) return;
      if (m.type === 'leave') { leave(); socket.close(1000); return; }
      if (m.type === 'participant-state' && typeof m.payload?.micMuted !== 'boolean') return;
      if (!['join','participant-state'].includes(m.type) && !m.to) return;
      if (m.type === 'participant-state') m.payload = {micMuted:m.payload.micMuted};
      const message = { type:m.type, ...identity, to:m.to, payload:m.payload };
      for (const [id, other] of rooms.get(identity.roomId)) {
        if (id !== identity.from && (!m.to || id === m.to)) send(other, message);
      }
    });
    socket.on('close', leave);
    socket.on('error', () => { leave(); socket.terminate(); });
  });
  const heartbeat = setInterval(() => { for (const socket of wss.clients) socket.checkAlive(); }, 15000);
  heartbeat.unref();
  wss.on('close', () => clearInterval(heartbeat));
  return { wss, rooms, history };
}
if (require.main === module) {
  const { wss } = createSignalingServer({ port:Number(process.env.VOICE_PORT || 8787), host:process.env.VOICE_HOST || '0.0.0.0' });
  wss.on('listening', () => console.log('SPACEVOICE signaling na porta ' + wss.address().port));
  wss.on('error', error => { console.error(error.message); process.exitCode = 1; });
  for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => { for (const socket of wss.clients) socket.terminate(); wss.close(); });
}
module.exports = { createSignalingServer };
