/* Meter-only Web Audio graph: source -> analyser, never -> destination. */
(function (root) {
  function createVoiceLevels({
    Context = root.AudioContext || root.webkitAudioContext,
    interval = root.setInterval?.bind(root),
    cancel = root.clearInterval?.bind(root),
    onError = () => {},
    threshold = 0.02,
    attack = 100,
    release = 400,
  } = {}) {
    let context = null,
      timer = null;
    const monitors = new Map();
    function sample(now = root.performance?.now?.() ?? Date.now()) {
      for (const entry of monitors.values()) {
        let rms = 0;
        if (
          !entry.muted &&
          context?.state === "running" &&
          entry.track.readyState !== "ended" &&
          entry.track.enabled !== false
        ) {
          entry.analyser.getFloatTimeDomainData(entry.samples);
          rms = Math.sqrt(entry.samples.reduce((sum, v) => sum + v * v, 0) / entry.samples.length);
        }
        const target = rms > 0 ? Math.max(0, Math.min(1, (20 * Math.log10(rms) + 60) / 50)) : 0;
        entry.level = entry.muted
          ? 0
          : entry.level + (target - entry.level) * (target > entry.level ? 0.65 : 0.2);
        if (entry.muted || entry.track.readyState === "ended") {
          entry.speaking = false;
          entry.above = entry.below = null;
        } else if (rms >= threshold) {
          entry.below = null;
          entry.above ??= now;
          if (now - entry.above >= attack) entry.speaking = true;
        } else {
          entry.above = null;
          entry.below ??= now;
          if (now - entry.below >= release) entry.speaking = false;
        }
        entry.onLevel({ level: entry.level, speaking: entry.speaking });
      }
    }
    function remove(id) {
      const entry = monitors.get(id);
      if (!entry) return;
      entry.source.disconnect();
      entry.analyser.disconnect();
      monitors.delete(id);
      entry.onLevel({ level: 0, speaking: false });
    }
    return {
      start() {
        if (!Context) return false;
        try {
          context ||= new Context();
          if (context.state === "suspended")
            context
              .resume()
              .catch(() => onError("Clique em reproduzir áudio para ativar os medidores."));
          if (timer === null && interval) timer = interval(sample, 50);
          return true;
        } catch {
          onError("Medidores de áudio indisponíveis neste navegador.");
          return false;
        }
      },
      monitor(id, stream, onLevel) {
        if (monitors.get(id)?.stream === stream) return;
        remove(id);
        const track = stream?.getAudioTracks?.()[0];
        if (!context || !track) return;
        try {
          const source = context.createMediaStreamSource(stream),
            analyser = context.createAnalyser();
          analyser.fftSize = 1024;
          source.connect(analyser);
          monitors.set(id, {
            stream,
            track,
            source,
            analyser,
            samples: new Float32Array(analyser.fftSize),
            level: 0,
            speaking: false,
            muted: false,
            above: null,
            below: null,
            onLevel,
          });
        } catch {
          onError("Não foi possível medir um dos microfones. A reprodução continua disponível.");
        }
      },
      setMuted(id, muted) {
        const entry = monitors.get(id);
        if (!entry) return;
        entry.muted = !!muted;
        if (muted) {
          entry.level = 0;
          entry.speaking = false;
          entry.above = entry.below = null;
          entry.onLevel({ level: 0, speaking: false });
        }
      },
      remove,
      sample,
      stop() {
        if (timer !== null) cancel?.(timer);
        timer = null;
        for (const id of [...monitors.keys()]) remove(id);
        const old = context;
        context = null;
        old?.close().catch(() => {});
      },
      get size() {
        return monitors.size;
      },
    };
  }
  root.createVoiceLevels = createVoiceLevels;
  if (typeof module !== "undefined") module.exports = createVoiceLevels;
})(globalThis);
