/* Coordinates a mesh of independent peers; browser resources stay in this Map. */
(function (root) {
  function createVoiceSession({ clientId, signaling = root.createLocalVoiceSignaling, peer = root.createVoicePeer, onPeers, onStream, onScreen = () => {}, onRemove, onError, onStatus = () => {} }) {
    let transport, stream, screenStream = null, screenBitrate;
    const peers = new Map();
    const notify = () => onPeers([...peers].map(([id, entry]) => ({ id, status:entry.status, iceState:entry.iceState })));
    function remove(id) { const entry = peers.get(id); if (!entry) return; entry.controller?.close(); peers.delete(id); onRemove(id); notify(); }
    function ensurePeer(from) {
        if (!stream || typeof from !== 'string' || !from || from === clientId || peers.has(from)) return;
        const entry = { status:'conectando', iceState:'new' };
        peers.set(from, entry);
        try { entry.controller = peer({ localStream:stream, screenStream, screenBitrate, polite:clientId > from,
          send:(type, data) => { if (peers.get(from) === entry) transport?.send(type, from, data); },
          onStream:remote => { if (peers.get(from) === entry) onStream(from, remote); },
          onScreen:remote => {
            if (peers.get(from) !== entry) return;
            entry.remoteShare = remote ? { stream:remote, videoTrack:remote.getVideoTracks()[0], audioTrack:remote.getAudioTracks()[0] || null, state:'ativo' } : null;
            onScreen(from, remote);
          },
          onState:state => {
            if (peers.get(from) !== entry) return;
            entry.status = state === 'connected' ? 'conectado' : state === 'failed' ? 'falha' : state === 'disconnected' ? 'reconectando' : 'conectando'; notify();
          },
          onIceState:state => { if (peers.get(from) === entry) { entry.iceState = state; notify(); } },
          onError:error => { if (peers.get(from) === entry) { entry.status = 'falha'; notify(); onError('Não foi possível conectar o participante ' + from + '. Saia e entre novamente.'); } },
        }); } catch (error) {
          peers.delete(from); notify(); onError('WebRTC indisponível ou falha ao criar conexão: ' + error.message); return;
        }
        notify();
        if (clientId < from) entry.controller.start();
    }
    function receive(message) {
      const { from, type, payload } = message;
      if (type === 'peers') {
        if (!Array.isArray(payload?.peers) || payload.peers.some(id => typeof id !== 'string' || !id)) return;
        const present = new Set(payload.peers.filter(id => id !== clientId));
        for (const id of [...peers.keys()]) if (!present.has(id)) remove(id);
        for (const id of present) ensurePeer(id);
        return;
      }
      if (type === 'leave') { remove(from); return; }
      if (type === 'join') {
        const existed = peers.has(from);
        ensurePeer(from);
        // BroadcastChannel discovers peers by one acknowledgement per new pair.
        if (!existed && peers.has(from) && !payload?.reply) transport.send('join', from, { reply:true });
      } else if (['offer','answer','ice'].includes(type)) {
        peers.get(from)?.controller.receive(type, payload);
      }
    }
    function close() {
      transport?.send('leave');
      transport?.close(); transport = null;
      for (const id of [...peers.keys()]) remove(id);
      stream = null; screenStream = null;
    }
    return {
      start(localStream, roomId) {
        close(); stream = localStream;
        try { transport = signaling({ clientId, roomId, onMessage:receive, onStatus:status => {
          if (status === 'desconectado' || status === 'erro de signaling') for (const id of [...peers.keys()]) remove(id);
          onStatus(status);
        } }); transport.send('join', undefined, { reply:false }); }
        catch (error) { close(); throw error; }
      }, close,
      setScreen(localScreen, maxBitrate) {
        screenStream = localScreen; screenBitrate = maxBitrate;
        for (const entry of peers.values()) entry.controller.setScreen(localScreen, maxBitrate);
      },
    };
  }
  root.createVoiceSession = createVoiceSession;
  if (typeof module !== 'undefined') module.exports = createVoiceSession;
})(globalThis);
