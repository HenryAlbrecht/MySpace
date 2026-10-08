/* Visual analyser taps the existing audio; commands and clock stay in SPACEAMP. */
function createSpaceampVisualizer({ amp, shell, canvas, preferences, reduced }) {
  let context,
    analyser,
    bins,
    audioTap,
    sourceNode,
    analyserFailed = false,
    analyserPending = false;
  function visualizer() {
    if (!shell.open) return;
    const state = amp.getPlaybackState();
    const local = state.source === "local";
    const mode = preferences.visualizerMode;
    if (mode === "off") {
      shell.dataset.visualizer = "off";
      canvas.hidden = true;
      return;
    }
    if (local && mode !== "ambient" && !analyser && !analyserFailed && !analyserPending) {
      const audio = document.getElementById("audio");
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      // Only known same-origin/blob media can safely be routed without CORS silence.
      const url = audio?.currentSrc || audio?.src;
      const safe =
        url && (url.startsWith("blob:") || new URL(url, location.href).origin === location.origin);
      if (safe && AudioContext && audio.captureStream)
        try {
          context ||= new AudioContext();
          analyserPending = true;
          // Never reroute playing audio through a suspended context.
          void context
            .resume()
            .then(() => {
              if (context.state !== "running" || amp.getPlaybackState().source !== "local") return;
              analyser = context.createAnalyser();
              analyser.fftSize = 256;
              bins = new Uint8Array(analyser.frequencyBinCount);
              audioTap = audio.captureStream();
              const connect = () => {
                if (amp.getPlaybackState().source !== "local" || !audioTap.getAudioTracks().length)
                  return;
                sourceNode?.disconnect();
                sourceNode = context.createMediaStreamSource(audioTap);
                sourceNode.connect(analyser);
                if (shell.open) visualizer();
              };
              audioTap.addEventListener("addtrack", connect);
              connect();
              if (shell.open) visualizer();
            })
            .catch(() => {
              analyserFailed = true;
            })
            .finally(() => {
              analyserPending = false;
            });
        } catch {
          analyserFailed = true;
        }
    }
    if (local && mode !== "ambient" && context?.state === "suspended")
      void context.resume().catch(() => {});
    const real =
      mode !== "ambient" &&
      local &&
      analyser &&
      sourceNode &&
      audioTap.getAudioTracks().some((track) => track.readyState === "live") &&
      context.state === "running";
    if (mode === "audio" && !real) {
      shell.dataset.visualizer = "unavailable";
      canvas.hidden = true;
      return;
    }
    canvas.hidden = false;
    shell.dataset.visualizer = real ? "analyser" : "presentation";
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = 720;
    canvas.height = 180;
    if (real) analyser.getByteFrequencyData(bins);
    const time = amp.getPlaybackTime().position || 0;
    ctx.clearRect(0, 0, 720, 180);
    ctx.strokeStyle = getComputedStyle(canvas).color;
    ctx.lineWidth = 2;
    for (let band = 0; band < 3; band++) {
      ctx.beginPath();
      for (let x = 0; x <= 720; x += 8) {
        const energy = real ? bins[Math.floor((x / 720) * (bins.length - 1))] / 255 : 0.2;
        const phase = reduced.matches || !state.playing ? 0 : time * 0.55;
        const y =
          90 +
          Math.sin(x / 130 + phase + band) * (10 + energy * 32) * Math.sin((x / 720) * Math.PI);
        if (!x) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  return visualizer;
}
