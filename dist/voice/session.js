/* Coordinates a mesh of independent peers; browser resources stay in this Map. */
(function (root) {
  function createVoiceSession({
    clientId,
    signaling = root.createLocalVoiceSignaling,
    peer = root.createVoicePeer,
    onPeers,
    onStream,
    onScreen = () => {},
    onRemove,
    onError,
    onStatus = () => {},
    onApplication = () => {},
    onMediaWarning = () => {},
    getIceConfiguration,
    iceTransportPolicy = "all",
  }) {
    let transport;
    let stream;
    let screenStream = null;
    let screenBitrate;
    let micMuted = false;
    let generation = 0;
    let switching = false;
    let mediaSettings;
    let screenPreset;
    const network =
      root.PARTY_NETWORK || (typeof require === "function" ? require("./network.js") : null);
    let signalingAvailable = true;
    const deferred = new Set();
    let deferredMessages = [];
    const peers = new Map();
    const notify = () =>
      onPeers(
        [...peers].map(([id, entry]) => ({
          id,
          status: entry.status,
          iceState: entry.iceState,
          micMuted: !!entry.micMuted,
        })),
      );
    function remove(id) {
      const entry = peers.get(id);
      if (!entry) {
        return;
      }
      root.clearTimeout(entry.membershipTimer);
      entry.controller?.close();
      peers.delete(id);
      onRemove(id);
      notify();
    }
    function ensurePeer(from) {
      if (!stream || typeof from !== "string" || !from || from === clientId || peers.has(from)) {
        return;
      }
      if (switching) {
        deferred.add(from);
        return;
      }
      const entry = { status: "conectando", iceState: "new", pending: [] };
      const epoch = generation;
      peers.set(from, entry);
      const build = (config) => {
        if (epoch !== generation || peers.get(from) !== entry || !stream) {
          return;
        }
        try {
          entry.controller = peer({
            ...config,
            getIceConfiguration,
            iceTransportPolicy,
            localStream: stream,
            screenStream,
            screenBitrate,
            mediaSettings,
            screenPreset,
            onMediaWarning,
            polite: clientId > from,
            send: (type, data) => {
              if (peers.get(from) === entry) {
                transport?.send(type, from, data);
              }
            },
            onStream: (remote) => {
              if (peers.get(from) === entry) {
                onStream(from, remote);
              }
            },
            onScreen: (remote) => {
              if (peers.get(from) !== entry) {
                return;
              }
              entry.remoteShare = remote
                ? {
                    stream: remote,
                    videoTrack: remote.getVideoTracks()[0],
                    audioTrack: remote.getAudioTracks()[0] || null,
                    state: "ativo",
                  }
                : null;
              onScreen(from, remote);
            },
            onState: (state) => {
              if (peers.get(from) !== entry) {
                return;
              }
              entry.status =
                state === "connected"
                  ? "conectado"
                  : state === "failed"
                    ? "falha"
                    : ["disconnected", "reconnecting"].includes(state)
                      ? "reconectando"
                      : "conectando";
              notify();
            },
            onIceState: (state) => {
              if (peers.get(from) === entry) {
                entry.iceState = state;
                notify();
              }
            },
            onError: (error) => {
              if (peers.get(from) === entry) {
                entry.status = "falha";
                notify(); /* The participant row owns the contextual failure/retry UX. */
              }
            },
          });
        } catch (error) {
          entry.status = "falha";
          notify();
          return;
        }
        notify();
        transport?.send("participant-state", from, { micMuted });
        entry.controller.setSignalingAvailable?.(signalingAvailable);
        if (clientId < from) {
          entry.controller.start();
        }
        const messages = entry.pending;
        entry.pending = [];
        messages.forEach(receive);
      };
      if (getIceConfiguration) {
        getIceConfiguration()
          .then(build)
          .catch(() => {
            if (peers.get(from) === entry) {
              entry.status = "falha";
              notify();
            }
          });
      } else {
        build({});
      }
    }
    function retainTemporarily(id) {
      const entry = peers.get(id);
      if (!entry || entry.membershipTimer) {
        return;
      }
      entry.membershipTimer = root.setTimeout(() => {
        entry.membershipTimer = null;
        if (entry.status === "conectado") {
          retainTemporarily(id);
        } else {
          remove(id);
        }
      }, network.TIMING.membershipGraceMs);
    }
    function seen(id) {
      const entry = peers.get(id);
      if (entry) {
        root.clearTimeout(entry.membershipTimer);
        entry.membershipTimer = null;
      }
    }
    function receive(message) {
      const { from, type, payload } = message;
      if (
        ["chat-message", "chat-history", "chat-error", "typing-start", "typing-stop"].includes(type)
      ) {
        onApplication(message);
        return;
      }
      if (type === "leave" || type === "peers") {
        onApplication(message);
      }
      if (type === "peers") {
        if (
          !Array.isArray(payload?.peers) ||
          payload.peers.some((id) => typeof id !== "string" || !id)
        ) {
          return;
        }
        const present = new Set(payload.peers.filter((id) => id !== clientId));
        for (const id of deferred) {
          if (!present.has(id)) {
            deferred.delete(id);
          }
        }
        deferredMessages = deferredMessages.filter((m) => present.has(m.from));
        for (const id of [...peers.keys()]) {
          if (!present.has(id)) {
            retainTemporarily(id);
          }
        }
        for (const id of present) {
          seen(id);
          ensurePeer(id);
        }
        return;
      }
      if (type === "leave" && payload?.reason === "signaling-disconnected") {
        retainTemporarily(from);
        return;
      }
      if (type === "leave") {
        deferred.delete(from);
        deferredMessages = deferredMessages.filter((m) => m.from !== from);
        remove(from);
        return;
      }
      if (deferred.has(from) && ["offer", "answer", "ice", "participant-state"].includes(type)) {
        deferredMessages.push(message);
        return;
      }
      const waiting = peers.get(from);
      if (
        waiting &&
        !waiting.controller &&
        ["offer", "answer", "ice", "participant-state", "ice-restart-request"].includes(type)
      ) {
        if (waiting.pending.length < 128) {
          waiting.pending.push(message);
        }
        return;
      }
      if (type === "participant-state") {
        const entry = peers.get(from);
        if (entry && typeof payload?.micMuted === "boolean") {
          entry.micMuted = payload.micMuted;
          notify();
        }
        return;
      }
      if (type === "join") {
        seen(from);
        const existed = peers.has(from);
        // Acknowledge discovery before sending state: the new BC client must
        // know this peer before it can associate its mute metadata.
        if (!existed && stream && from !== clientId && !payload?.reply) {
          transport.send("join", from, { reply: true });
        }
        ensurePeer(from);
        if (peers.has(from)) {
          transport?.send("participant-state", from, { micMuted });
        }
      } else if (["offer", "answer", "ice", "ice-restart-request"].includes(type)) {
        peers.get(from)?.controller?.receive(type, payload);
      }
    }
    function close() {
      generation++;
      switching = false;
      deferred.clear();
      deferredMessages = [];
      transport?.send("leave");
      transport?.close();
      transport = null;
      for (const id of [...peers.keys()]) {
        remove(id);
      }
      stream = null;
      screenStream = null;
    }
    return {
      start(localStream, roomId, muted = false) {
        close();
        stream = localStream;
        micMuted = muted;
        try {
          transport = signaling({
            clientId,
            roomId,
            onMessage: receive,
            onStatus: (status) => {
              signalingAvailable = status === "conectado";
              for (const entry of peers.values()) {
                entry.controller?.setSignalingAvailable?.(signalingAvailable);
              }
              onStatus(status);
            },
          });
          transport.send("join", undefined, { reply: false });
        } catch (error) {
          close();
          throw error;
        }
      },
      close,
      retry(id) {
        const entry = peers.get(id);
        if (!entry) {
          return;
        }
        if (entry.controller) {
          entry.controller.retry?.();
        } else {
          remove(id);
          ensurePeer(id);
        }
      },
      async diagnostics() {
        return Promise.all(
          [...peers].map(async ([id, entry]) => ({
            id,
            status: entry.status,
            ...(await entry.controller?.diagnostics?.()),
          })),
        );
      },
      sendApplication(type, payload) {
        if (!["chat-message", "typing-start", "typing-stop"].includes(type)) {
          return false;
        }
        return transport?.send(type, undefined, payload) === true;
      },
      setMuted(value) {
        micMuted = !!value;
        transport?.send("participant-state", undefined, { micMuted });
      },
      async replaceMicrophone(next) {
        if (!stream || switching) {
          throw Error("Microphone change unavailable");
        }
        const previous = stream;
        const epoch = generation;
        const entries = [...peers];
        switching = true;
        try {
          const results = await Promise.allSettled(
            entries.map(([, e]) => e.controller?.replaceMicrophone(next)),
          );
          if (epoch !== generation) {
            throw Error("Call ended during microphone change");
          }
          if (results.some((r) => r.status === "rejected")) {
            // Restore every surviving sender; a failed native rollback rebuilds only that pair.
            const rollback = await Promise.allSettled(
              entries.map(([id, e]) =>
                peers.get(id) === e ? e.controller?.replaceMicrophone(previous) : undefined,
              ),
            );
            if (epoch !== generation) {
              throw Error("Call ended during microphone rollback");
            }
            rollback.forEach((r, i) => {
              if (r.status === "rejected") {
                const id = entries[i][0];
                remove(id);
                deferred.add(id);
              }
            });
            throw Error(
              "Não foi possível trocar o microfone em todos os peers. O anterior foi mantido.",
            );
          }
          stream = next;
        } finally {
          if (epoch === generation) {
            switching = false;
            const ids = [...deferred];
            deferred.clear();
            ids.forEach(ensurePeer);
            const messages = deferredMessages;
            deferredMessages = [];
            messages.forEach(receive);
          }
        }
      },
      async setMediaSettings(value, preset) {
        mediaSettings = value;
        screenPreset = preset;
        screenBitrate = undefined;
        await Promise.all(
          [...peers.values()].map((entry) => entry.controller?.setMediaSettings?.(value, preset)),
        );
      },
      setScreen(localScreen, maxBitrate) {
        screenStream = localScreen;
        screenBitrate = maxBitrate;
        for (const entry of peers.values()) {
          entry.controller?.setScreen(localScreen, maxBitrate);
        }
      },
    };
  }
  root.createVoiceSession = createVoiceSession;
  if (typeof module !== "undefined") {
    module.exports = createVoiceSession;
  }
})(globalThis);
