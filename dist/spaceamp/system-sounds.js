/* Short shell effects owned by the app; no track, queue or playback state. */
(function (root) {
  const files = {
    cursor: "selection", confirm: "select", back: "nav_back",
    bubble: "bubble_launch", bootVita: "boot_vita",
    vitaOpen: "vita_open", vitaClose: "vita_menu_close", vitaPage: "vita_page_navigate",
    peelMid: "peel_mid", peelFast: "peel_fast",
  };
  function createSystemSounds() {
    let context;
    let generation = 0;
    let loop;
    let loopName = "";
    let peelRevision = 0;
    let lastCursor = -Infinity;
    const buffers = new Map();
    const streams = new Set();
    const enabled = () => !root.document.hidden && root.document.body.dataset.xmbSystemSounds !== "false";
    function stopPeel() {
      peelRevision++;
      loopName = "";
      if (loop) {
        try { loop.stop(); } catch { /* Already ended. */ }
        streams.delete(loop);
        loop = undefined;
      }
    }
    function stop() {
      generation++;
      stopPeel();
      for (const source of streams) {
        try { source.stop(); } catch { /* Already ended. */ }
      }
      streams.clear();
    }
    function unlock() {
      if (!enabled()) return;
      const AudioContext = root.AudioContext || root.webkitAudioContext;
      if (!AudioContext) return;
      try {
        context ||= new AudioContext();
        if (context.state === "suspended") void context.resume().catch(() => {});
        for (const key of Object.keys(files)) void load(key);
      } catch { /* Browser audio policy may block until a user gesture. */ }
    }
    function load(name) {
      if (!buffers.has(name)) {
        const pending = root.fetch("/xmb-sounds/" + files[name] + ".wav")
          .then((response) => {
            if (!response.ok) throw Error("Unavailable system sound");
            return response.arrayBuffer();
          })
          .then((bytes) => context.decodeAudioData(bytes))
          .catch(() => {
            buffers.delete(name);
            return null;
          });
        buffers.set(name, pending);
      }
      return buffers.get(name);
    }
    function play(name) {
      if (name === "peelStop") {
        stopPeel();
        return;
      }
      if (!Object.hasOwn(files, name)) return;
      if (!enabled()) { stop(); return; }
      const now = performance.now();
      if (name === "cursor" && now - lastCursor < 30) return;
      if (name === "cursor") lastCursor = now;
      const looping = name === "peelMid" || name === "peelFast";
      if (looping && loopName === name) return;
      if (looping || name === "bootVita") stopPeel();
      if (looping) loopName = name;
      unlock();
      if (!context) return;
      // Warm the bounded sample bank once; late clicks are dropped rather than replayed.
      for (const key of Object.keys(files)) void load(key);
      const token = generation;
      const peelToken = peelRevision;
      void load(name).then((buffer) => {
        if (!buffer || token !== generation || !enabled() || context.state !== "running") {
          if (looping && peelToken === peelRevision) loopName = "";
          return;
        }
        if (looping ? loopName !== name || peelToken !== peelRevision : performance.now() - now > 200) return;
        if (streams.size >= 10) {
          const oldest = [...streams].find((source) => source !== loop);
          oldest?.stop();
          streams.delete(oldest);
        }
        const source = context.createBufferSource();
        const gain = context.createGain();
        gain.gain.value = 0.7;
        source.buffer = buffer;
        source.loop = looping;
        source.connect(gain);
        gain.connect(context.destination);
        streams.add(source);
        if (looping) loop = source;
        source.onended = () => {
          streams.delete(source);
          source.disconnect();
          gain.disconnect();
        };
        source.start();
      }).catch(() => {});
    }
    const observer = new root.MutationObserver(() => { if (!enabled()) stop(); });
    observer.observe(root.document.body, { attributes: true, attributeFilter: ["data-xmb-system-sounds"] });
    root.document.addEventListener("visibilitychange", () => { if (root.document.hidden) stop(); });
    root.addEventListener("pagehide", stop);
    root.document.addEventListener("pointerdown", unlock, { passive: true });
    root.document.addEventListener("keydown", unlock);
    return { play, stop };
  }
  root.createSystemSounds = createSystemSounds;
  if (typeof module !== "undefined") module.exports = { createSystemSounds };
})(typeof window === "undefined" ? globalThis : window);
