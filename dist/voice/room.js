/* Room owns one signaling connection. Call borrows it without owning its lifetime. */
(function (root) {
  function createPartyRoom({
    clientId,
    signaling,
    getMetadata,
    onChange = () => {},
    onApplication = () => {},
    onStatus = () => {},
    onError = () => {},
  }) {
    const api =
      root.PARTY_ROOM ||
      (typeof require === "function" ? require("./room-metadata.js") : null);
    const state = {
      roomId: null,
      name: "geral",
      participants: [],
      status: "fora da sala",
    };
    let transport = null;
    let metadata = null;
    let call = null;
    let callWanted = false;
    let generation = 0;
    const pending = new Map();
    let sequence = 0;
    const ICE =
      root.PARTY_ICE ||
      (typeof require === "function" ? require("./ice-config.js") : null);
    const cache = ICE.createCache({
      request: () =>
        new Promise((resolve, reject) => {
          if (!transport) {
            return reject(Error("Signaling unavailable"));
          }
          if (transport.local) {
            return resolve(ICE.fallback());
          }
          const requestId = "ice-" + ++sequence;
          const timer = root.setTimeout(() => {
            pending.delete(requestId);
            reject(Error("ICE request timeout"));
          }, 8000);
          const item = {
            resolve,
            reject,
            timer,
            sent: false,
            send() {
              if (!item.sent) {
                item.sent =
                  transport?.send("ice-config-request", undefined, {
                    requestId,
                  }) === true;
              }
            },
          };
          pending.set(requestId, item);
          item.send();
        }),
    });
    const notify = () => onChange(state);
    function receive(message) {
      if (message.roomId !== state.roomId) {
        return;
      }
      if (message.type === "ice-config") {
        const item = pending.get(message.payload?.requestId);
        if (!item) {
          return;
        }
        pending.delete(message.payload.requestId);
        root.clearTimeout(item.timer);
        if (message.payload.error) {
          item.reject(Error("ICE request unavailable"));
        } else {
          item.resolve(message.payload);
        }
        return;
      }
      if (message.type === "presence-snapshot") {
        if (
          !Array.isArray(message.payload?.participants) ||
          message.payload.participants.length > api.MAX_PARTICIPANTS
        ) {
          return;
        }
        const participants = new Map();
        for (const item of message.payload.participants) {
          const data = api.metadata(item, { allowHttp: true });
          if (
            !data ||
            !(
              typeof item.clientId === "string" &&
              item.clientId.length > 0 &&
              item.clientId.length <= 128
            ) ||
            typeof item.inCall !== "boolean"
          ) {
            continue;
          }
          participants.set(item.clientId, {
            clientId: item.clientId,
            ...data,
            inCall: item.inCall,
          });
        }
        const name = api.roomName(message.payload.roomName ?? "geral");
        if (name !== null) {
          state.name = name;
        }
        state.participants = [...participants.values()];
        notify();
        return;
      }
      if (message.type === "presence-error") {
        onError(message.payload?.text || "Não foi possível entrar na sala.");
        return;
      }
      call?.onMessage(message);
      onApplication(message);
    }
    function status(value) {
      state.status = value;
      if (value === "conectado") {
        for (const item of pending.values()) {
          item.send();
        }
      }
      if (value === "desconectado" || value === "erro de signaling") {
        state.participants = [];
      }
      call?.onStatus(value);
      onStatus(value);
      notify();
    }
    function leave() {
      cache.clear();
      for (const item of pending.values()) {
        root.clearTimeout(item.timer);
        item.reject(Error("Room left"));
      }
      pending.clear();
      generation++;
      callWanted = false;
      call = null;
      transport?.send("presence-leave");
      transport?.close();
      transport = null;
      Object.assign(state, {
        roomId: null,
        name: "geral",
        participants: [],
        status: "fora da sala",
      });
      notify();
    }
    async function enter(roomId) {
      if (state.roomId === roomId && transport) {
        return;
      }
      leave();
      if (!api.validRoomId(roomId)) {
        onError("Link de sala inválido.");
        return;
      }
      const epoch = ++generation;
      try {
        metadata = api.metadata(await getMetadata(), { allowHttp: true }) || {
          displayName: "Convidado",
          avatar: "",
        };
        if (epoch !== generation) {
          return;
        }
        state.roomId = roomId;
        state.status = "conectando";
        notify();
        transport = signaling({
          clientId,
          roomId,
          onMessage: (m) => {
            if (epoch === generation) {
              receive(m);
            }
          },
          onStatus: (v) => {
            if (epoch === generation) {
              status(v);
            }
          },
        });
        transport.send("presence-join", undefined, metadata);
      } catch (error) {
        if (epoch === generation) {
          state.roomId = null;
          state.status = "erro de signaling";
          onError(error.message);
          notify();
        }
      }
    }
    return {
      state,
      enter,
      leave,
      getIceConfiguration: () => cache.get(),
      rename(name) {
        const next = api.roomName(name);
        return (
          next !== null &&
          !!state.roomId &&
          transport?.send("room-rename", undefined, { name: next }) === true
        );
      },
      updatePresence(value) {
        const next = api.presence(value);
        if (!next || !transport) {
          return false;
        }
        metadata = { ...metadata, ...next };
        return transport.send("presence-update", undefined, metadata) === true;
      },
      sendApplication(type, payload) {
        if (
          !state.roomId ||
          !["chat-message", "typing-start", "typing-stop"].includes(type)
        ) {
          return false;
        }
        return transport?.send(type, undefined, payload) === true;
      },
      update(value) {
        const next = api.metadata(value, { allowHttp: true });
        if (!next) {
          return false;
        }
        metadata = next;
        return transport?.send("presence-update", undefined, next) === true;
      },
      callTransport(options) {
        if (!transport || state.roomId !== options.roomId) {
          throw Error("Entre na sala antes da chamada.");
        }
        call = options;
        options.onStatus(state.status);
        return {
          send(type, to, payload) {
            if (type === "join" && !to) {
              callWanted = true;
            }
            if (type === "leave") {
              callWanted = false;
            }
            return transport?.send(type, to, payload) === true;
          },
          close() {
            callWanted = false;
            if (call === options) {
              call = null;
            }
          },
        };
      },
      get inCall() {
        return callWanted;
      },
    };
  }
  root.createPartyRoom = createPartyRoom;
  if (typeof module !== "undefined") {
    module.exports = createPartyRoom;
  }
})(globalThis);
