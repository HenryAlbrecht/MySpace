/* One transport-independent endpoint. Perfect negotiation and purpose-labelled RTP. */
(function (root) {
  function createVoicePeer({
    localStream,
    screenStream = null,
    screenBitrate,
    mediaSettings,
    screenPreset,
    onMediaWarning = () => {},
    polite = true,
    send,
    onStream,
    onScreen = () => {},
    onState,
    onError,
    onIceState = () => {},
    Peer = root.RTCPeerConnection,
    Stream = root.MediaStream,
    Sender = root.RTCRtpSender,
    iceServers,
    iceTransportPolicy = "all",
    getIceConfiguration,
    recoveryOptions = {},
  }) {
    const ICE =
      root.PARTY_ICE || (typeof require === "function" ? require("./ice-config.js") : null);
    const network =
      root.PARTY_NETWORK || (typeof require === "function" ? require("./network.js") : null);
    const pc = new Peer({
      iceServers: iceServers || ICE.fallback().iceServers,
      iceTransportPolicy: ICE.policy(iceTransportPolicy),
    });
    const senders = new Map();
    const receivers = new Map();
    const candidates = [];
    const settingsAPI =
      root.PARTY_MEDIA_SETTINGS ||
      (typeof require === "function" ? require("./media-settings.js") : null);
    let settings = settingsAPI.normalize(mediaSettings);
    let preset = screenPreset || "1080p60";
    let tuning = Promise.resolve();
    let closed = false;
    let queue = Promise.resolve();
    let makingOffer = false;
    let ignoreOffer = false;
    let isSettingRemoteAnswerPending = false;
    let negotiationEnabled = false;
    let remoteMedia = null;
    let restartPending = false;
    let signalingAvailable = true;
    let remoteVoice = null;
    let remoteScreen = null;
    let bitrate = screenBitrate;
    const stable = () => !pc.signalingState || pc.signalingState === "stable";
    function run(action, reportError = true) {
      queue = queue
        .then(async () => {
          if (!closed) {
            await action();
          }
        })
        .catch((error) => {
          if (!closed) {
            if (reportError) {
              onError(error);
            } else {
              throw error;
            }
          }
        });
      return queue;
    }
    function attach(purpose, track, stream) {
      if (!track || senders.get(purpose)?.track === track) {
        return;
      }
      remove(purpose);
      const sender = pc.addTrack(track, stream);
      senders.set(purpose, { sender, track, stream });
      if (purpose === "screen-audio") {
        preferScreenOpus(sender);
      }
    }
    function preferScreenOpus(sender) {
      try {
        const transceiver = pc.getTransceivers?.().find((t) => t.sender === sender);
        const codecs = Sender?.getCapabilities?.("audio")?.codecs;
        if (
          !transceiver?.setCodecPreferences ||
          !codecs?.some((c) => c.mimeType.toLowerCase() === "audio/opus")
        ) {
          return;
        }
        // Reorder unmodified native capabilities, retaining every fallback codec.
        transceiver.setCodecPreferences([
          ...codecs.filter((c) => c.mimeType.toLowerCase() === "audio/opus"),
          ...codecs.filter((c) => c.mimeType.toLowerCase() !== "audio/opus"),
        ]);
      } catch {
        /* Unsupported preferences must leave browser defaults functional. */
      }
    }
    function remove(purpose) {
      const entry = senders.get(purpose);
      if (!entry) {
        return;
      }
      if (entry.sender) {
        pc.removeTrack(entry.sender);
      }
      senders.delete(purpose);
    }
    function attachScreen(stream) {
      settingsAPI.hint(stream?.getVideoTracks()[0], settings.screenContentHint);
      attach("screen-video", stream?.getVideoTracks()[0], stream);
      attach("screen-audio", stream?.getAudioTracks()[0], stream);
      if (!stream?.getVideoTracks().length) {
        remove("screen-video");
      }
      if (!stream?.getAudioTracks().length) {
        remove("screen-audio");
      }
    }
    (localStream.getAudioTracks?.() || localStream.getTracks()).forEach((track) =>
      attach("microphone", track, localStream),
    );
    attachScreen(screenStream);
    function tuneBitrate() {
      const task = tuning
        .then(async () => {
          if (closed || !stable()) {
            return;
          }
          const limits = settingsAPI.encoding(settings, preset);
          // Legacy callers may still supply the preset's recommended ceiling.
          if (settings["screenVideoBitrate"] === "recommended" && bitrate !== undefined) {
            limits["screen-video"] = bitrate;
          }
          for (const [purpose, entry] of senders) {
            const sender = entry.sender;
            if (!sender?.getParameters || !sender.setParameters) {
              onMediaWarning("Ajuste de bitrate não suportado neste navegador.");
              continue;
            }
            const transceiver = pc.getTransceivers?.().find((t) => t.sender === sender);
            if (
              transceiver &&
              (transceiver.mid === null ||
                ("currentDirection" in transceiver &&
                  !["sendonly", "sendrecv"].includes(transceiver.currentDirection)))
            ) {
              continue;
            }
            try {
              const params = sender.getParameters();
              if (!params.encodings?.length) {
                continue;
              }
              const value = limits[purpose];
              if (
                params.encodings.every((e) =>
                  value === null ? !("maxBitrate" in e) : e.maxBitrate === value,
                )
              ) {
                continue;
              }
              if (value === null) {
                delete params.encodings[0].maxBitrate;
              } else {
                params.encodings[0].maxBitrate = value;
              }
              await sender.setParameters(params);
            } catch {
              // Remove a previous microphone ceiling when a new request fails.
              if (purpose === "microphone") {
                try {
                  const automatic = sender.getParameters();
                  if (automatic.encodings?.length) {
                    delete automatic.encodings[0].maxBitrate;
                    await sender.setParameters(automatic);
                  }
                } catch {}
              }
              onMediaWarning(
                "O navegador não aplicou o teto de bitrate solicitado; a chamada continua.",
              );
            }
          }
        })
        .catch(() => {});
      tuning = task;
      return task;
    }
    function description() {
      const transceivers = pc.getTransceivers?.() || [];
      return {
        type: pc.localDescription.type,
        sdp: pc.localDescription.sdp,
        media: [...senders].map(([purpose, entry]) => ({
          purpose,
          trackId: entry.track.id,
          streamId: entry.stream.id,
          mid: transceivers.find((t) => t.sender === entry.sender)?.mid ?? null,
        })),
      };
    }
    async function offer() {
      if (!signalingAvailable || !negotiationEnabled || makingOffer || !stable()) {
        return;
      }
      try {
        makingOffer = true;
        const restarting = restartPending;
        restartPending = false;
        try {
          await pc.setLocalDescription(
            await pc.createOffer(restarting ? { iceRestart: true } : undefined),
          );
        } catch (error) {
          restartPending = restarting;
          throw error;
        }
        if (!closed) {
          send("offer", description());
        }
        void tuneBitrate();
      } finally {
        makingOffer = false;
      }
    }
    pc.onnegotiationneeded = () => {
      if (!closed && negotiationEnabled) {
        run(offer);
      }
    };
    pc.onicecandidate = ({ candidate }) => {
      if (!closed && candidate) {
        send("ice", candidate.toJSON ? candidate.toJSON() : candidate);
      }
    };
    const recovery = network.createRecovery({
      ...recoveryOptions,
      leader: !polite,
      onState,
      requestRestart: () => send("ice-restart-request", null),
      restart: () =>
        run(async () => {
          const config = getIceConfiguration
            ? await getIceConfiguration()
            : { iceServers: iceServers || ICE.fallback().iceServers };
          if (closed) {
            return;
          }
          if (pc.setConfiguration) {
            pc.setConfiguration({
              iceServers: config.iceServers,
              iceTransportPolicy: ICE.policy(iceTransportPolicy),
            });
          } else if (getIceConfiguration) {
            throw Error("ICE configuration refresh unsupported");
          }
          negotiationEnabled = true;
          restartPending = true;
          pc.restartIce?.();
          await offer();
        }, false),
    });
    const stateChanged = () => {
      if (!closed) {
        recovery.update(pc.connectionState, pc.iceConnectionState);
      }
    };
    pc.onconnectionstatechange = stateChanged;
    pc.oniceconnectionstatechange = () => {
      if (!closed) {
        onIceState(pc.iceConnectionState);
        stateChanged();
      }
    };
    pc.onicegatheringstatechange = stateChanged;
    pc.onsignalingstatechange = () => {
      stateChanged();
      if (!closed && restartPending && stable()) {
        run(offer);
      }
    };
    function sameTracks(a, tracks) {
      return (
        a &&
        a.getTracks().length === tracks.length &&
        tracks.every((t) => a.getTracks().includes(t))
      );
    }
    function publishRemote() {
      const byPurpose = new Map();
      for (const event of receivers.values()) {
        const mid = event.transceiver?.mid;
        const meta = remoteMedia?.find(
          (m) =>
            (m.mid !== null &&
              m.mid !== undefined &&
              mid !== null &&
              mid !== undefined &&
              String(m.mid) === String(mid)) ||
            (m.trackId && m.trackId === event.track.id),
        );
        // Compatibility with the audio-only protocol before purpose metadata.
        const purpose =
          meta?.purpose ||
          (remoteMedia === null && event.track.kind !== "video" ? "microphone" : null);
        if (purpose && event.track.readyState !== "ended") {
          byPurpose.set(purpose, event.track);
        }
      }
      const microphone = byPurpose.get("microphone");
      if (microphone && !sameTracks(remoteVoice, [microphone])) {
        remoteVoice = new Stream();
        remoteVoice.addTrack(microphone);
        onStream(remoteVoice);
      }
      const video = byPurpose.get("screen-video");
      const audio = byPurpose.get("screen-audio");
      const tracks = video ? [video, ...(audio ? [audio] : [])] : [];
      if (tracks.length && !sameTracks(remoteScreen, tracks)) {
        remoteScreen = new Stream();
        tracks.forEach((track) => remoteScreen.addTrack(track));
        onScreen(remoteScreen);
      } else if (!tracks.length && remoteScreen) {
        remoteScreen = null;
        onScreen(null);
      }
    }
    pc.ontrack = (event) => {
      if (closed) {
        return;
      }
      // Transceiver identity survives reassociation/rollback; its MID can change.
      receivers.set(event.transceiver || event.track, event);
      publishRemote();
    };
    async function addCandidate(candidate) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (error) {
        if (!ignoreOffer) {
          throw error;
        }
      }
    }
    return {
      diagnostics: () => network.getPeerConnectionDiagnostics(pc),
      retry: () => recovery.retry(),
      setSignalingAvailable(value) {
        const resumed = !signalingAvailable && !!value;
        signalingAvailable = !!value;
        recovery.setAvailable(value);
        if (resumed && pc.localDescription?.type === "offer" && !stable()) {
          send("offer", description());
        }
        if (resumed && restartPending && stable()) {
          run(offer);
        }
      },
      start: () => {
        negotiationEnabled = true;
        return run(offer);
      },
      async replaceMicrophone(stream) {
        const entry = senders.get("microphone");
        const track = stream?.getAudioTracks()[0];
        if (closed) {
          return;
        }
        if (!entry || !track || track.kind !== "audio") {
          throw Error("Microphone sender unavailable");
        }
        // Same-kind replacement preserves the negotiated sender/transceiver.
        await entry.sender.replaceTrack(track);
        if (!closed) {
          entry.track = track;
          entry.stream = stream;
        }
      },
      setMediaSettings(value, capturePreset = preset) {
        settings = settingsAPI.normalize(value);
        preset = capturePreset;
        bitrate = undefined;
        settingsAPI.hint(senders.get("screen-video")?.track, settings.screenContentHint);
        return tuneBitrate();
      },
      setScreen(stream, maxBitrate) {
        return run(async () => {
          bitrate = maxBitrate;
          attachScreen(stream);
          void tuneBitrate();
        });
      },
      receive: (type, payload) =>
        run(async () => {
          if (type === "ice-restart-request") {
            recovery.requested();
            return;
          }
          if (type === "ice") {
            if (ignoreOffer) {
              return;
            }
            if (!pc.remoteDescription) {
              candidates.push(payload);
            } else {
              await addCandidate(payload);
            }
            return;
          }
          if (
            !["offer", "answer"].includes(type) ||
            !payload ||
            payload.type !== type ||
            typeof payload.sdp !== "string"
          ) {
            return;
          }
          const readyForOffer = !makingOffer && (stable() || isSettingRemoteAnswerPending);
          const collision = type === "offer" && !readyForOffer;
          ignoreOffer = !polite && collision;
          if (ignoreOffer) {
            candidates.length = 0;
            return;
          }
          negotiationEnabled = true;
          isSettingRemoteAnswerPending = type === "answer";
          // A remote restart also needs fresh credentials on the answering side.
          if (type === "offer" && getIceConfiguration) {
            const config = await getIceConfiguration();
            if (closed) {
              return;
            }
            if (pc.setConfiguration) {
              pc.setConfiguration({
                iceServers: config.iceServers,
                iceTransportPolicy: ICE.policy(iceTransportPolicy),
              });
            }
          }
          const previousMedia = remoteMedia;
          try {
            remoteMedia = Array.isArray(payload.media)
              ? payload.media.filter(
                  (m) => m && ["microphone", "screen-video", "screen-audio"].includes(m.purpose),
                )
              : null;
            // Native setRemoteDescription performs implicit rollback for the polite peer.
            await pc.setRemoteDescription({ type, sdp: payload.sdp });
          } catch (error) {
            remoteMedia = previousMedia;
            throw error;
          } finally {
            isSettingRemoteAnswerPending = false;
          }
          if (closed) {
            return;
          }
          publishRemote();
          while (!closed && candidates.length) {
            await addCandidate(candidates.shift());
          }
          if (type === "offer") {
            await pc.setLocalDescription(await pc.createAnswer());
            if (!closed) {
              send("answer", description());
            }
          }
          // Optional encoder tuning never blocks essential SDP processing/recovery.
          void tuneBitrate();
          // A polite rollback can leave script-created senders without an m-line.
          // The answer cannot add m-lines to the remote offer. Negotiate these
          // still-pending local tracks now, after sending the answer, without timers.
          if (
            type === "offer" &&
            pc.getTransceivers &&
            [...senders.values()].some((entry) => {
              const transceiver = pc.getTransceivers().find((t) => t.sender === entry.sender);
              return transceiver && transceiver.mid === null;
            })
          ) {
            await offer();
          }
        }),
      close() {
        if (closed) {
          return;
        }
        closed = true;
        recovery.close();
        candidates.length = 0;
        senders.clear();
        pc.onicecandidate =
          pc.ontrack =
          pc.onconnectionstatechange =
          pc.oniceconnectionstatechange =
          pc.onnegotiationneeded =
          pc.onicegatheringstatechange =
          pc.onsignalingstatechange =
            null;
        pc.close();
        for (const event of receivers.values()) {
          event.track.stop();
        }
        receivers.clear();
        remoteVoice = remoteScreen = null;
      },
    };
  }
  root.createVoicePeer = createVoicePeer;
  if (typeof module !== "undefined") {
    module.exports = createVoicePeer;
  }
})(globalThis);
