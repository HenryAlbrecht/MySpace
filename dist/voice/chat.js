/* Room application state. No RTCPeerConnection, media, storage or socket ownership. */
(function (root) {
  function createVoiceChat({
    clientId,
    send,
    getName = () => "Convidado",
    onChange = () => {},
    now = Date.now,
    setTimer = root.setTimeout,
    clearTimer = root.clearTimeout,
  }) {
    const state = {
      roomId: null,
      connected: false,
      messages: [],
      typing: [],
      unread: 0,
      draft: "",
      error: "",
      visible: true,
      nearBottom: true,
    };
    const typing = new Map();
    let stopTimer = null,
      lastStart = -Infinity,
      localTyping = false,
      sendTimes = [],
      historyReceived = false;
    const emit = (reason) => onChange(state, reason);
    const name = () =>
      String(getName() || "Convidado")
        .trim()
        .slice(0, 64) || "Convidado";
    function clearTyping() {
      for (const entry of typing.values()) clearTimer(entry.timer);
      typing.clear();
      state.typing = [];
    }
    function stop() {
      clearTimer(stopTimer);
      stopTimer = null;
      if (localTyping && state.connected) send("typing-stop", { authorName: name() });
      localTyping = false;
      lastStart = -Infinity;
    }
    function stopRemote(id) {
      const entry = typing.get(id);
      if (!entry) return;
      clearTimer(entry.timer);
      typing.delete(id);
      state.typing = [...typing].map(([id, e]) => ({ id, name: e.name }));
      emit("typing");
    }
    function valid(m) {
      return (
        m &&
        typeof m.id === "string" &&
        m.id.length > 0 &&
        m.id.length <= 128 &&
        m.roomId === state.roomId &&
        typeof m.authorId === "string" &&
        m.authorId.length > 0 &&
        m.authorId.length <= 128 &&
        typeof m.authorName === "string" &&
        m.authorName.length <= 64 &&
        typeof m.text === "string" &&
        m.text.trim().length > 0 &&
        m.text.length <= 2000 &&
        Number.isSafeInteger(m.createdAt) &&
        m.createdAt >= 0 &&
        m.createdAt <= 8640000000000000
      );
    }
    function insert(messages, history = false, countHistory = false) {
      const ids = new Set(state.messages.map((m) => m.id));
      let added = 0;
      for (const m of messages) {
        if (!valid(m) || ids.has(m.id)) continue;
        ids.add(m.id);
        state.messages.push({
          id: m.id,
          roomId: m.roomId,
          authorId: m.authorId,
          authorName: m.authorName,
          text: m.text,
          createdAt: m.createdAt,
        });
        if ((!history || countHistory) && m.authorId !== clientId) added++;
      }
      state.messages.sort((a, b) => a.createdAt - b.createdAt);
      state.messages = state.messages.slice(-100);
      if (added && (!state.visible || !state.nearBottom))
        state.unread = Math.min(100, state.unread + added);
      emit(history ? "history" : "message");
    }
    return {
      state,
      start(roomId) {
        stop();
        clearTyping();
        if (state.roomId !== roomId) {
          state.messages = [];
          state.draft = "";
          state.unread = 0;
          historyReceived = false;
        }
        state.roomId = roomId;
        state.connected = false;
        state.error = "";
        sendTimes = [];
        emit("lifecycle");
      },
      close() {
        stop();
        clearTyping();
        state.roomId = null;
        state.connected = false;
        state.messages = [];
        state.draft = "";
        state.unread = 0;
        state.error = "";
        sendTimes = [];
        historyReceived = false;
        emit("lifecycle");
      },
      connection(connected) {
        state.connected = !!connected;
        if (!connected) {
          stop();
          clearTyping();
        }
        emit("connection");
      },
      draft(value) {
        state.draft = value;
        state.error = value.length > 2000 ? "Limite de 2000 caracteres." : "";
        if (!value.trim() || !state.connected) stop();
        else {
          if (!localTyping || now() - lastStart >= 1000) {
            if (send("typing-start", { authorName: name() })) {
              localTyping = true;
              lastStart = now();
            }
          }
          clearTimer(stopTimer);
          stopTimer = setTimer(stop, 2000);
        }
        emit("draft");
      },
      submit() {
        const text = state.draft.trim();
        if (!text) return false;
        if (state.draft.length > 2000) {
          state.error = "Limite de 2000 caracteres.";
          emit("error");
          return false;
        }
        if (!state.connected) {
          state.error = "Chat desconectado. Aguarde a reconexão.";
          emit("error");
          return false;
        }
        sendTimes = sendTimes.filter((t) => t > now() - 5000);
        if (sendTimes.length >= 5) {
          state.error = "Aguarde alguns segundos antes de enviar outra mensagem.";
          emit("error");
          return false;
        }
        if (!send("chat-message", { text, authorName: name() })) {
          state.error = "Mensagem não enviada. Aguarde a reconexão.";
          emit("error");
          return false;
        }
        sendTimes.push(now());
        stop();
        state.draft = "";
        state.error = "";
        emit("draft");
        return true;
      },
      viewport(visible, nearBottom) {
        state.visible = !!visible;
        state.nearBottom = !!nearBottom;
        if (visible && nearBottom) state.unread = 0;
        emit("viewport");
      },
      receive(m) {
        if (!state.roomId || m.roomId !== state.roomId) return;
        if (m.type === "chat-message") {
          if (valid(m.payload) && m.from === m.payload.authorId) {
            stopRemote(m.from);
            insert([m.payload]);
          }
        } else if (m.type === "chat-history" && Array.isArray(m.payload?.messages)) {
          insert(m.payload.messages.slice(-50), true, historyReceived);
          historyReceived = true;
        } else if (m.type === "chat-error") {
          state.error =
            typeof m.payload?.text === "string"
              ? m.payload.text.slice(0, 200)
              : "Não foi possível enviar a mensagem.";
          emit("error");
        } else if (m.type === "leave") stopRemote(m.from);
        else if (m.type === "peers" && Array.isArray(m.payload?.peers)) {
          for (const id of typing.keys()) if (!m.payload.peers.includes(id)) stopRemote(id);
        } else if (m.type === "typing-stop") stopRemote(m.from);
        else if (
          m.type === "typing-start" &&
          m.from !== clientId &&
          typeof m.from === "string" &&
          m.from &&
          typeof m.payload?.authorName === "string"
        ) {
          if (!typing.has(m.from) && typing.size >= 128) return;
          clearTimer(typing.get(m.from)?.timer);
          typing.set(m.from, {
            name: m.payload.authorName.slice(0, 64) || "Convidado",
            timer: setTimer(() => stopRemote(m.from), 4000),
          });
          state.typing = [...typing].map(([id, e]) => ({ id, name: e.name }));
          emit("typing");
        }
      },
    };
  }
  root.createVoiceChat = createVoiceChat;
  if (typeof module !== "undefined") module.exports = createVoiceChat;
})(globalThis);
