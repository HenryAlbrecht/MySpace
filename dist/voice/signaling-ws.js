(function (root) {
  function createWebSocketVoiceSignaling({
    clientId,
    roomId,
    onMessage,
    onStatus = () => {},
    url,
    Socket = root.WebSocket,
    retryMs = 1500,
  }) {
    const location = root.location || { protocol: "http:", hostname: "localhost" };
    url =
      url ||
      root.SPACEVOICE_CONFIG?.url ||
      (location.protocol === "https:"
        ? `wss://${location.host || location.hostname}/party-signaling`
        : `ws://${location.hostname}:8787`);
    if (!Socket) throw Error("WebSocket indisponível.");
    let socket,
      timer,
      closed = false,
      joined = false,
      presence = null;
    function connect() {
      onStatus("conectando");
      socket = new Socket(url);
      socket.onopen = () => {
        if (closed) return;
        if (presence)
          socket.send(
            JSON.stringify({ type: "presence-join", roomId, from: clientId, payload: presence }),
          );
        if (joined)
          socket.send(
            JSON.stringify({ type: "join", roomId, from: clientId, payload: { reply: false } }),
          );
        onStatus("conectado");
      };
      socket.onmessage = (event) => {
        let m;
        try {
          m = JSON.parse(event.data);
        } catch {
          return;
        }
        if (["presence-snapshot", "presence-error", "ice-config"].includes(m?.type)) {
          if (m.roomId === roomId && m.to === clientId) onMessage(m);
          return;
        }
        // Application events include our own server-confirmed echo. They never
        // reach the WebRTC controller or create another WebSocket.
        if (
          ["chat-message", "chat-history", "chat-error", "typing-start", "typing-stop"].includes(
            m?.type,
          )
        ) {
          if (
            m.roomId === roomId &&
            (!m.to || m.to === clientId) &&
            (["chat-history", "chat-error"].includes(m.type)
              ? m.to === clientId
              : typeof m.from === "string" && !!m.from)
          )
            onMessage(m);
          return;
        }
        // Server-owned presence snapshot has no client sender. It is targeted.
        if (m?.type === "peers") {
          if (
            m.roomId === roomId &&
            m.to === clientId &&
            Array.isArray(m.payload?.peers) &&
            m.payload.peers.every(
              (id) => typeof id === "string" && id.length > 0 && id.length <= 128,
            )
          )
            onMessage(m);
          return;
        }
        if (
          !m ||
          m.roomId !== roomId ||
          typeof m.from !== "string" ||
          !m.from ||
          m.from === clientId ||
          (m.to && m.to !== clientId) ||
          ![
            "join",
            "leave",
            "offer",
            "answer",
            "ice",
            "participant-state",
            "ice-restart-request",
          ].includes(m.type)
        )
          return;
        onMessage(m);
      };
      socket.onerror = () => onStatus("erro de signaling");
      socket.onclose = () => {
        detach();
        if (closed) return;
        onStatus("desconectado");
        retry();
      };
    }
    function retry() {
      timer = root.setTimeout(() => {
        timer = null;
        if (closed) return;
        try {
          connect();
        } catch {
          onStatus("erro de signaling");
          retry();
        }
      }, retryMs);
    }
    function detach() {
      socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
    }
    connect();
    return {
      send(type, to, payload) {
        if (closed) return false;
        if (type === "presence-join" || type === "presence-update") presence = payload;
        if (type === "presence-leave") {
          presence = null;
          joined = false;
        }
        if (type === "join" && !to) joined = true;
        if (type === "leave") joined = false;
        if (socket.readyState === 1) {
          socket.send(JSON.stringify({ type, roomId, from: clientId, to, payload }));
          return true;
        }
        return false;
      },
      close() {
        if (closed) return;
        closed = true;
        root.clearTimeout(timer);
        detach();
        socket.close();
      },
    };
  }
  root.createWebSocketVoiceSignaling = createWebSocketVoiceSignaling;
  if (typeof module !== "undefined") module.exports = createWebSocketVoiceSignaling;
})(globalThis);
