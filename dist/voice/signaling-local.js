/* Development-only transport: same browser/storage partition and origin. */
(function (root) {
  function createLocalVoiceSignaling({ clientId, roomId, onMessage, onStatus = () => {}, Channel = root.BroadcastChannel }) {
    if (!Channel) throw Error('BroadcastChannel indisponível neste navegador.');
    const channel = new Channel('spacevoice-signaling');
    let closed = false;
    channel.onmessage = ({ data }) => {
      if (closed || !data || data.roomId !== roomId || data.from === clientId || typeof data.from !== 'string' || (data.to && data.to !== clientId)) return;
      if (!['join','leave','offer','answer','ice','participant-state','chat-message','typing-start','typing-stop'].includes(data.type)) return;
      onMessage(data);
    };
    return {
      send(type, to, payload) {
        if (closed) return false;
        if (type === 'chat-message') {
          if (typeof payload?.text !== 'string' || !payload.text.trim() || payload.text.length > 2000) return false;
          payload = {id:root.crypto?.randomUUID?.() || clientId+':'+Date.now()+':'+Math.random(),roomId,authorId:clientId,authorName:typeof payload.authorName==='string'?payload.authorName.trim().slice(0,64)||'Convidado':'Convidado',text:payload.text.trim(),createdAt:Date.now()};
        }
        const message = {type,roomId,from:clientId,to,payload}; channel.postMessage(message);
        if (type === 'chat-message') onMessage(message); // BC does not echo to itself.
        if (type === 'join' && !to) onStatus('conectado');
        return true;
      },
      close() { closed = true; channel.onmessage = null; channel.close(); },
    };
  }
  root.createLocalVoiceSignaling = createLocalVoiceSignaling;
  if (typeof module !== 'undefined') module.exports = createLocalVoiceSignaling;
})(globalThis);
