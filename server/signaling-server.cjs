const { WebSocketServer } = require('ws');
function createSignalingServer(options = {}) {
  const wss = new WebSocketServer({ port:8787, host:'0.0.0.0', maxPayload:65536, ...options });
  const rooms = new Map();
  const send = (socket, message) => { if (socket.readyState === 1) socket.send(JSON.stringify(message)); };
  wss.on('connection', socket => {
    let identity;
    let alive = true;
    socket.on('pong', () => { alive = true; });
    socket.checkAlive = () => { if (!alive) return socket.terminate(); alive = false; socket.ping(); };
    function leave() {
      if (!identity) return;
      const { roomId, from } = identity, room = rooms.get(roomId);
      room.delete(from);
      for (const other of room.values()) send(other, { type:'leave', roomId, from });
      if (!room.size) rooms.delete(roomId);
      identity = null;
    }
    socket.on('message', (raw, binary) => {
      if (binary) return;
      let m; try { m = JSON.parse(raw.toString()); } catch { return; }
      if (!m || !['join','leave','offer','answer','ice','participant-state'].includes(m.type)) return;
      const validId = id => typeof id === 'string' && id.length > 0 && id.length <= 128;
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
  return { wss, rooms };
}
if (require.main === module) {
  const { wss } = createSignalingServer({ port:Number(process.env.VOICE_PORT || 8787), host:process.env.VOICE_HOST || '0.0.0.0' });
  wss.on('listening', () => console.log('SPACEVOICE signaling na porta ' + wss.address().port));
  wss.on('error', error => { console.error(error.message); process.exitCode = 1; });
  for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => { for (const socket of wss.clients) socket.terminate(); wss.close(); });
}
module.exports = { createSignalingServer };
