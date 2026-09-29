/* Development-only transport: same browser/storage partition and origin. */
(function (root) {
  function createLocalVoiceSignaling({ clientId, roomId, onMessage, Channel = root.BroadcastChannel }) {
    if (!Channel) throw Error('BroadcastChannel indisponível neste navegador.');
    const channel = new Channel('spacevoice-signaling');
    let closed = false;
    channel.onmessage = ({ data }) => {
      if (closed || !data || data.roomId !== roomId || data.from === clientId || typeof data.from !== 'string' || (data.to && data.to !== clientId)) return;
      if (!['join','leave','offer','answer','ice','participant-state'].includes(data.type)) return;
      onMessage(data);
    };
    return {
      send(type, to, payload) { if (!closed) channel.postMessage({ type, roomId, from:clientId, to, payload }); },
      close() { closed = true; channel.onmessage = null; channel.close(); },
    };
  }
  root.createLocalVoiceSignaling = createLocalVoiceSignaling;
  if (typeof module !== 'undefined') module.exports = createLocalVoiceSignaling;
})(globalThis);
