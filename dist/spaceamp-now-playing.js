/* Presentation only: every playback command and clock belongs to SPACEAMP. */
(() => {
  const amp = window.SPACEAMP;
  const preferenceKey = 'spaceamp-now-playing-preferences-v1';
  const preferences = {lyricsEnabled: true, visualizerMode: 'auto', uiMode: 'auto', backgroundMode: 'dynamic'};
  try {
    const saved = JSON.parse(localStorage.getItem(preferenceKey));
    if (typeof saved?.lyricsEnabled === 'boolean') preferences.lyricsEnabled = saved.lyricsEnabled;
    if (['auto', 'audio', 'ambient', 'off'].includes(saved?.visualizerMode)) preferences.visualizerMode = saved.visualizerMode;
    if (['auto', 'visible'].includes(saved?.uiMode)) preferences.uiMode = saved.uiMode;
    if (['dynamic', 'static'].includes(saved?.backgroundMode)) preferences.backgroundMode = saved.backgroundMode;
  } catch { /* Unavailable storage or malformed preferences use defaults. */ }
  const el = (tag, cls, text = '') => { const n = document.createElement(tag); n.className = cls; n.textContent = text; return n; };
  const shell = el('dialog', 'amp-now-playing');
  shell.id = 'spaceampNowPlaying'; shell.setAttribute('aria-label', 'SPACEAMP Now Playing'); shell.tabIndex = -1; shell.setAttribute('aria-modal', 'true');
  const atmosphere = el('img', 'np-atmosphere'); atmosphere.alt = '';
  const atmosphereStage = el('div', 'np-atmosphere-stage'); atmosphereStage.setAttribute('aria-hidden', 'true'); atmosphereStage.append(atmosphere);
  const dynamicCanvas = el('canvas', 'np-dynamic-atmosphere'); dynamicCanvas.setAttribute('aria-hidden', 'true');
  atmosphereStage.append(dynamicCanvas);
  shell.dataset.atmosphere = 'static';
  const canvas = el('canvas', 'np-visualizer'); canvas.setAttribute('aria-hidden', 'true');
  const left = el('section', 'np-track'), cover = el('img', 'np-cover'); cover.alt = 'Capa da faixa';
  const artStage = el('div', 'np-artwork'); artStage.append(cover);
  cover.style.visibility = 'hidden';
  const chrome = el('div', 'np-chrome'), title = el('h2', '', ''), artist = el('p', ''), metadata = el('small', '');
  const progress = el('input', 'np-progress'); progress.type = 'range'; progress.min = 0; progress.max = 1; progress.step = .001; progress.setAttribute('aria-label', 'Posição da música');
  const clock = el('small', 'np-clock'), controls = el('div', 'np-controls');
  const button = (label, action) => { const b = el('button', '', label); b.type = 'button'; b.title = label; b.setAttribute('aria-label', label); b.onclick = () => { wake(); Promise.resolve().then(action).catch(() => { status.textContent = 'Controle indisponível nesta fonte.'; }); }; return b; };
  const play = button('Reproduzir', () => {
    if (transportPlaying) { navigationPending = false; transportPlaying = false; dynamic?.update(false); return amp.pause(); }
    return amp.play();
  });
  play.classList.add('np-play-toggle');
  const volume = el('input', ''); volume.type = 'range'; volume.min = 0; volume.max = 1; volume.step = .01; volume.setAttribute('aria-label', 'Volume'); volume.oninput = () => amp.setVolume(Number(volume.value));
  controls.append(button('Anterior', () => navigate('previous')), play, button('Próxima', () => navigate('next')), volume);
  const trackInfo = el('div', 'np-metadata'); trackInfo.append(title, artist, metadata);
  chrome.append(trackInfo, progress, clock, controls); left.append(artStage, chrome);
  const right = el('section', 'np-lyrics'), status = el('p', 'np-status'); status.setAttribute('role', 'status');
  const slot = el('div', 'np-lyrics-slot'); right.append(slot, status);
  const quick = el('div', 'np-quick np-chrome');
  const icon = (b, label, path) => {
    b.title = label; b.setAttribute('aria-label', label);
    b.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="${path}"/></svg>`;
    return b;
  };
  const exit = icon(button('Fechar · Esc', close), 'Fechar · Esc', 'M6 6l12 12M18 6L6 18');
  const lyricsToggle = icon(button('', () => { preferences.lyricsEnabled = !preferences.lyricsEnabled; applyPreferences(); }), 'Lyrics', 'M4 5h16M4 10h12M4 15h16M4 20h10');
  const menu = (label, path) => {
    const details = el('details', 'np-menu'), summary = icon(el('summary', ''), label, path);
    summary.setAttribute('aria-label', label); details.append(summary);
    details.addEventListener('toggle', () => {
      if (!details.open) return;
      for (const other of quick.querySelectorAll('details')) if (other !== details) other.open = false;
      wake();
    });
    quick.append(details); return details;
  };
  const videoToggle = icon(button('', () => { videoMode = !videoMode; presentVideo(); motion(videoHost || artStage, [{opacity:.4,transform:'translateX(4px)'},{opacity:1,transform:'translateX(0)'}]); }), 'Exibir vídeo', 'M3 5h12v14H3Z M15 9l6-4v14l-6-4');
  videoToggle.hidden = true; videoToggle.setAttribute('aria-pressed', 'false');
  quick.append(exit, lyricsToggle, videoToggle);
  const visualMenu = menu('Aparência', 'M4 10v4M8 6v12M12 3v18M16 6v12M20 10v4');
  const uiMenu = menu('Visibilidade da interface', 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0');
  const select = (parent, label, entries, change) => {
    const panel = parent.querySelector('.np-menu-panel') || el('div', 'np-menu-panel'), wrapper = el('label', '', label), input = el('select', '');
    input.setAttribute('aria-label', label);
    for (const [value, text] of entries) { const option = el('option', '', text); option.value = value; input.append(option); }
    input.onchange = () => { change(input.value); applyPreferences(); };
    wrapper.append(input); panel.append(wrapper); parent.append(panel); return input;
  };
  const visualSelect = select(visualMenu, 'Visualizer', [['auto','Automático'],['audio','Áudio'],['ambient','Ambiente'],['off','Desligado']], value => { preferences.visualizerMode = value; });
  const uiSelect = select(uiMenu, 'Interface', [['auto','Automático'],['visible','Sempre visível']], value => { preferences.uiMode = value; });
  const backgroundSelect = select(visualMenu, 'Fundo', [['dynamic','Dinâmico'],['static','Estático']], value => { preferences.backgroundMode = value; });
  const hide = button('Ocultar UI agora', () => {
    visualMenu.open = uiMenu.open = false; shell.focus({preventScroll: true});
    clearTimeout(idle); shell.classList.add('np-idle');
  });
  hide.setAttribute('aria-label', 'Ocultar UI agora'); uiMenu.lastChild.append(hide);
  shell.append(atmosphereStage, canvas, left, right, quick); document.body.append(shell);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let trigger, lyrics, trackKey = '', frame = 0, idle = 0, held = false, loading, loadError = false;
  const lyricsProfile = createSpaceampLyricsProfile({isCurrent: component => shell.open && component === lyrics});
  let artworkKey = '', paletteRevision = 0, atmosphereImage;
  let transportPlaying = false, navigationPending = false, navigationSettled = false, navigationOrigin = '';
  let dynamic, dynamicLoading;
  let videoMode = false, videoHost = null;
  const inertBefore = new Map();
  function restoreInert() { for (const [node, value] of inertBefore) node.inert = value; inertBefore.clear(); }
  function isolatePresentation() {
    restoreInert();
    if (!shell.open) return;
    const allowed = [shell, ...(videoMode && videoHost ? [videoHost] : [])];
    function visit(parent) {
      for (const child of parent.children) {
        if (allowed.includes(child)) continue;
        if (allowed.some(node => child.contains(node))) visit(child);
        else { inertBefore.set(child, child.inert); child.inert = true; }
      }
    }
    visit(document.body);
  }
  function positionVideo() {
    if (!videoMode || !videoHost || !shell.open) return;
    const r = artStage.getBoundingClientRect();
    for (const [key, value] of Object.entries({left:r.left, top:r.top, width:r.width, height:r.height})) videoHost.style.setProperty(`--np-video-${key}`, `${value}px`);
  }
  function releaseVideo() {
    if (quick.matches(':popover-open')) quick.hidePopover();
    quick.removeAttribute('popover');
    if (!videoHost) return;
    if (videoHost.matches(':popover-open')) videoHost.hidePopover();
    videoHost.classList.remove('np-video-host'); videoHost.removeAttribute('popover');
    for (const key of ['left','top','width','height']) videoHost.style.removeProperty(`--np-video-${key}`);
    videoHost = null;
  }
  function presentVideo() {
    const s = amp.getPlaybackState(), host = document.querySelector('#music .music-embed');
    const available = s.source.startsWith('YouTube') && !!host?.querySelector('iframe') && typeof host.showPopover === 'function';
    videoToggle.hidden = !available;
    if (!s.source.startsWith('YouTube')) videoMode = false;
    shell.classList.toggle('np-video-mode', videoMode);
    videoToggle.setAttribute('aria-pressed', String(videoMode));
    artStage.setAttribute('aria-hidden', String(videoMode));
    if (!videoMode) releaseVideo();
    else if (available && videoHost !== host) {
      releaseVideo(); videoHost = host;
      videoHost.setAttribute('popover', 'manual'); videoHost.classList.add('np-video-host');
      // Top-layer promotion preserves the iframe context and playback owner.
      videoHost.showPopover();
      quick.setAttribute('popover', 'manual'); quick.showPopover();
    }
    isolatePresentation(); positionVideo();
  }
  new ResizeObserver(positionVideo).observe(artStage);
  window.addEventListener('resize', positionVideo);
  new MutationObserver(() => { if (shell.open) presentVideo(); }).observe(document.querySelector('#music .music-embed'), {childList:true, subtree:true});

  function atmospherePlaying() {
    const s = amp.getPlaybackState();
    // Buffering suspends the media clock, but is not a request to pause presentation.
    return s.playing || s.transitioning || (s.source.startsWith('YouTube') && !s.stopped && s.available && transportPlaying && (navigationPending || s.playbackStatus === 'loading'));
  }
  function dynamicArtwork() {
    if (preferences.backgroundMode !== 'dynamic' || !shell.open || reduced.matches || document.hidden) return;
    // Warm the module while artwork loads, rather than after the front cover decodes.
    dynamicLoading ||= import('./spaceamp-atmosphere.js').then(module => { dynamic = module.createAtmosphere(shell, dynamicCanvas, reduced); dynamic.setEnabled(preferences.backgroundMode === 'dynamic'); return dynamic; });
    const image = atmosphereImage, source = image?.getAttribute('src');
    // Metadata identity remains original; decoded pixels use the restricted delivery URL.
    const delivery = Artwork.url(artworkKey);
    if (!image || source !== delivery) { void dynamicLoading.catch(() => {}); return; }
    void dynamicLoading.then(controller => {
      if (preferences.backgroundMode === 'dynamic' && shell.open && Artwork.url(artworkKey) === source && image === atmosphereImage) { controller.update(atmospherePlaying()); return controller.setArtwork(image); }
    }).catch(() => { shell.dataset.atmosphere = 'static'; });
  }
  const paletteCache = new Map(), motions = new Map();
  const paletteTokens = ['--np-accent', '--np-accent-soft', '--np-bg-tint', '--np-bg-deep'];
  function motion(node, frames, duration = 300) {
    motions.get(node)?.cancel();
    motions.delete(node);
    if (reduced.matches || !shell.open || !node.animate) return;
    const style = getComputedStyle(shell);
    const timing = parseFloat(style.getPropertyValue('--motion-standard'));
    const ms = Number.isFinite(timing) ? timing * (style.getPropertyValue('--motion-standard').trim().endsWith('ms') ? 1 : 1000) : duration;
    const animation = node.animate(frames, {duration: ms, easing: style.getPropertyValue('--ease-xmb').trim() || 'ease', fill: 'none'});
    motions.set(node, animation);
    animation.onfinish = () => { if (motions.get(node) === animation) motions.delete(node); };
  }
  function clearGhosts() { for (const ghost of shell.querySelectorAll('.np-outgoing')) { motions.get(ghost)?.cancel(); motions.delete(ghost); ghost.remove(); } }
  function crossfade(image, parent, source, cls) {
    if (!source || reduced.matches) return;
    const ghost = el('img', `${cls} np-outgoing`); ghost.alt = ''; ghost.setAttribute('aria-hidden', 'true'); ghost.src = Artwork.url(source); parent.append(ghost);
    const opacity = Number.parseFloat(getComputedStyle(ghost).opacity) || 1;
    motion(ghost, [{opacity}, {opacity: 0}]);
    const animation = motions.get(ghost);
    if (animation) animation.onfinish = () => { motions.delete(ghost); ghost.remove(); }; else ghost.remove();
    motion(image, [{opacity: 0}, {opacity}]);
  }
  function applyPalette(colors) {
    for (let i = 0; i < paletteTokens.length; i++) {
      if (colors) shell.style.setProperty(paletteTokens[i], colors[i]); else shell.style.removeProperty(paletteTokens[i]);
    }
    shell.dataset.palette = colors ? 'artwork' : 'fallback';
  }
  // Base follows population; character balances population, chroma and lightness.
  // A minimum sample footprint excludes isolated highlights from the atmosphere.
  function extractPalette(image) {
    const sample = document.createElement('canvas'); sample.width = sample.height = 32;
    const ctx = sample.getContext('2d', {willReadFrequently: true});
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, 32, 32);
    const pixels = ctx.getImageData(0, 0, 32, 32).data, buckets = new Map();
    for (let i = 0; i < pixels.length; i += 4) {
      const [r,g,b,a] = pixels.slice(i, i + 4), light = (Math.max(r,g,b) + Math.min(r,g,b)) / 510;
      if (a < 128 || light < .06 || light > .94) continue;
      const key = (r >> 5) * 64 + (g >> 5) * 8 + (b >> 5);
      const bucket = buckets.get(key) || [0,0,0,0]; bucket[0] += r; bucket[1] += g; bucket[2] += b; bucket[3]++; buckets.set(key, bucket);
    }
    const colors = [...buckets.values()].map(bucket => {
      const [r,g,b] = bucket.slice(0,3).map(v => v / bucket[3] / 255), max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
      const h = !d ? 0 : max === r ? ((g-b)/d + 6) % 6 : max === g ? (b-r)/d + 2 : (r-g)/d + 4;
      const saturation = !d ? 0 : d / (1 - Math.abs(max + min - 1));
      const light = (max + min) / 2;
      return {rgb:[r,g,b], h:h * 60, saturation, chroma:d, count:bucket[3], score:Math.sqrt(bucket[3]) * (.12 + d * 3) * (.4 + .6 * (1 - Math.abs(light - .5) * 1.5))};
    });
    const base = colors.sort((a,b) => b.count - a.count)[0];
    const character = colors.filter(c => c.count >= 21 && c.chroma >= .08).sort((a,b) => b.score - a.score)[0];
    if (!base || !character) return null; // Neutral artwork keeps the theme fallback.
    const [r,g,b] = base.rgb.map((v,i) => v * .3 + character.rgb[i] * .7);
    const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
    const tintHue = !d ? character.h : (max === r ? ((g-b)/d + 6) % 6 : max === g ? (b-r)/d + 2 : (r-g)/d + 4) * 60;
    const tintSaturation = !d ? 0 : d / (1 - Math.abs(max + min - 1));
    const h = Math.round(character.h), s = Math.round(Math.min(.68, character.saturation * .88) * 100);
    const th = Math.round(tintHue), ts = Math.round(Math.min(.68, tintSaturation * .92) * 100);
    return [`hsl(${h} ${s}% 72%)`, `hsl(${h} ${Math.round(s * .72)}% 56%)`, `hsl(${th} ${ts}% 32%)`, `hsl(${th} ${Math.round(ts * .8)}% 12%)`];
  }
  function palette(source) {
    const revision = ++paletteRevision;
    if (!source) { atmosphereImage = null; applyPalette(null); return; }
    if (paletteCache.has(source)) applyPalette(paletteCache.get(source));
    const image = new Image(); image.crossOrigin = 'anonymous';
    const commit = (colors, safeImage = null) => {
      if (revision !== paletteRevision || artworkKey !== source) return;
      if (paletteCache.size >= 32) paletteCache.delete(paletteCache.keys().next().value);
      paletteCache.set(source, colors); atmosphereImage = safeImage; applyPalette(colors);
      // Reuse the CORS-readable palette image; a displayed remote cover is tainted for WebGL.
      if (safeImage) dynamicArtwork(); else dynamic?.setArtwork(null);
    };
    image.onload = () => { try { commit(paletteCache.has(source) ? paletteCache.get(source) : extractPalette(image), image); } catch { commit(null); } };
    image.onerror = () => commit(null); image.src = Artwork.url(source);
  }
  function updateArtwork(source) {
    if (source === artworkKey) return;
    artworkKey = source; cover.dataset.artworkKey = artworkKey; atmosphereImage = null; ++paletteRevision; clearGhosts();
    const previous = cover.dataset.artworkReady === 'true' ? cover.getAttribute('src') : '';
    if (!source) {
      Artwork.clear(cover);
      // Keep the last decoded background while the next track's metadata arrives.
      // Its replacement is committed only after decoding, avoiding a fallback flash.
      return;
    }
    palette(source); dynamicArtwork();
    Artwork.set(cover, source, {ready: () => {
      if (artworkKey !== source) return;
      if (!window.XmbHandoff?.covers(source)) crossfade(cover, artStage, previous, 'np-cover np-cover-previous');
      const background = atmosphere.getAttribute('src');
      Artwork.set(atmosphere, source, {ready: () => {
        if (artworkKey === source) crossfade(atmosphere, atmosphereStage, background, 'np-atmosphere np-atmosphere-previous');
      }});
    }, error: () => { if (artworkKey === source && !previous) applyPalette(null); }});
  }
  reduced.addEventListener?.('change', () => { if (reduced.matches) { for (const animation of motions.values()) animation.cancel(); motions.clear(); clearGhosts(); } else dynamicArtwork(); });
  document.addEventListener('visibilitychange', () => { if (!dynamic && !document.hidden) dynamicArtwork(); });
  // No PCM access for iframe sources. Tap ONLY the existing local audio element.
  // An element capture stream avoids rerouting its audible output: later remote
  // sources cannot be silenced by MediaElementSource CORS restrictions.
  const visualizer = createSpaceampVisualizer({ amp, shell, canvas, preferences, reduced });
  function applyPreferences(persist = true) {
    const backgroundChanged = shell.dataset.backgroundMode !== preferences.backgroundMode;
    shell.dataset.backgroundMode = backgroundSelect.value = preferences.backgroundMode;
    dynamic?.setEnabled(preferences.backgroundMode === 'dynamic');
    if (backgroundChanged && preferences.backgroundMode === 'dynamic') dynamicArtwork();
    shell.classList.toggle('np-no-lyrics', !preferences.lyricsEnabled);
    right.inert = !preferences.lyricsEnabled; right.setAttribute('aria-hidden', String(!preferences.lyricsEnabled));
    lyricsToggle.setAttribute('aria-pressed', String(preferences.lyricsEnabled));
    lyricsToggle.title = preferences.lyricsEnabled ? 'Lyrics: ON' : 'Lyrics: OFF';
    shell.dataset.visualizerMode = visualSelect.value = preferences.visualizerMode;
    shell.dataset.uiMode = uiSelect.value = preferences.uiMode;
    if (persist) try { localStorage.setItem(preferenceKey, JSON.stringify(preferences)); } catch { /* Presentation still works without storage. */ }
    sync(); visualizer(); wake();
  }
  function load() {
    if (!loading) loading = import('./vendor/am-lyrics-1.7.4.js')
      .then(() => { if (shell.open) { status.textContent = 'Letras fornecidas por am-lyrics · disponibilidade varia por faixa.'; sync(); } })
      .catch(() => { loadError = true; status.textContent = 'Não foi possível carregar o motor de letras. A reprodução continua.'; });
    return loading;
  }
  const seekable = s => s.available && (s.source === 'local' || s.source === 'áudio' || s.source.startsWith('YouTube'));
  let pendingSeek = null, seekRevision = 0;
  let presentationClock = null;
  function lyricsTime(realMs, playing, now) {
    const clock = presentationClock;
    const predicted = clock ? clock.baseTimeMs + (clock.playing ? now - clock.basePerformanceTime : 0) : realMs;
    if (pendingSeek) {
      const confirmed = Math.abs(realMs - pendingSeek.targetMs) < 250;
      if (!confirmed && now - pendingSeek.startedAt < 1200) return pendingSeek.targetMs;
      pendingSeek = null;
      presentationClock = {baseTimeMs: realMs, basePerformanceTime: now, playing, checkedAt: now};
      return realMs;
    }
    if (!clock || clock.playing !== playing) {
      const position = clock && !playing ? predicted : realMs;
      presentationClock = {baseTimeMs: position, basePerformanceTime: now, playing, checkedAt: now};
      return position;
    }
    if (!playing) return predicted;
    if (now - clock.checkedAt >= 500) {
      clock.checkedAt = now;
      if (Math.abs(realMs - predicted) > 350) {
        clock.baseTimeMs = realMs; clock.basePerformanceTime = now;
        return realMs;
      }
    }
    return predicted;
  }
  function seek(seconds) {
    if (!seekable(amp.getPlaybackState()) || !Number.isFinite(seconds)) return;
    const now = performance.now(), targetMs = Math.max(0, seconds * 1000);
    pendingSeek = {revision: ++seekRevision, targetMs, startedAt: now};
    presentationClock = {baseTimeMs: targetMs, basePerformanceTime: now, playing: amp.getPlaybackState().playing, checkedAt: now};
    if (lyrics) lyrics.currentTime = targetMs;
    // Player seek can acknowledge asynchronously. sync must not restore stale time.
    amp.seek(seconds);
  }
  progress.oninput = () => seek(Number(progress.value) * (amp.getPlaybackTime().duration || 0));
  function sync() {
    input.reconcile();
    if (!shell.open) return;
    const s = amp.getPlaybackState(), time = amp.getPlaybackTime();
    const ms = Math.max(0, (time.position || 0) * 1000), duration = Math.max(0, (time.duration || 0) * 1000);
    if (lyrics) {
      // Property is the authoritative API (upstream attribute aliases vary).
      const visualMs = Math.max(0, Math.min(duration || Infinity, lyricsTime(ms, s.playing, performance.now())));
      if (lyrics.currentTime !== visualMs) lyrics.currentTime = visualMs;
      // -1 means reset in upstream, not pause. A paused view keeps its position.
      if (lyrics.duration !== duration) lyrics.duration = duration;
      // song-duration changes the provider query; late YouTube duration must not reload lyrics.
    }
    progress.disabled = !seekable(s) || !duration;
    if (document.activeElement !== progress) progress.value = duration ? ms / duration : 0;
    const clockText = `${format(ms / 1000)} / ${format(duration / 1000)}`;
    if (clock.textContent !== clockText) clock.textContent = clockText;
  }
  function format(t) { return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`; }
  function tick() { frame = 0; if (!shell.open || !amp.getPlaybackState().playing) return; sync(); visualizer(); frame = requestAnimationFrame(tick); }
  let navigationRevision = 0;
  async function navigate(action) {
    const revision = ++navigationRevision;
    navigationPending = true; navigationSettled = false; navigationOrigin = trackKey;
    update();
    try { await amp[action](); } catch (error) { if (revision === navigationRevision) navigationPending = false; throw error; }
    finally { if (revision === navigationRevision) { navigationSettled = true; update(); } }
  }
  function update() {
    if (!shell.open) return;
    const s = amp.getPlaybackState();
    presentVideo();
    const key = JSON.stringify([s.title, s.artist, s.sourceUrl, s.isrc || ""]);
    updateArtwork(s.artwork || '');
    if (key !== trackKey) {
      pendingSeek = null; presentationClock = null;
      const changing = !!trackKey;
      if (!changing) transportPlaying = false; trackKey = key;
      title.textContent = s.title; artist.textContent = s.artist; metadata.textContent = s.source;
      if (changing) motion(trackInfo, [{opacity: .25, transform: 'translateX(6px)'}, {opacity: 1, transform: 'translateX(0)'}]);
      // Fresh component isolates pending provider responses and removes old lyrics immediately.
      lyricsProfile.clear();
      lyrics = el('am-lyrics', '');
      for (const [name, value] of Object.entries({'song-title': s.title, 'song-artist': s.artist, 'song-album': s.albumTitle, 'song-duration': Math.max(0, amp.getPlaybackTime().duration || 0) * 1000 || undefined, isrc: s.isrc, query: `${s.title} ${s.artist}`, 'font-family': getComputedStyle(shell).fontFamily})) if (value) lyrics.setAttribute(name, value);
      lyrics.setAttribute('autoscroll', ''); lyrics.setAttribute('interpolate', '');
      lyrics.addEventListener('line-click', event => { wake(); seek(Number(event.detail?.timestamp) / 1000); });
      slot.replaceChildren(lyrics);
      lyricsProfile.apply(lyrics);
      input.reconcile();
      if (changing && preferences.lyricsEnabled) motion(slot, [{opacity: .92}, {opacity: 1}]);
      // Provider loading/no-match/instrumental/error UI is owned by am-lyrics;
      // upstream has no public resolution-status event. Do not inspect private state or Shadow DOM.
      status.textContent = loadError ? 'Motor de letras indisponível. A reprodução continua.' : customElements.get('am-lyrics') ? 'Letras fornecidas por am-lyrics · disponibilidade varia por faixa.' : 'Carregando motor de letras…';
    }
    // Buffering is not an explicit pause; keep the transport action stable across a seek.
    if ((s.playing && (key !== navigationOrigin || navigationSettled)) || (navigationSettled && !s.source.startsWith('YouTube') && s.playbackStatus !== 'loading') || s.stopped || !s.available || ['error','blocked'].includes(s.playbackStatus)) navigationPending = false;
    transportPlaying = s.playing || s.transitioning || navigationPending || (s.playbackStatus === 'loading' && transportPlaying && !s.stopped);
    dynamic?.update(atmospherePlaying());
    const label = transportPlaying ? 'Pausar' : 'Reproduzir';
    if (play.textContent !== label) {
      play.textContent = label; play.title = label; play.setAttribute('aria-label', label);
      motion(play, [{opacity: .55, transform: 'translateY(2px)'}, {opacity: 1, transform: 'translateY(0)'}]);
    }
    volume.value = s.volume;
    sync();
    if (s.playing) { if (!frame) { visualizer(); frame = requestAnimationFrame(tick); } }
    else { cancelAnimationFrame(frame); frame = 0; visualizer(); }
  }
  const lyricsAvailable = () => preferences.lyricsEnabled && !right.inert && right.getClientRects().length > 0;
  const lyricsNavigation = createSpaceampLyricsNavigation({
    getComponent: () => lyrics,
    isAvailable: lyricsAvailable,
  });
  const input = createSpaceampNowPlayingInput({
    shell, quick, controls, progress, volume, visualMenu, uiMenu,
    wake, close, lyricsNavigation, lyricsAvailable,
  });
  function wake() {
    shell.classList.remove('np-idle'); clearTimeout(idle);
    if (!shell.open || preferences.uiMode !== 'auto') return;
    idle = setTimeout(() => {
      const focused = document.activeElement;
      if (held || visualMenu.open || uiMenu.open || (!input.isGamepadFocus() && focused !== shell && shell.contains(focused))) { wake(); return; }
      shell.classList.add('np-idle');
    }, 4500);
  }
  function open(source) {
    if (shell.open) return;
    input.reset();
    trigger = source || document.activeElement;
    videoMode = false; shell.inert = false; shell.show(); shell.focus({preventScroll: true});
    document.body.classList.add('amp-now-playing-open'); trackKey = ''; update(); dynamicArtwork(); wake(); void load();
  }
  function close() {
    if (!shell.open) return;
    window.dispatchEvent(new Event('spaceamp:nowplaying-closing'));
    pendingSeek = null; presentationClock = null;
    clearTimeout(idle); cancelAnimationFrame(frame); frame = 0; held = false; navigationPending = false;
    lyricsProfile.clear();
    input.reset();
    dynamic?.close();
    for (const animation of motions.values()) animation.cancel(); motions.clear(); clearGhosts();
    visualMenu.open = uiMenu.open = false;
    if (lyrics) lyrics.duration = -1;
    videoMode = false; releaseVideo(); shell.classList.remove('np-video-mode'); restoreInert();
    shell.close(); document.body.classList.remove('amp-now-playing-open'); trigger?.focus?.({preventScroll: true});
    window.dispatchEvent(new Event('spaceamp:nowplaying-closed'));
  }
  document.addEventListener('keydown', e => {
    if (!shell.open || e.key !== 'Tab') return;
    const targets = [...shell.querySelectorAll('button,input,select,summary'), ...(videoMode && videoHost ? videoHost.querySelectorAll('iframe') : [])].filter(n => !n.disabled && !n.closest('[inert]') && n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden');
    const first = targets[0], last = targets.at(-1);
    if (e.shiftKey && (document.activeElement === first || document.activeElement === shell)) { e.preventDefault(); last?.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
  }, true);
  shell.addEventListener('cancel', e => { e.preventDefault(); close(); });
  shell.addEventListener('keydown', e => {
    wake();
    if (e.key === 'Escape' || (e.key === 'Backspace' && document.body.classList.contains('xmb-active'))) { e.preventDefault(); e.stopImmediatePropagation(); close(); }
  });
  for (const type of ['pointermove', 'wheel', 'touchstart', 'touchmove', 'focusin']) shell.addEventListener(type, wake, {passive: true});
  shell.addEventListener('pointerdown', () => { held = true; wake(); });
  window.addEventListener('pointerup', () => { held = false; if (shell.open) wake(); });
  window.addEventListener('pointercancel', () => { held = false; if (shell.open) wake(); });
  shell.addEventListener('touchend', wake, {passive: true});
  for (const type of ['spaceamp:trackchange', 'spaceamp:progress', 'spaceamp:playstate']) window.addEventListener(type, () => {
    update();
  });
  document.getElementById('audio').addEventListener('seeked', () => { if (!pendingSeek) presentationClock = null; sync(); });
  // Delegation survives compact-player mounting and artwork replacement.
  document.addEventListener('click', e => { const source = e.target.closest?.('#album,.amp-mini-cover'); if (source) open(source); });
  for (const source of document.querySelectorAll('#album,.amp-mini-cover')) {
    source.tabIndex = 0; source.setAttribute('role', 'button'); source.setAttribute('aria-label', 'Abrir Now Playing');
    source.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(source); } });
  }
  window.SpaceAmpNowPlaying = {open, close, isOpen: () => shell.open};
  applyPreferences(false);
})();
