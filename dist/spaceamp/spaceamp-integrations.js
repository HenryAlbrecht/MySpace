/* Provider events and OS media controls; no polling and no presence preference. */
(function (root) {
  let youtubeReady;
  function loadYouTube() {
    if (root.YT?.Player) return Promise.resolve(root.YT);
    if (youtubeReady) return youtubeReady;
    youtubeReady = new Promise((resolve, reject) => {
      const previous = root.onYouTubeIframeAPIReady;
      root.onYouTubeIframeAPIReady = () => {
        try {
          previous?.();
        } finally {
          resolve(root.YT);
        }
      };
      const script = root.document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => {
        youtubeReady = null;
        reject(Error("YouTube API unavailable"));
      };
      root.document.head.append(script);
    });
    return youtubeReady;
  }
  function youtube({ iframe, onState = () => {}, onEnded = () => {}, load = loadYouTube }) {
    let player = null,
      closed = false,
      ready = false,
      volume = 0.7,
      pendingPlay = false,
      played = false,
      finished = false;
    const notify = (target, state, error = false, blocked = false) => {
      if (closed) return;
      if (state === 1 && !error) {
        played = true;
        finished = false;
      }
      let url = "";
      try {
        url = target.getVideoUrl();
      } catch {}
      onState({
        url,
        playing: !error && state === 1,
        ended: error || state === 0,
        error,
        blocked,
        loading: !error && !blocked && (state === 3 || state === -1),
      });
      if (state === 0 && !error && played && !finished) {
        finished = true;
        onEnded();
      }
    };
    void load()
      .then((YT) => {
        if (closed || !iframe.isConnected) return;
        player = new YT.Player(iframe, {
          events: {
            onReady: (e) => {
              if (!closed) {
                ready = true;
                e.target.setVolume?.(volume * 100);
                notify(e.target, e.target.getPlayerState());
                if (pendingPlay) {
                  pendingPlay = false;
                  e.target.playVideo();
                }
              }
            },
            onStateChange: (e) => notify(e.target, e.data),
            onError: (e) => notify(e.target, 0, true),
            onAutoplayBlocked: (e) => notify(e.target, -1, false, true),
          },
        });
      })
      .catch(() => {
        if (!closed) onState({ url: "", playing: false, ended: true, error: true });
      });
    return {
      getPlaybackTime() {
        return {
          position: ready && !closed ? player.getCurrentTime?.() || 0 : 0,
          duration: ready && !closed ? player.getDuration?.() || 0 : 0,
        };
      },
      seek(value) {
        if (ready && !closed && Number.isFinite(value)) player.seekTo?.(Math.max(0, value), true);
      },
      setVolume(value) {
        volume = value;
        if (ready && !closed) player.setVolume?.(value * 100);
      },
      play() {
        if (closed) return;
        if (ready) player.playVideo();
        else pendingPlay = true;
      },
      pause() {
        pendingPlay = false;
        if (ready && !closed) player.pauseVideo();
      },
      stop() {
        pendingPlay = false;
        played = false;
        finished = true;
        if (ready && !closed) player.stopVideo();
      },
      close() {
        closed = true;
        ready = false;
        pendingPlay = false;
        try {
          player?.destroy();
        } catch {}
        player = null;
      },
      get ready() {
        return ready;
      },
    };
  }
  function mediaSession({
    session = root.navigator?.mediaSession,
    Metadata = root.MediaMetadata,
    base = root.location?.href,
    controls = {},
  } = {}) {
    if (!session) return { update() {} };
    for (const action of ["play", "pause", "previoustrack", "nexttrack", "stop"])
      try {
        session.setActionHandler(action, () => {
          try {
            Promise.resolve(controls[action]?.()).catch(() => {});
          } catch {}
        });
      } catch {}
    let metadataKey = "";
    return {
      update(track, { playing = false, stopped = false, available = true } = {}) {
        try {
          session.playbackState = !available || stopped ? "none" : playing ? "playing" : "paused";
        } catch {}
        const key =
          available && !stopped ? JSON.stringify([track.title, track.artist, track.artwork]) : "";
        if (key === metadataKey) return;
        metadataKey = key;
        try {
          if (!key) {
            session.metadata = null;
            return;
          }
          if (!Metadata) return;
          let artwork = [];
          if (track.artwork) {
            const url = new URL(track.artwork, base);
            if (["http:", "https:", "data:"].includes(url.protocol)) artwork = [{ src: url.href }];
          }
          session.metadata = new Metadata({ title: track.title, artist: track.artist, artwork });
        } catch {}
      },
    };
  }
  root.SpaceAmpIntegrations = { youtube, mediaSession };
  if (typeof module !== "undefined") module.exports = root.SpaceAmpIntegrations;
})(globalThis);
