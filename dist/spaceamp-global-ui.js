/* Profile and compact presentation of the single SPACEAMP core; owns no playback adapter. */
(function (root) {
  const amp = root.SPACEAMP;
  const node = (tag, text = "") => {
    const n = document.createElement(tag);
    n.textContent = text;
    return n;
  };
  function button(text, action) {
    const b = node("button", text);
    b.type = "button";
    b.onclick = (e) => {
      e.stopPropagation();
      Promise.resolve()
        .then(action)
        .catch((error) => toast(error.message));
    };
    return b;
  }
  function initialize({ saveCurrent }) {
    const full = document.getElementById("music"),
      home = node("section");
    home.id = "ampHome";
    home.className = full.className;
    home.style.background = "none";
    home.style.border = "0";
    full.before(home);
    const dock = node("aside");
    dock.id = "globalSpaceAmp";
    dock.setAttribute("aria-label", "SPACEAMP global");
    const titlebar = node("div");
    titlebar.className = "titlebar amp-titlebar";
    const title = node("span", "♫ SPACEAMP "),
      version = node("span", "v. 2.0");
    version.className = "version";
    title.append(version);
    let compactClosed = false,
      compactStarted = false,
      previousRoute = null,
      compactEnabled = true;
    let youtubeCover = false;
    try {
      youtubeCover = localStorage.getItem("spaceamp-youtube-cover-v1") === "true";
    } catch {}
    const artworkToggle = button("usar capa", () => {
      youtubeCover = !youtubeCover;
      try {
        localStorage.setItem("spaceamp-youtube-cover-v1", String(youtubeCover));
      } catch {}
      dock.classList.remove("amp-artwork-change");
      update();
      void dock.offsetWidth;
      dock.classList.add("amp-artwork-change");
    });
    artworkToggle.className = "amp-artwork-toggle";
    artworkToggle.setAttribute("aria-label", "Usar capa da coleção em vez do vídeo");
    titlebar.append(artworkToggle);
    try {
      compactEnabled = localStorage.getItem("spaceamp-global-controls-v1") !== "false";
    } catch {}
    const visibilityLabel = node("label", "mostrar SPACEAMP nas outras abas");
    visibilityLabel.className = "spaceamp-privacy";
    const visibilityInput = node("input");
    visibilityInput.type = "checkbox";
    visibilityInput.checked = compactEnabled;
    visibilityInput.id = "showGlobalSpaceAmp";
    visibilityLabel.prepend(visibilityInput);
    full.append(visibilityLabel);
    visibilityInput.onchange = () => {
      compactEnabled = visibilityInput.checked;
      try {
        localStorage.setItem("spaceamp-global-controls-v1", String(compactEnabled));
      } catch {}
      route();
    };
    const reopen = button("♫ SPACEAMP", () => {
      compactClosed = false;
      route();
      (resize.hidden ? close : resize).focus();
    });
    reopen.id = "ampReopen";
    reopen.setAttribute("aria-label", "Abrir SPACEAMP compacto");
    reopen.setAttribute("aria-controls", "globalSpaceAmp");
    document.body.append(reopen);
    const windowControls = node("div");
    windowControls.className = "amp-window-controls";
    function presentation(expanded) {
      dock.classList.toggle("mobile-expanded", expanded);
      syncDock();
    }
    const resize = button("□", () => presentation(!dock.classList.contains("mobile-expanded"))),
      close = button("×", () => {
        compactClosed = true;
        route();
        if (!reopen.hidden) reopen.focus();
      });
    close.setAttribute("aria-label", "Ocultar SPACEAMP compacto");
    windowControls.append(resize, close);
    titlebar.append(title, windowControls);
    const mini = node("div");
    mini.className = "amp-mini";
    const coverBox = node("div");
    coverBox.className = "amp-mini-cover";
    const cover = node("img"),
      placeholder = node("span", "♫");
    cover.alt = "";
    coverBox.append(cover, placeholder);
    let coverFailed = false;
    cover.onerror = () => {
      coverFailed = true;
      cover.hidden = true;
      placeholder.hidden = false;
    };
    const info = node("div");
    info.className = "amp-mini-info";
    const label = node("strong"),
      artist = node("span"),
      progress = node("small");
    const playbackNotice = node("small");
    playbackNotice.className = "amp-playback-notice";
    playbackNotice.setAttribute("role", "status");
    const timeline = node("div"), seek = node("input"), fullSeek = document.getElementById("seek");
    timeline.className = "amp-mini-progress"; seek.className = "amp-mini-seek";
    seek.type = "range"; seek.min = 0; seek.max = 100; seek.step = 0.1;
    seek.setAttribute("aria-label", "Posição da música no SPACEAMP compacto");
    fullSeek.step = 0.1;
    timeline.append(seek, progress);
    info.append(label, artist, timeline, playbackNotice);
    const controls = node("div");
    controls.className = "amp-mini-controls";
    const previous = button("◀", () => amp.previous()),
      play = button("▶", () => (amp.getPlaybackState().playing ? amp.pause() : amp.play())),
      next = button("▶|", () => amp.next());
    previous.setAttribute("aria-label", "Faixa anterior");
    next.setAttribute("aria-label", "Próxima faixa");
    const volumeLabel = node("label", "VOL"),
      volume = node("input");
    volumeLabel.className = "amp-mini-volume";
    volume.type = "range";
    volume.min = 0;
    volume.max = 1;
    volume.step = 0.01;
    volume.setAttribute("aria-label", "Volume global");
    volume.oninput = () => amp.setVolume(volume.value);
    volumeLabel.append(volume);
    const expand = button("□ perfil", () => {
      location.hash = "perfil";
    });
    expand.className = "amp-expand";
    controls.append(previous, play, next, volumeLabel, expand);
    info.append(controls);
    mini.append(coverBox, info);
    dock.append(titlebar, mini, full);
    document.body.append(dock);
    resize.setAttribute("aria-controls", "globalSpaceAmp");
    dock.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && dock.classList.contains("mobile-expanded")) {
        event.preventDefault();
        presentation(false);
        resize.focus();
      }
    });
    function syncDock() {
      const onProfile = dock.classList.contains("in-profile"),
        mobile = matchMedia("(max-width:600px)").matches;
      // A visible YouTube embed keeps its viewport; only the local presentation retracts.
      const canRetract = mobile && !onProfile && !dock.classList.contains("has-youtube");
      resize.hidden = !canRetract;
      resize.textContent = dock.classList.contains("mobile-expanded") ? "−" : "□";
      resize.setAttribute(
        "aria-label",
        dock.classList.contains("mobile-expanded")
          ? "Recolher controles do SPACEAMP"
          : "Expandir controles do SPACEAMP",
      );
      resize.title = resize.getAttribute("aria-label");
      resize.setAttribute("aria-expanded", String(dock.classList.contains("mobile-expanded")));
      const visible =
        mobile &&
        !onProfile &&
        !dock.classList.contains("compact-closed") &&
        !dock.classList.contains("compact-inactive") &&
        dock.classList.contains("has-track");
      document.body.classList.toggle("amp-mobile-visible", visible);
      document.documentElement.style.setProperty(
        "--amp-mobile-space",
        visible ? dock.offsetHeight + 24 + "px" : "0px",
      );
    }
    const transport = full.querySelector(".player-controls");
    full.querySelector(".player-main").after(transport);
    document.getElementById("play").onclick = () => (amp.getPlaybackState().playing ? amp.pause() : amp.play());
    function route() {
      const playback = amp.getPlaybackState();
      if (previousRoute !== location.hash) {
        compactStarted = playback.playing;
        previousRoute = location.hash;
      }
      if (playback.playing) compactStarted = true;
      const onProfile = !document.querySelector(".columns").hidden;
      dock.classList.toggle("in-profile", onProfile);
      dock.classList.toggle("expanded", onProfile);
      dock.classList.toggle("compact-inactive", !onProfile && (!compactEnabled || !compactStarted));
      close.hidden = onProfile;
      const closed = !onProfile && compactClosed;
      dock.classList.toggle("compact-closed", closed);
      const state = amp.getPlaybackState();
      reopen.hidden =
        onProfile || !compactEnabled || !compactStarted || !closed || !state.available || state.stopped;
      expand.textContent = "□ perfil";
      if (onProfile) {
        const rect = home.getBoundingClientRect();
        dock.style.left = rect.left + scrollX + "px";
        dock.style.top = rect.top + scrollY + "px";
        dock.style.width = rect.width + "px";
        home.style.height = dock.offsetHeight + "px";
      } else {
        dock.style.removeProperty("left");
        dock.style.removeProperty("top");
        dock.style.removeProperty("width");
        home.style.height = "";
      }
      syncDock();
    }
    root.addEventListener("hashchange", route);
    root.addEventListener("resize", route);
    new ResizeObserver(() => {
      if (dock.classList.contains("in-profile")) home.style.height = dock.offsetHeight + "px";
      syncDock();
    }).observe(dock);
    root.addEventListener("myspace:preferences-restored", () => {
      try {
        compactEnabled = localStorage.getItem("spaceamp-global-controls-v1") !== "false";
        youtubeCover = localStorage.getItem("spaceamp-youtube-cover-v1") === "true";
      } catch {}
      visibilityInput.checked = compactEnabled;
      compactClosed = false;
      update();
    });
    route();
    full.append(button("salvar na Collection", () => amp.addToCollection()));
    amp.configure({
      expand: () => presentation(true),
      addToCollection: saveCurrent,
    });
    const time = (value) => {
      const seconds = Math.max(0, Math.floor(value || 0));
      return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
    };
    const seekable = state => state.available && !state.stopped && (state.source === "local" || state.source === "áudio" || state.source.startsWith("YouTube"));
    let progressFrame = 0, heldSlider = null, pendingSeek = null;
    function syncProgress() {
      const state = amp.getPlaybackState(), clock = amp.getPlaybackTime();
      const duration = Number.isFinite(clock.duration) ? Math.max(0, clock.duration) : 0;
      const position = Number.isFinite(clock.position) ? Math.max(0, Math.min(clock.position, duration || Infinity)) : 0;
      const key = state.sourceUrl || state.title;
      if (pendingSeek && (!seekable(state) || pendingSeek.key !== key || Math.abs(position - pendingSeek.target) < 1 || performance.now() >= pendingSeek.until)) pendingSeek = null;
      for (const slider of [seek, fullSeek]) {
        slider.disabled = !seekable(state) || !duration;
        if (slider !== heldSlider && slider !== pendingSeek?.slider) slider.value = duration ? position / duration * 100 : 0;
        slider.setAttribute("aria-valuetext", time(position) + " de " + time(duration));
      }
      for (const [element, text] of [[progress, time(position) + " / " + time(duration)], [document.getElementById("time"), time(position)], [document.getElementById("duration"), time(duration)]]) {
        if (element.textContent !== text) element.textContent = text;
      }
      timeline.hidden = !seekable(state);
    }
    for (const slider of [seek, fullSeek]) {
      slider.oninput = () => {
        const state = amp.getPlaybackState(), duration = amp.getPlaybackTime().duration;
        if (seekable(state) && Number.isFinite(duration) && duration > 0) {
          const target = Number(slider.value) / 100 * duration;
          pendingSeek = {slider, target, key: state.sourceUrl || state.title, until: performance.now() + 1500};
          amp.seek(target);
        }
        scheduleProgress();
      };
      slider.addEventListener("pointerdown", () => { heldSlider = slider; });
      slider.addEventListener("keydown", event => { if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End","PageUp","PageDown"].includes(event.key)) heldSlider = slider; });
      for (const type of ["keyup","blur"]) slider.addEventListener(type, () => { heldSlider = null; scheduleProgress(); });
    }
    for (const type of ["pointerup","pointercancel"]) root.addEventListener(type, () => { if (heldSlider) { heldSlider = null; scheduleProgress(); } });
    function tickProgress() {
      progressFrame = 0;
      if (document.hidden || (!amp.getPlaybackState().playing && !pendingSeek)) return;
      syncProgress(); progressFrame = requestAnimationFrame(tickProgress);
    }
    function scheduleProgress() {
      syncProgress();
      if (!document.hidden && (amp.getPlaybackState().playing || pendingSeek)) { if (!progressFrame) progressFrame = requestAnimationFrame(tickProgress); }
      else { cancelAnimationFrame(progressFrame); progressFrame = 0; }
    }
    document.addEventListener("visibilitychange", scheduleProgress);
    function update(event) {
      const state = amp.getPlaybackState();
      const isYouTube = state.source.startsWith("YouTube");
      dock.classList.toggle("youtube-cover", isYouTube && youtubeCover);
      artworkToggle.hidden = !isYouTube;
      artworkToggle.textContent = youtubeCover ? "mostrar vídeo" : "usar capa";
      artworkToggle.setAttribute("aria-pressed", String(youtubeCover));
      playbackNotice.textContent =
        {
          loading: "Carregando YouTube…",
          blocked: "Clique em play para iniciar",
          error: "Vídeo indisponível · tente outro link",
        }[state.playbackStatus] || "";
      playbackNotice.hidden = !playbackNotice.textContent;
      label.textContent = state.title;
      artist.textContent = state.artist || state.source;
      if (state.artwork) {
        if (cover.dataset.artworkSource !== state.artwork) {
          coverFailed = false;
          Artwork.set(cover,state.artwork,{ready:()=>{coverFailed=false;cover.hidden=false;placeholder.hidden=true;},error:()=>{coverFailed=true;cover.hidden=true;placeholder.hidden=false;}});
        }
      } else Artwork.clear(cover);
      cover.hidden = !state.artwork || coverFailed;
      placeholder.hidden = !!state.artwork && !coverFailed;
      scheduleProgress();
      play.textContent = state.playing ? "❚❚" : "▶";
      play.setAttribute("aria-label", state.playing ? "Pausar música" : "Reproduzir música");
      volume.value = state.volume;
      if (document.getElementById("play").textContent !== play.textContent)
        document.getElementById("play").textContent = play.textContent;
      document.getElementById("play").setAttribute("aria-label", play.getAttribute("aria-label"));
      dock.classList.toggle("has-track", state.available && !state.stopped);
      dock.classList.toggle("has-youtube", !!full.querySelector("iframe"));
      if (event?.type !== "spaceamp:progress") route();
    }
    root.addEventListener("spaceamp:trackchange", () => {
      mini.classList.remove("amp-track-change");
      void mini.offsetWidth;
      mini.classList.add("amp-track-change");
    });
    for (const event of [
      "spaceamp:trackchange",
      "spaceamp:playstate",
      "spaceamp:queuechange",
      "spaceamp:progress",
    ])
      root.addEventListener(event, update);
    new MutationObserver(update).observe(full, { childList: true, subtree: true });
    update();
  }
  root.SpaceAmpGlobalUI = { initialize };
})(window);
