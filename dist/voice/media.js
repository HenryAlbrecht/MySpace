/* Local capture only. No audio playback, peers or network transport. */
(function (root) {
  function createVoiceMedia({ mediaDevices = root.navigator?.mediaDevices, secureContext = root.isSecureContext } = {}) {
    return {
      async acquire() {
        if (secureContext === false) throw Object.assign(new Error('HTTPS required'), { name: 'InsecureContextError' });
        if (!mediaDevices?.getUserMedia) throw Object.assign(new Error('Unavailable'), { name: 'MediaUnavailableError' });
        return mediaDevices.getUserMedia({ audio: true });
      },
      release(stream) { stream?.getTracks().forEach(track => track.stop()); },
      mute(stream, muted) { stream?.getAudioTracks().forEach(track => { track.enabled = !muted; }); },
    };
  }
  root.createVoiceMedia = createVoiceMedia;
  if (typeof module !== 'undefined') module.exports = createVoiceMedia;
})(globalThis);
