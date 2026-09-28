/* Local capture only. No audio playback, peers or network transport. */
(function (root) {
  const presets = {
    '720p60': { width:1280, height:720, frameRate:60, maxBitrate:4000000 },
    '1080p30': { width:1920, height:1080, frameRate:30, maxBitrate:6000000 },
    '1080p60': { width:1920, height:1080, frameRate:60, maxBitrate:10000000 },
    '1440p60': { width:2560, height:1440, frameRate:60, maxBitrate:14000000 },
  };
  function createVoiceMedia({ mediaDevices = root.navigator?.mediaDevices, secureContext = root.isSecureContext } = {}) {
    return {
      async acquire() {
        if (secureContext === false) throw Object.assign(new Error('HTTPS required'), { name: 'InsecureContextError' });
        if (!mediaDevices?.getUserMedia) throw Object.assign(new Error('Unavailable'), { name: 'MediaUnavailableError' });
        return mediaDevices.getUserMedia({ audio: true });
      },
      async acquireScreen(preset = '1080p60') {
        if (secureContext === false) throw Object.assign(new Error('HTTPS required'), { name:'InsecureContextError' });
        if (!mediaDevices?.getDisplayMedia) throw Object.assign(new Error('Screen capture unavailable'), { name:'DisplayUnavailableError' });
        const quality = presets[preset] || presets['1080p60'];
        const stream = await mediaDevices.getDisplayMedia({ video:{ width:{ideal:quality.width}, height:{ideal:quality.height}, frameRate:{ideal:quality.frameRate,max:quality.frameRate} }, audio:true });
        const video = stream.getVideoTracks()[0];
        if (!video || video.readyState === 'ended') {
          stream.getTracks().forEach(track => track.stop());
          throw Object.assign(new Error('No display video'), {name:'DisplayVideoMissingError'});
        }
        try { if ('contentHint' in video) video.contentHint = 'detail'; } catch { }
        return stream;
      },
      release(stream) { stream?.getTracks().forEach(track => track.stop()); },
      mute(stream, muted) { stream?.getAudioTracks().forEach(track => { track.enabled = !muted; }); },
    };
  }
  root.createVoiceMedia = createVoiceMedia;
  root.VOICE_SCREEN_PRESETS = presets;
  if (typeof module !== 'undefined') module.exports = createVoiceMedia;
})(globalThis);
