/* UI adapter: future signaling/peer playback can consume the call controller. */
function createSpaceVoice({ getProfile, el, button }) {
  const call = createVoiceCall(createVoiceMedia());
  const root = el('section', 'panel spacevoice');
  root.setAttribute('aria-label', 'SPACEVOICE v0.3');
  const header = el('header', 'section-head');
  header.append(el('h2', '', 'SPACEVOICE'), el('span', 'spacevoice-version', 'v0.3 / WebSocket / áudio P2P'));
  const body = el('div', 'spacevoice-body'), sidebar = el('aside', 'spacevoice-room');
  sidebar.append(el('h3', '', '// geral'));
  const participants = el('ul', 'spacevoice-participants'), participant = el('li');
  participants.append(participant); sidebar.append(participants);
  const stage = el('div', 'spacevoice-stage');
  stage.append(el('h3', '', 'Chamada P2P'), el('p', '', 'Entre na sala geral para conversar. Use headset para evitar feedback.'));
  const join = button('[ entrar na chamada ]', () => call.join());
  stage.append(join);
  body.append(sidebar, stage);
  const controls = el('div', 'spacevoice-controls');
  controls.setAttribute('aria-label', 'Controles da chamada');
  const mic = button('[ mic ]', () => call.toggleMute());
  const deafen = button('[ deafen ]', () => call.toggleDeafen());
  deafen.title = 'Silenciar apenas a reprodução remota nesta aba.';
  const share = button('[ compartilhar tela · em breve ]', () => {});
  share.disabled = true;
  const leave = button('[ sair ]', () => call.leave());
  controls.append(mic, deafen, share, leave);
  const status = el('p', 'spacevoice-status'); status.setAttribute('role', 'status');
  const device = el('p', 'spacevoice-device');
  root.append(header, body, controls, status, device);
  const clientId = window.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
  const audioByPeer = new Map();
  let remotes = [], networkError = '', currentStream = null, signalingStatus = '';
  const config = window.SPACEVOICE_CONFIG || {};
  const params = new URLSearchParams(window.location?.search || '');
  const transportName = params.get('voiceTransport') || config.transport || 'websocket';
  const signalingFactory = transportName === 'local' ? globalThis.createLocalVoiceSignaling : globalThis.createWebSocketVoiceSignaling;
  const resume = button('[ reproduzir áudio remoto ]', () => {
    for (const audio of audioByPeer.values()) play(audio);
  });
  resume.hidden = true; controls.append(resume);
  function play(audio) {
    const result = audio.play?.();
    result?.then(() => { if (audioByPeer.size) resume.hidden = true; }).catch(() => {
      if ([...audioByPeer.values()].includes(audio)) resume.hidden = false;
    });
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
    onRemove: id => {
      const audio = audioByPeer.get(id);
      if (audio) { audio.pause?.(); audio.srcObject = null; audio.remove(); audioByPeer.delete(id); }
      if (!audioByPeer.size) resume.hidden = true;
    },
    onError: message => { networkError = message; render(); },
  });
  function render(state = call.state) {
    root.dataset.joined = String(state.joined);
    participant.textContent = (getProfile().name || 'Meu perfil') + (state.joined ? (state.muted ? ' · mic desligado' : ' · microfone ativo') : ' · fora da chamada');
    participants.replaceChildren(participant);
    for (const remote of remotes) participants.append(el('li', '', 'Convidado · ' + remote.status));
    for (const audio of audioByPeer.values()) audio.muted = state.deafened;
    join.hidden = state.joined; join.disabled = state.joining;
    join.textContent = state.joining ? '[ aguardando microfone… ]' : '[ entrar na chamada ]';
    mic.disabled = deafen.disabled = !state.joined;
    leave.disabled = !state.joined && !state.joining;
    mic.setAttribute('aria-pressed', String(state.muted));
    mic.setAttribute('aria-label', state.muted ? 'Ativar microfone' : 'Silenciar microfone');
    mic.textContent = state.muted ? '[ mic desligado ]' : '[ mic ]';
    deafen.setAttribute('aria-pressed', String(state.deafened));
    deafen.textContent = state.deafened ? '[ deafen · ligado (local) ]' : '[ deafen ]';
    status.textContent = state.error || networkError || (state.joined ? (remotes.length ? 'WebRTC · ' + remotes[0].status : (signalingStatus && signalingStatus !== 'conectado' ? 'Signaling · ' + signalingStatus : 'Microfone ativo · aguardando peer na sala geral')) : state.joining ? 'Aguardando permissão do navegador…' : 'Clique em entrar na chamada para solicitar o microfone.');
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
    render(state);
  });
  window.addEventListener('pagehide', () => call.leave());
  return { root, call, show: () => render(), leave: () => call.leave() };
}
