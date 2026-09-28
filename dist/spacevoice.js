/* UI adapter: future signaling/peer playback can consume the call controller. */
function createSpaceVoice({ getProfile, el, button }) {
  const call = createVoiceCall(createVoiceMedia());
  const root = el('section', 'panel spacevoice');
  root.setAttribute('aria-label', 'SPACEVOICE v0.1');
  const header = el('header', 'section-head');
  header.append(el('h2', '', 'SPACEVOICE'), el('span', 'spacevoice-version', 'v0.1 / mídia local'));
  const body = el('div', 'spacevoice-body'), sidebar = el('aside', 'spacevoice-room');
  sidebar.append(el('h3', '', '// geral'));
  const participants = el('ul', 'spacevoice-participants'), participant = el('li');
  participants.append(participant); sidebar.append(participants);
  const stage = el('div', 'spacevoice-stage');
  stage.append(el('h3', '', 'Chamada local'), el('p', '', 'Nesta versão, apenas seu microfone. Nenhum áudio é transmitido ou reproduzido.'));
  const join = button('[ entrar na chamada ]', () => call.join());
  stage.append(join);
  body.append(sidebar, stage);
  const controls = el('div', 'spacevoice-controls');
  controls.setAttribute('aria-label', 'Controles da chamada');
  const mic = button('[ mic ]', () => call.toggleMute());
  const deafen = button('[ deafen ]', () => call.toggleDeafen());
  deafen.title = 'Preferência local preparada para futura reprodução remota; não há áudio remoto nesta versão.';
  const share = button('[ compartilhar tela · em breve ]', () => {});
  share.disabled = true;
  const leave = button('[ sair ]', () => call.leave());
  controls.append(mic, deafen, share, leave);
  const status = el('p', 'spacevoice-status'); status.setAttribute('role', 'status');
  const device = el('p', 'spacevoice-device');
  root.append(header, body, controls, status, device);
  function render(state = call.state) {
    root.dataset.joined = String(state.joined);
    participant.textContent = (getProfile().name || 'Meu perfil') + (state.joined ? (state.muted ? ' · mic desligado' : ' · conectado localmente') : ' · fora da chamada');
    join.hidden = state.joined; join.disabled = state.joining;
    join.textContent = state.joining ? '[ aguardando microfone… ]' : '[ entrar na chamada ]';
    mic.disabled = deafen.disabled = !state.joined;
    leave.disabled = !state.joined && !state.joining;
    mic.setAttribute('aria-pressed', String(state.muted));
    mic.setAttribute('aria-label', state.muted ? 'Ativar microfone' : 'Silenciar microfone');
    mic.textContent = state.muted ? '[ mic desligado ]' : '[ mic ]';
    deafen.setAttribute('aria-pressed', String(state.deafened));
    deafen.textContent = state.deafened ? '[ deafen · ligado (local) ]' : '[ deafen ]';
    status.textContent = state.error || (state.joined ? 'Conectado localmente · sem participantes remotos' : state.joining ? 'Aguardando permissão do navegador…' : 'Clique em entrar na chamada para solicitar o microfone.');
    device.textContent = state.localStream?.getAudioTracks()[0]?.label || '';
    device.hidden = !device.textContent;
  }
  call.subscribe(render);
  window.addEventListener('pagehide', () => call.leave());
  return { root, call, show: () => render(), leave: () => call.leave() };
}
