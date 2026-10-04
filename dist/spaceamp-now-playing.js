/* Presentation only: every playback command and clock belongs to SPACEAMP. */
(() => {
  const amp = window.SPACEAMP;
  const el = (tag, cls, text = '') => { const n = document.createElement(tag); n.className = cls; n.textContent = text; return n; };
  const shell = el('dialog', 'amp-now-playing');
  shell.id = 'spaceampNowPlaying'; shell.setAttribute('aria-label', 'SPACEAMP Now Playing'); shell.tabIndex = -1;
  const atmosphere = el('img', 'np-atmosphere'); atmosphere.alt = '';
  const canvas = el('canvas', 'np-visualizer'); canvas.setAttribute('aria-hidden', 'true');
  const left = el('section', 'np-track'), cover = el('img', 'np-cover'); cover.alt = 'Capa da faixa';
  cover.style.visibility = 'hidden';
  const chrome = el('div', 'np-chrome'), title = el('h2', '', ''), artist = el('p', ''), metadata = el('small', '');
  const progress = el('input', 'np-progress'); progress.type = 'range'; progress.min = 0; progress.max = 1; progress.step = .001; progress.setAttribute('aria-label', 'Posição da música');
  const clock = el('small', 'np-clock'), controls = el('div', 'np-controls');
  const button = (label, action) => { const b = el('button', '', label); b.type = 'button'; b.onclick = () => { wake(); Promise.resolve().then(action).catch(() => { status.textContent = 'Controle indisponível nesta fonte.'; }); }; return b; };
  const play = button('Reproduzir', () => amp.getState().playing ? amp.pause() : amp.play());
  const volume = el('input', ''); volume.type = 'range'; volume.min = 0; volume.max = 1; volume.step = .01; volume.setAttribute('aria-label', 'Volume'); volume.oninput = () => amp.setVolume(Number(volume.value));
  controls.append(button('Anterior', () => amp.previous()), play, button('Próxima', () => amp.next()), volume);
  chrome.append(title, artist, metadata, progress, clock, controls); left.append(cover, chrome);
  const right = el('section', 'np-lyrics'), status = el('p', 'np-status'); status.setAttribute('role', 'status');
  const slot = el('div', 'np-lyrics-slot'); right.append(slot, status);
  const exit = button('Fechar · Esc', close); exit.className = 'np-exit np-chrome';
  shell.append(atmosphere, canvas, left, right, exit); document.body.append(shell);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let trigger, lyrics, trackKey = '', frame = 0, idle = 0, held = false, loading, loadError = false;
  // No PCM access for iframe sources. Tap ONLY the existing local audio element.
  // An element capture stream avoids rerouting its audible output: later remote
  // sources cannot be silenced by MediaElementSource CORS restrictions.
  let context, analyser, bins, audioTap, sourceNode, analyserFailed = false, analyserPending = false;
  function visualizer() {
    const state = amp.getState();
    const local = state.source === 'local';
    if (local && !analyser && !analyserFailed && !analyserPending && !reduced.matches) {
      const audio = document.getElementById('audio');
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      // Only known same-origin/blob media can safely be routed without CORS silence.
      const url = audio?.currentSrc || audio?.src;
      const safe = url && (url.startsWith('blob:') || new URL(url, location.href).origin === location.origin);
      if (safe && AudioContext && audio.captureStream) try {
        context ||= new AudioContext(); analyserPending = true;
        // Never reroute playing audio through a suspended context.
        void context.resume().then(() => {
          if (context.state !== 'running' || amp.getState().source !== 'local') return;
          analyser = context.createAnalyser(); analyser.fftSize = 256;
          bins = new Uint8Array(analyser.frequencyBinCount);
          audioTap = audio.captureStream();
          const connect = () => {
            if (amp.getState().source !== 'local' || !audioTap.getAudioTracks().length) return;
            sourceNode?.disconnect();
            sourceNode = context.createMediaStreamSource(audioTap); sourceNode.connect(analyser);
            if (shell.open) visualizer();
          };
          audioTap.addEventListener('addtrack', connect); connect();
          if (shell.open) visualizer();
        }).catch(() => { analyserFailed = true; }).finally(() => { analyserPending = false; });
      } catch { analyserFailed = true; }
    }
    if (local && context?.state === 'suspended') void context.resume().catch(() => {});
    const real = local && analyser && sourceNode && audioTap.getAudioTracks().some(track => track.readyState === 'live') && context.state === 'running';
    shell.dataset.visualizer = real ? 'analyser' : 'presentation';
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    canvas.width = 720; canvas.height = 180;
    if (real) analyser.getByteFrequencyData(bins);
    const time = amp.getPlaybackTime().position || 0;
    ctx.clearRect(0, 0, 720, 180); ctx.strokeStyle = getComputedStyle(shell).color; ctx.lineWidth = 2;
    for (let band = 0; band < 3; band++) {
      ctx.beginPath();
      for (let x = 0; x <= 720; x += 8) {
        const energy = real ? bins[Math.floor(x / 720 * (bins.length - 1))] / 255 : .2;
        const phase = reduced.matches || !state.playing ? 0 : time * .55;
        const y = 90 + Math.sin(x / 130 + phase + band) * (10 + energy * 32) * Math.sin(x / 720 * Math.PI);
        if (!x) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  function load() {
    if (!loading) loading = import('https://cdn.jsdelivr.net/npm/@uimaxbai/am-lyrics@1.7.4/dist/src/am-lyrics.min.js')
      .then(() => { if (shell.open) { status.textContent = 'Letras fornecidas por am-lyrics · disponibilidade varia por faixa.'; sync(); } })
      .catch(() => { loadError = true; status.textContent = 'Não foi possível carregar o motor de letras. A reprodução continua.'; });
    return loading;
  }
  const seekable = s => s.available && (s.source === 'local' || s.source === 'áudio' || s.source.startsWith('YouTube'));
  function seek(seconds) {
    if (!seekable(amp.getState()) || !Number.isFinite(seconds)) return;
    amp.seek(seconds); sync();
  }
  progress.oninput = () => seek(Number(progress.value) * (amp.getPlaybackTime().duration || 0));
  function sync() {
    if (!shell.open) return;
    const s = amp.getState(), time = amp.getPlaybackTime();
    const ms = Math.max(0, (time.position || 0) * 1000), duration = Math.max(0, (time.duration || 0) * 1000);
    if (lyrics) {
      // Property is the authoritative API (upstream attribute aliases vary).
      lyrics.currentTime = ms; lyrics.setAttribute('current-time', ms);
      // -1 means reset in upstream, not pause. A paused view keeps its position.
      lyrics.duration = duration;
      if (duration && !lyrics.hasAttribute('song-duration')) lyrics.setAttribute('song-duration', duration);
    }
    progress.disabled = !seekable(s) || !duration;
    if (document.activeElement !== progress) progress.value = duration ? ms / duration : 0;
    clock.textContent = `${format(ms / 1000)} / ${format(duration / 1000)}`;
  }
  function format(t) { return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`; }
  function tick() { frame = 0; if (!shell.open || !amp.getState().playing) return; sync(); visualizer(); frame = requestAnimationFrame(tick); }
  function update() {
    if (!shell.open) return;
    const s = amp.getState();
    const key = JSON.stringify([s.title, s.artist, s.sourceUrl]);
    if (key !== trackKey) {
      trackKey = key;
      title.textContent = s.title; artist.textContent = s.artist; metadata.textContent = s.source;
      if (s.artwork) Artwork.set(cover, s.artwork, { ready: () => Artwork.set(atmosphere, s.artwork) });
      // Fresh component isolates pending provider responses and removes old lyrics immediately.
      lyrics = el('am-lyrics', '');
      for (const [name, value] of Object.entries({'song-title': s.title, 'song-artist': s.artist, 'song-album': s.albumTitle, isrc: s.isrc, query: `${s.title} ${s.artist}`, 'font-family': getComputedStyle(shell).fontFamily})) if (value) lyrics.setAttribute(name, value);
      lyrics.setAttribute('autoscroll', ''); lyrics.setAttribute('interpolate', '');
      lyrics.addEventListener('line-click', event => { wake(); seek(Number(event.detail?.timestamp) / 1000); });
      slot.replaceChildren(lyrics);
      // Provider loading/no-match/instrumental/error UI is owned by am-lyrics;
      // upstream has no public resolution-status event. Do not inspect private state or Shadow DOM.
      status.textContent = loadError ? 'Motor de letras indisponível. A reprodução continua.' : customElements.get('am-lyrics') ? 'Letras fornecidas por am-lyrics · disponibilidade varia por faixa.' : 'Carregando motor de letras…';
    }
    play.textContent = s.playing ? 'Pausar' : 'Reproduzir'; volume.value = s.volume;
    sync(); cancelAnimationFrame(frame); frame = 0; visualizer(); if (s.playing) frame = requestAnimationFrame(tick);
  }
  function wake() {
    shell.classList.remove('np-idle'); clearTimeout(idle);
    idle = setTimeout(() => {
      const focused = document.activeElement;
      if (held || (focused !== shell && shell.contains(focused))) { wake(); return; }
      shell.classList.add('np-idle');
    }, 4500);
  }
  function open(source) {
    if (shell.open) return;
    trigger = source || document.activeElement;
    shell.inert = false; shell.showModal(); shell.focus({preventScroll: true});
    document.body.classList.add('amp-now-playing-open'); trackKey = ''; update(); wake(); void load();
  }
  function close() {
    if (!shell.open) return;
    clearTimeout(idle); cancelAnimationFrame(frame); frame = 0; held = false;
    if (lyrics) lyrics.duration = -1;
    shell.close(); document.body.classList.remove('amp-now-playing-open'); trigger?.focus?.({preventScroll: true});
  }
  shell.addEventListener('cancel', e => { e.preventDefault(); close(); });
  shell.addEventListener('keydown', e => {
    wake();
    if (e.key === 'Escape' || (e.key === 'Backspace' && document.body.classList.contains('xmb-active'))) { e.preventDefault(); e.stopImmediatePropagation(); close(); }
  });
  for (const type of ['pointermove', 'wheel', 'touchstart', 'focusin']) shell.addEventListener(type, wake, {passive: true});
  shell.addEventListener('pointerdown', () => { held = true; wake(); });
  window.addEventListener('pointerup', () => { held = false; if (shell.open) wake(); });
  window.addEventListener('pointercancel', () => { held = false; });
  for (const type of ['spaceamp:trackchange', 'spaceamp:progress', 'spaceamp:playstate']) window.addEventListener(type, () => {
    if (type === 'spaceamp:playstate' && amp.getState().playing && document.body.classList.contains('xmb-active') && !shell.open) open();
    update();
  });
  document.getElementById('audio').addEventListener('seeked', sync);
  // Delegation survives compact-player mounting and artwork replacement.
  document.addEventListener('click', e => { const source = e.target.closest?.('#album,.amp-mini-cover'); if (source) open(source); });
  for (const source of document.querySelectorAll('#album,.amp-mini-cover')) {
    source.tabIndex = 0; source.setAttribute('role', 'button'); source.setAttribute('aria-label', 'Abrir Now Playing');
    source.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(source); } });
  }
  window.SpaceAmpNowPlaying = {open, close, isOpen: () => shell.open};
})();
