/* Transport-independent WebRTC endpoint. Signaling arrives through callbacks. */
(function (root) {
  function createVoicePeer({ localStream, send, onStream, onState, onError, Peer = root.RTCPeerConnection, Stream = root.MediaStream, iceServers = [] }) {
    const pc = new Peer({ iceServers });
    let closed = false, queue = Promise.resolve();
    const candidates = [];
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    pc.onicecandidate = ({ candidate }) => { if (!closed && candidate) send('ice', candidate.toJSON ? candidate.toJSON() : candidate); };
    pc.onconnectionstatechange = () => { if (!closed) onState(pc.connectionState); };
    const remote = new Stream();
    pc.ontrack = ({ track }) => {
      if (closed) return;
      if (!remote.getTracks().includes(track)) remote.addTrack(track);
      onStream(remote);
    };
    function run(action) {
      queue = queue.then(async () => { if (!closed) await action(); }).catch(error => { if (!closed) onError(error); });
      return queue;
    }
    async function flush() { while (!closed && candidates.length) await pc.addIceCandidate(candidates.shift()); }
    const description = () => ({ type:pc.localDescription.type, sdp:pc.localDescription.sdp });
    return {
      start: () => run(async () => {
        await pc.setLocalDescription(await pc.createOffer());
        if (!closed) send('offer', description());
      }),
      receive: (type, payload) => run(async () => {
        if (type === 'ice') {
          if (!pc.remoteDescription) candidates.push(payload);
          else await pc.addIceCandidate(payload);
        } else if (type === 'offer' || type === 'answer') {
          await pc.setRemoteDescription(payload);
          if (closed) return;
          await flush();
          if (type === 'offer') {
            await pc.setLocalDescription(await pc.createAnswer());
            if (!closed) send('answer', description());
          }
        }
      }),
      close() {
        if (closed) return;
        closed = true; candidates.length = 0;
        pc.onicecandidate = pc.ontrack = pc.onconnectionstatechange = null;
        pc.close(); remote.getTracks().forEach(track => track.stop());
      },
    };
  }
  root.createVoicePeer = createVoicePeer;
  if (typeof module !== 'undefined') module.exports = createVoicePeer;
})(globalThis);
