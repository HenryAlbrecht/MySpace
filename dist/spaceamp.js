/* Internal track snapshot; only confirmed audio playback becomes Now Playing. */
(function (root) {
  function trackSource(value, embed) {
    if (embed?.provider === "youtube") {
      return String(value.musicUrl || value.url).includes("music.youtube.com") ? "YouTube Music" : "YouTube";
    }
    if (embed?.provider === "spotify") {
      return "Spotify";
    }
    if (value.local || (!value.musicUrl && !value.url)) {
      return "local";
    }
    return "áudio";
  }

  function track(value = {}, embed = null) {
    const source = trackSource(value, embed);
    const id = embed?.provider === "youtube" ? new URL(embed.url).searchParams.get("v") : null;
    return {
      title: String(value.song ?? value.title ?? "Nenhuma música"),
      artist: String(value.artist || ""),
      artwork: String(value.album || "") || (id ? "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg" : ""),
      source,
      sourceUrl: String(value.musicUrl ?? value.url ?? ""),
      ...(value.albumTitle ? { albumTitle: String(value.albumTitle) } : {}),
      ...(value.isrc ? { isrc: String(value.isrc) } : {}),
    };
  }
  function create({ target = root, storage } = {}) {
    const key = "spaceamp-party-music-v1";
    let current = track(),
      playing = false,
      shared = true,
      navigation = {},
      controls = {},
      queue = [],
      runtime = { volume: 0.7, position: 0, duration: 0, stopped: false, available: false };
    try {
      shared = storage?.getItem(key) !== "false";
    } catch {}
    const playbackSnapshot = () => ({ ...current, playing, shared, ...runtime });
    const snapshot = () => ({ ...playbackSnapshot(), queue: queue.map((t) => ({ ...t })) });
    function emit(type) {
      target?.dispatchEvent?.(new root.CustomEvent(type, { detail: snapshot() }));
    }
    return {
      getState: snapshot,
      getPlaybackState: playbackSnapshot,
      getPlaybackTime() {
        return controls.getPlaybackTime?.() ?? { position: runtime.position, duration: runtime.duration };
      },
      getNowPlaying() {
        if (!shared || !playing) return null;
        return {
          title:
            current.title
              .replace(/[\u0000-\u001f\u007f]/g, " ")
              .trim()
              .slice(0, 80) || "Sem título",
          artist: current.artist
            .replace(/[\u0000-\u001f\u007f]/g, " ")
            .trim()
            .slice(0, 80),
          playing: true,
        };
      },
      setNavigation(value) {
        navigation = value;
      },
      previous() {
        return navigation.previous?.();
      },
      next() {
        return navigation.next?.();
      },
      finished() {
        return navigation.ended?.();
      },
      configure(value) {
        controls = { ...controls, ...value };
      },
      play(value) {
        return value ? controls.select?.(value) : controls.play?.();
      },
      preview(value) {
        return controls.preview?.(value);
      },
      pause() {
        runtime.transitioning=false;
        return controls.pause?.();
      },
      stop() {
        runtime.transitioning=false;
        return controls.stop?.();
      },
      setVolume(value) {
        return controls.setVolume?.(Math.max(0, Math.min(1, Number(value) || 0)));
      },
      seek(value) {
        return controls.seek?.(value);
      },
      enqueue(value) {
        return controls.enqueue?.(value);
      },
      expand() {
        return controls.expand?.();
      },
      addToCollection() {
        return controls.addToCollection?.();
      },
      setQueue(value) {
        queue = value.map((t) => ({ ...t }));
        emit("spaceamp:queuechange");
      },
      progress(value) {
        runtime = { ...runtime, ...value };
        emit("spaceamp:progress");
      },
      update(next, isPlaying = false, details = {}) {
        const changed = JSON.stringify(current) !== JSON.stringify(next),
          stateChanged =
            playing !== !!isPlaying ||
            (details.stopped !== undefined && runtime.stopped !== details.stopped) ||
            (details.available !== undefined && runtime.available !== details.available);
        current = { ...next };
        playing = !!isPlaying;
        runtime = { ...runtime, ...details };
        if (changed) emit("spaceamp:trackchange");
        if (stateChanged) emit("spaceamp:playstate");
      },
      share(value) {
        shared = !!value;
        try {
          storage?.setItem(key, String(shared));
        } catch {}
        emit("spaceamp:privacy");
      },
    };
  }
  root.SpaceAmp = { track, create };
  if (typeof module !== "undefined") module.exports = root.SpaceAmp;
})(globalThis);
