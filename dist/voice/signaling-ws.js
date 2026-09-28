(function (root) {
  function createWebSocketVoiceSignaling({ clientId, roomId, onMessage, onStatus = () => {}, url, Socket = root.WebSocket, retryMs = 1500 }) {
    const location = root.location || { protocol:'http:', hostname:'localhost' };
    url = url || root.SPACEVOICE_CONFIG?.url || `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.hostname}:8787`;
    if (!Socket) throw Error('WebSocket indisponível.');
    let socket, timer, closed = false, joined = false;
    function connect() {
      onStatus('conectando');
      socket = new Socket(url);
      socket.onopen = () => {
        if (closed) return;
        if (joined) socket.send(JSON.stringify({type:'join', roomId, from:clientId, payload:{reply:false}}));
        onStatus('conectado');
      };
      socket.onmessage = event => {
        let m; try { m = JSON.parse(event.data); } catch { return; }
        if (!m || m.roomId !== roomId || typeof m.from !== 'string' || !m.from || m.from === clientId || (m.to && m.to !== clientId) || !['join','leave','offer','answer','ice'].includes(m.type)) return;
        onMessage(m);
      };
      socket.onerror = () => onStatus('erro de signaling');
      socket.onclose = () => {
        detach();
        if (closed) return;
        onStatus('desconectado');
        retry();
      };
    }
    function retry() {
      timer = root.setTimeout(() => {
        timer = null;
        if (closed) return;
        try { connect(); } catch { onStatus('erro de signaling'); retry(); }
      }, retryMs);
    }
    function detach() { socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null; }
    connect();
    return {
      send(type, to, payload) {
        if (closed) return;
        if (type === 'join' && !to) joined = true;
        if (socket.readyState === 1) socket.send(JSON.stringify({type, roomId, from:clientId, to, payload}));
      },
      close() {
        if (closed) return;
        closed = true; root.clearTimeout(timer); detach(); socket.close();
      },
    };
  }
  root.createWebSocketVoiceSignaling = createWebSocketVoiceSignaling;
  if (typeof module !== 'undefined') module.exports = createWebSocketVoiceSignaling;
})(globalThis);
