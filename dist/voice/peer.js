/* One transport-independent endpoint. Perfect negotiation and purpose-labelled RTP. */
(function (root) {
  function createVoicePeer({ localStream, screenStream = null, screenBitrate, polite = true, send, onStream,
    onScreen = () => {}, onState, onError, onIceState = () => {}, Peer = root.RTCPeerConnection,
    Stream = root.MediaStream, Sender = root.RTCRtpSender, iceServers = [] }) {
    const pc = new Peer({ iceServers });
    const senders = new Map(), receivers = new Map(), candidates = [];
    const audioTuning = new WeakSet();
    let closed = false, queue = Promise.resolve(), makingOffer = false, ignoreOffer = false;
    let isSettingRemoteAnswerPending = false, negotiationEnabled = false, remoteMedia = null;
    let remoteVoice = null, remoteScreen = null, bitrate = screenBitrate;
    const stable = () => !pc.signalingState || pc.signalingState === 'stable';
    function run(action) {
      queue = queue.then(async () => { if (!closed) await action(); }).catch(error => { if (!closed) onError(error); });
      return queue;
    }
    function attach(purpose, track, stream) {
      if (!track || senders.get(purpose)?.track === track) return;
      remove(purpose);
      const sender = pc.addTrack(track, stream);
      senders.set(purpose, { sender, track, stream });
      if (purpose === 'screen-audio') preferScreenOpus(sender);
    }
    function preferScreenOpus(sender) {
      try {
        const transceiver = pc.getTransceivers?.().find(t => t.sender === sender);
        const codecs = Sender?.getCapabilities?.('audio')?.codecs;
        if (!transceiver?.setCodecPreferences || !codecs?.some(c => c.mimeType.toLowerCase() === 'audio/opus')) return;
        // Reorder unmodified native capabilities, retaining every fallback codec.
        transceiver.setCodecPreferences([...codecs.filter(c => c.mimeType.toLowerCase() === 'audio/opus'), ...codecs.filter(c => c.mimeType.toLowerCase() !== 'audio/opus')]);
      } catch { /* Unsupported preferences must leave browser defaults functional. */ }
    }
    function remove(purpose) {
      const entry = senders.get(purpose);
      if (!entry) return;
      if (entry.sender) pc.removeTrack(entry.sender);
      senders.delete(purpose);
    }
    function attachScreen(stream) {
      attach('screen-video', stream?.getVideoTracks()[0], stream);
      attach('screen-audio', stream?.getAudioTracks()[0], stream);
      if (!stream?.getVideoTracks().length) remove('screen-video');
      if (!stream?.getAudioTracks().length) remove('screen-audio');
    }
    (localStream.getAudioTracks?.() || localStream.getTracks()).forEach(track => attach('microphone', track, localStream));
    attachScreen(screenStream);
    async function tuneBitrate() {
      const sender = senders.get('screen-video')?.sender;
      if (!sender?.getParameters || !sender.setParameters || !bitrate) return;
      if (!stable()) return;
      const transceiver = pc.getTransceivers?.().find(t => t.sender === sender);
      if (transceiver && (transceiver.mid === null || ('currentDirection' in transceiver && !['sendonly','sendrecv'].includes(transceiver.currentDirection)))) return;
      try {
        const params = sender.getParameters();
        if (!params.encodings?.length) return;
        params.encodings.forEach(encoding => { encoding.maxBitrate = bitrate; });
        await sender.setParameters(params);
      } catch { /* Best effort only: browser/codec policy must not stop a share. */ }
    }
    async function tuneScreenAudio() {
      const sender = senders.get('screen-audio')?.sender;
      if (!sender?.getParameters || !sender.setParameters || !stable() || audioTuning.has(sender)) return;
      const transceiver = pc.getTransceivers?.().find(t => t.sender === sender);
      if (transceiver && (transceiver.mid === null || ('currentDirection' in transceiver && !['sendonly','sendrecv'].includes(transceiver.currentDirection)))) return;
      audioTuning.add(sender);
      try {
        const parameters = sender.getParameters();
        if (!parameters.encodings?.length || parameters.encodings.every(e => e.maxBitrate === 192000)) return;
        parameters.encodings.forEach(encoding => { encoding.maxBitrate = 192000; });
        // Standard writable encoding field only. Codec/fmtp/channels are read-only;
        // obsolete DTX fields and SDP rewriting would not be portable.
        await sender.setParameters(parameters);
      } catch { /* A browser may reject/limit tuning; never block essential SDP. */ }
      finally { audioTuning.delete(sender); }
    }
    function description() {
      const transceivers = pc.getTransceivers?.() || [];
      return { type:pc.localDescription.type, sdp:pc.localDescription.sdp,
        media:[...senders].map(([purpose, entry]) => ({ purpose, trackId:entry.track.id,
          streamId:entry.stream.id, mid:transceivers.find(t => t.sender === entry.sender)?.mid ?? null })) };
    }
    async function offer() {
      if (!negotiationEnabled || makingOffer || !stable()) return;
      try {
        makingOffer = true;
        await pc.setLocalDescription(await pc.createOffer());
        if (!closed) send('offer', description());
        void tuneBitrate();
        void tuneScreenAudio();
      } finally { makingOffer = false; }
    }
    pc.onnegotiationneeded = () => { if (!closed && negotiationEnabled) run(offer); };
    pc.onicecandidate = ({ candidate }) => { if (!closed && candidate) send('ice', candidate.toJSON ? candidate.toJSON() : candidate); };
    pc.onconnectionstatechange = () => { if (!closed) onState(pc.connectionState); };
    pc.oniceconnectionstatechange = () => { if (!closed) onIceState(pc.iceConnectionState); };
    function sameTracks(a, tracks) { return a && a.getTracks().length === tracks.length && tracks.every(t => a.getTracks().includes(t)); }
    function publishRemote() {
      const byPurpose = new Map();
      for (const event of receivers.values()) {
        const mid = event.transceiver?.mid;
        const meta = remoteMedia?.find(m => (m.mid !== null && m.mid !== undefined && mid !== null && mid !== undefined && String(m.mid) === String(mid)) || (m.trackId && m.trackId === event.track.id));
        // Compatibility with the audio-only protocol before purpose metadata.
        const purpose = meta?.purpose || (remoteMedia === null && event.track.kind !== 'video' ? 'microphone' : null);
        if (purpose && event.track.readyState !== 'ended') byPurpose.set(purpose, event.track);
      }
      const microphone = byPurpose.get('microphone');
      if (microphone && !sameTracks(remoteVoice, [microphone])) {
        remoteVoice = new Stream(); remoteVoice.addTrack(microphone); onStream(remoteVoice);
      }
      const video = byPurpose.get('screen-video'), audio = byPurpose.get('screen-audio');
      const tracks = video ? [video, ...(audio ? [audio] : [])] : [];
      if (tracks.length && !sameTracks(remoteScreen, tracks)) {
        remoteScreen = new Stream(); tracks.forEach(track => remoteScreen.addTrack(track)); onScreen(remoteScreen);
      } else if (!tracks.length && remoteScreen) { remoteScreen = null; onScreen(null); }
    }
    pc.ontrack = event => {
      if (closed) return;
      // Transceiver identity survives reassociation/rollback; its MID can change.
      receivers.set(event.transceiver || event.track, event);
      publishRemote();
    };
    async function addCandidate(candidate) {
      try { await pc.addIceCandidate(candidate); } catch (error) { if (!ignoreOffer) throw error; }
    }
    return {
      start: () => { negotiationEnabled = true; return run(offer); },
      async replaceMicrophone(stream) {
        const entry = senders.get('microphone'), track = stream?.getAudioTracks()[0];
        if (closed) return;
        if (!entry || !track || track.kind !== 'audio') throw Error('Microphone sender unavailable');
        // Same-kind replacement preserves the negotiated sender/transceiver.
        await entry.sender.replaceTrack(track);
        if (!closed) { entry.track = track; entry.stream = stream; }
      },
      setScreen(stream, maxBitrate) { return run(async () => { bitrate = maxBitrate; attachScreen(stream); void tuneBitrate(); void tuneScreenAudio(); }); },
      receive: (type, payload) => run(async () => {
        if (type === 'ice') {
          if (ignoreOffer) return;
          if (!pc.remoteDescription) candidates.push(payload);
          else await addCandidate(payload);
          return;
        }
        if (!['offer','answer'].includes(type) || !payload || payload.type !== type || typeof payload.sdp !== 'string') return;
        const readyForOffer = !makingOffer && (stable() || isSettingRemoteAnswerPending);
        const collision = type === 'offer' && !readyForOffer;
        ignoreOffer = !polite && collision;
        if (ignoreOffer) { candidates.length = 0; return; }
        negotiationEnabled = true;
        isSettingRemoteAnswerPending = type === 'answer';
        const previousMedia = remoteMedia;
        try {
          remoteMedia = Array.isArray(payload.media) ? payload.media.filter(m => m && ['microphone','screen-video','screen-audio'].includes(m.purpose)) : null;
          // Native setRemoteDescription performs implicit rollback for the polite peer.
          await pc.setRemoteDescription({ type, sdp:payload.sdp });
        } catch (error) { remoteMedia = previousMedia; throw error; }
        finally { isSettingRemoteAnswerPending = false; }
        if (closed) return;
        publishRemote();
        while (!closed && candidates.length) await addCandidate(candidates.shift());
        if (type === 'offer') {
          await pc.setLocalDescription(await pc.createAnswer());
          if (!closed) send('answer', description());
        }
        // Optional encoder tuning never blocks essential SDP processing/recovery.
        void tuneBitrate();
        void tuneScreenAudio();
        // A polite rollback can leave script-created senders without an m-line.
        // The answer cannot add m-lines to the remote offer. Negotiate these
        // still-pending local tracks now, after sending the answer, without timers.
        if (type === 'offer' && pc.getTransceivers && [...senders.values()].some(entry => {
          const transceiver = pc.getTransceivers().find(t => t.sender === entry.sender);
          return transceiver && transceiver.mid === null;
        })) await offer();
      }),
      close() {
        if (closed) return;
        closed = true; candidates.length = 0; senders.clear();
        pc.onicecandidate = pc.ontrack = pc.onconnectionstatechange = pc.oniceconnectionstatechange = pc.onnegotiationneeded = null;
        pc.close();
        for (const event of receivers.values()) event.track.stop();
        receivers.clear(); remoteVoice = remoteScreen = null;
      },
    };
  }
  root.createVoicePeer = createVoicePeer;
  if (typeof module !== 'undefined') module.exports = createVoicePeer;
})(globalThis);
