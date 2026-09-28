/* Coordinates one remote peer; neither profile identity nor a persisted store. */
(function (root) {
  function createVoiceSession({ clientId, signaling = root.createLocalVoiceSignaling, peer = root.createVoicePeer, onPeers, onStream, onRemove, onError, onStatus = () => {} }) {
    let transport, stream;
    const peers = new Map();
    const notify = () => onPeers([...peers].map(([id, entry]) => ({ id, status:entry.status })));
    function remove(id) { const entry = peers.get(id); if (!entry) return; entry.controller?.close(); peers.delete(id); onRemove(id); notify(); }
    function receive(message) {
      const { from, type, payload } = message;
      if (type === 'leave') { remove(from); return; }
      if (type === 'join' && !peers.has(from) && peers.size < 1) {
        const entry = { status:'conectando' };
        peers.set(from, entry);
        try { entry.controller = peer({ localStream:stream,
          send:(type, data) => transport?.send(type, from, data),
          onStream:remote => { if (peers.get(from) === entry) onStream(from, remote); },
          onState:state => {
            if (peers.get(from) !== entry) return;
            entry.status = state === 'connected' ? 'conectado' : state === 'failed' ? 'falha na conexão' : state === 'disconnected' ? 'desconectado' : 'conectando'; notify();
          }, onError:error => { if (peers.get(from) === entry) onError('Não foi possível conectar o convidado. Saia e entre novamente.'); },
        }); } catch (error) {
          peers.delete(from); notify(); onError('WebRTC indisponível ou falha ao criar conexão: ' + error.message); return;
        }
        notify();
        // Reply only to discovery, not to acknowledgements; no broadcast loop.
        if (!payload?.reply) transport.send('join', from, { reply:true });
        if (clientId < from) entry.controller.start();
      } else if (['offer','answer','ice'].includes(type)) {
        if (type === 'offer' && clientId < from) return;
        if (type === 'answer' && clientId > from) return;
        peers.get(from)?.controller.receive(type, payload);
      }
    }
    function close() {
      transport?.send('leave');
      transport?.close(); transport = null;
      for (const id of [...peers.keys()]) remove(id);
      stream = null;
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
    };
  }
  root.createVoiceSession = createVoiceSession;
  if (typeof module !== 'undefined') module.exports = createVoiceSession;
})(globalThis);
