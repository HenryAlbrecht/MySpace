/* Validated JSON-only media preferences; encoding is independent from capture. */
(function(root) {
  const defaults = Object.freeze({micEchoCancellation:true, micNoiseSuppression:true, micAutoGainControl:true,
    micBitrate:null, screenAudioBitrate:192000, screenVideoBitrate:'recommended', screenContentHint:'motion'});
  const choices = Object.freeze({micBitrate:[null,24000,32000,48000,64000,96000],
    screenAudioBitrate:[96000,128000,160000,192000,256000],
    screenVideoBitrate:['recommended',null,4000000,6000000,8000000,10000000,14000000,20000000], screenContentHint:['detail','motion']});
  const recommended = Object.freeze({'720p60':4000000,'1080p30':6000000,'1080p60':10000000,'1440p60':14000000});
  function normalize(value) {
    value = value && typeof value === 'object' ? value : {};
    return Object.fromEntries(Object.entries(defaults).map(([key,fallback]) => [key,
      choices[key] ? (choices[key].includes(value[key]) ? value[key] : fallback) : (typeof value[key] === 'boolean' ? value[key] : fallback)]));
  }
  function encoding(value, preset='1080p60') {
    const s=normalize(value);
    return {microphone:s.micBitrate, 'screen-audio':s.screenAudioBitrate,
      'screen-video':s.screenVideoBitrate === 'recommended' ? recommended[preset] || recommended['1080p60'] : s.screenVideoBitrate};
  }
  function constraints(value) {
    const s=normalize(value);
    return {echoCancellation:s.micEchoCancellation,noiseSuppression:s.micNoiseSuppression,autoGainControl:s.micAutoGainControl};
  }
  function hint(track,value) { try { if(track && 'contentHint' in track) track.contentHint=value; } catch {} }
  root.PARTY_MEDIA_SETTINGS={defaults,choices,recommended,normalize,encoding,constraints,hint};
  if(typeof module !== 'undefined') module.exports=root.PARTY_MEDIA_SETTINGS;
})(globalThis);
