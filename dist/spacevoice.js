/* UI adapter: future signaling/peer playback can consume the call controller. */
function createSpaceVoice({ getProfile, el, button }) {
  const call = createVoiceCall(createVoiceMedia());
  const root = el('section', 'panel spacevoice');
  root.setAttribute('aria-label', 'SPACEVOICE v0.5');
  const header = el('header', 'section-head');
  header.append(el('h2', '', 'SPACEVOICE'), el('span', 'spacevoice-version', 'v0.5 / voz + tela P2P'));
  const body = el('div', 'spacevoice-body'), sidebar = el('aside', 'spacevoice-room');
  sidebar.append(el('h3', '', '// geral'));
  const participants = el('ul', 'spacevoice-participants'), participant = el('li');
  participants.append(participant); sidebar.append(participants);
  const stage = el('div', 'spacevoice-stage');
  stage.append(el('h3', '', 'Chamada P2P'), el('p', '', 'Entre na sala geral para conversar. Use headset para evitar feedback.'));
  const join = button('[ entrar na chamada ]', () => call.join());
  stage.append(join);
  const screenArea = el('div', 'spacevoice-screens');
  const screenTabs = el('div', 'spacevoice-screen-tabs'); screenTabs.setAttribute('aria-label', 'Telas disponíveis');
  const screenViewer = el('div', 'spacevoice-screen-viewer');
  screenArea.append(screenTabs, screenViewer); screenArea.hidden = true; stage.append(screenArea);
  body.append(sidebar, stage);
  const controls = el('div', 'spacevoice-controls');
  controls.setAttribute('aria-label', 'Controles da chamada');
  const mic = button('[ mic ]', () => call.toggleMute());
  const deafen = button('[ deafen ]', () => call.toggleDeafen());
  deafen.title = 'Silenciar apenas a reprodução remota nesta aba.';
  const qualityLabel = el('label', 'spacevoice-quality', 'Tela: ');
  const quality = el('select'); quality.setAttribute('aria-label', 'Qualidade da tela');
  for (const preset of ['720p60','1080p30','1080p60','1440p60']) { const option = el('option', '', preset); option.value = preset; quality.append(option); }
  quality.value = '1080p60'; qualityLabel.append(quality);
  const share = button('[ compartilhar tela ]', () => call.state.screenSharing ? call.stopScreenShare() : call.startScreenShare(quality.value));
  const leave = button('[ sair ]', () => call.leave());
  controls.append(mic, deafen, qualityLabel, share, leave);
  const screenStatus = el('p', 'spacevoice-screen-status'); screenStatus.setAttribute('role', 'status');
  const status = el('p', 'spacevoice-status'); status.setAttribute('role', 'status');
  const device = el('p', 'spacevoice-device');
  root.append(header, body, controls, screenStatus, status, device);
  const clientId = window.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
  const audioByPeer = new Map();
  const screens = new Map(), blockedPlayback = new Set();
  let focusedScreen = null;
  let remotes = [], networkError = '', currentStream = null, currentScreen = null, signalingStatus = '';
  const config = window.SPACEVOICE_CONFIG || {};
  const params = new URLSearchParams(window.location?.search || '');
  const transportName = params.get('voiceTransport') || config.transport || 'websocket';
  const signalingFactory = transportName === 'local' ? globalThis.createLocalVoiceSignaling : globalThis.createWebSocketVoiceSignaling;
  const resume = button('[ reproduzir áudio remoto ]', () => {
    for (const audio of audioByPeer.values()) play(audio);
    const selected = screens.get(focusedScreen); if (selected) play(selected.video);
  });
  resume.hidden = true; controls.append(resume);
  function play(audio) {
    const result = audio.play?.();
    result?.then(() => { blockedPlayback.delete(audio); resume.hidden = !blockedPlayback.size; }).catch(() => {
      if ([...audioByPeer.values(), ...[...screens.values()].map(s => s.video)].includes(audio)) { blockedPlayback.add(audio); resume.hidden = false; }
    });
  }
  function updateScreen(id, stream, local = false) {
    let entry = screens.get(id);
    if (!stream) {
      if (entry) { entry.video.pause?.(); entry.video.srcObject = null; entry.video.remove(); blockedPlayback.delete(entry.video); screens.delete(id); }
    } else {
      if (!entry) {
        const video = el('video'); video.autoplay = true; video.playsInline = true; video.controls = true;
        video.setAttribute('aria-label', local ? 'Sua tela' : 'Tela do convidado');
        video.addEventListener?.('volumechange', () => { if (local || call.state.deafened || id !== focusedScreen) video.muted = true; });
        entry = { video, local }; screens.set(id, entry); screenViewer.append(video);
      }
      if (entry.video.srcObject !== stream) entry.video.srcObject = stream;
    }
    renderScreens();
  }
  function renderScreens() {
    if (!screens.has(focusedScreen)) focusedScreen = screens.keys().next().value ?? null;
    screenArea.hidden = !screens.size;
    screenTabs.replaceChildren();
    let index = 0;
    for (const [id, entry] of screens) {
      const tab = button('[ ' + (entry.local ? (getProfile().name || 'Você') : 'Convidado ' + (++index)) + ' · tela ]', () => { focusedScreen = id; renderScreens(); });
      tab.setAttribute('aria-pressed', String(id === focusedScreen)); screenTabs.append(tab);
      entry.video.hidden = id !== focusedScreen;
      entry.video.muted = entry.local || call.state.deafened || id !== focusedScreen;
      if (id === focusedScreen) play(entry.video);
      else { blockedPlayback.delete(entry.video); entry.video.pause?.(); }
    }
    resume.hidden = !blockedPlayback.size;
  }
  const session = createVoiceSession({ clientId,
    signaling: options => signalingFactory({ ...options, url:params.get('voiceWsUrl') || config.url }),
    peer: options => createVoicePeer({ ...options, iceServers:config.iceServers || [{urls:'stun:stun.l.google.com:19302'}] }),
    onStatus: value => { signalingStatus = value; render(); },
    onPeers: peers => { remotes = peers; render(); },
    onStream: (id, stream) => {
      let audio = audioByPeer.get(id);
      if (!audio) { audio = el('audio'); audio.autoplay = true; audio.hidden = true; audioByPeer.set(id, audio); root.append(audio); }
      audio.srcObject = stream; audio.muted = call.state.deafened; play(audio);
    },
    onScreen: (id, stream) => updateScreen(id, stream),
    onRemove: id => {
      const audio = audioByPeer.get(id);
      if (audio) { audio.pause?.(); audio.srcObject = null; audio.remove(); blockedPlayback.delete(audio); audioByPeer.delete(id); }
      updateScreen(id, null);
    },
    onError: message => { networkError = message; render(); },
  });
  function render(state = call.state) {
    root.dataset.joined = String(state.joined);
    participant.textContent = (getProfile().name || 'Meu perfil') + (state.joined ? (state.muted ? ' · mic desligado' : ' · você / microfone ativo') : ' · fora da chamada');
    participants.replaceChildren(participant);
    for (const remote of remotes) participants.append(el('li', '', 'Convidado · ' + remote.status));
    for (const audio of audioByPeer.values()) audio.muted = state.deafened;
    for (const [id, entry] of screens) entry.video.muted = entry.local || state.deafened || id !== focusedScreen;
    share.disabled = !state.joined || state.screenStarting;
    share.textContent = state.screenSharing ? '[ parar tela ]' : state.screenStarting ? '[ escolhendo tela… ]' : '[ compartilhar tela ]';
    quality.disabled = !state.joined || state.screenStarting || state.screenSharing;
    const capture = state.screenStream?.getVideoTracks()[0]?.getSettings?.() || {};
    const actual = [capture.width && capture.height ? capture.width + '×' + capture.height : '', capture.frameRate ? capture.frameRate + ' fps' : '', capture.displaySurface || ''].filter(Boolean);
    screenStatus.textContent = state.screenError || (state.screenSharing ? 'Compartilhando' + (actual.length ? ' · ' + actual.join(' · ') : '') : '');
    screenStatus.hidden = !screenStatus.textContent;
    join.hidden = state.joined; join.disabled = state.joining;
    join.textContent = state.joining ? '[ aguardando microfone… ]' : '[ entrar na chamada ]';
    mic.disabled = deafen.disabled = !state.joined;
    leave.disabled = !state.joined && !state.joining;
    mic.setAttribute('aria-pressed', String(state.muted));
    mic.setAttribute('aria-label', state.muted ? 'Ativar microfone' : 'Silenciar microfone');
    mic.textContent = state.muted ? '[ mic desligado ]' : '[ mic ]';
    deafen.setAttribute('aria-pressed', String(state.deafened));
    deafen.textContent = state.deafened ? '[ deafen · ligado (local) ]' : '[ deafen ]';
    status.textContent = state.error || networkError || (state.joined ? (remotes.length ? 'WebRTC · ' + remotes.filter(p => p.status === 'conectado').length + '/' + remotes.length + ' peers conectados' : (signalingStatus && signalingStatus !== 'conectado' ? 'Signaling · ' + signalingStatus : 'Microfone ativo · aguardando peer na sala geral')) : state.joining ? 'Aguardando permissão do navegador…' : 'Clique em entrar na chamada para solicitar o microfone.');
    device.textContent = state.localStream?.getAudioTracks()[0]?.label || '';
    device.hidden = !device.textContent;
  }
  call.subscribe(state => {
    if (currentStream !== state.localStream) {
      currentStream = state.localStream;
      networkError = '';
      signalingStatus = '';
      session.close();
      if (currentStream) {
        try { session.start(currentStream, state.roomId); }
        catch (error) { call.leave(); networkError = 'WebRTC/signaling indisponível: ' + error.message; }
      }
    }
    if (currentScreen !== state.screenStream) {
      currentScreen = state.screenStream;
      session.setScreen?.(currentScreen, globalThis.VOICE_SCREEN_PRESETS?.[state.screenPreset]?.maxBitrate || 10000000);
      updateScreen(clientId, currentScreen, true);
    }
    render(state);
  });
  window.addEventListener('pagehide', () => call.leave());
  return { root, call, show: () => render(), leave: () => call.leave() };
}
