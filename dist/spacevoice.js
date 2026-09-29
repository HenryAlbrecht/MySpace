/* UI adapter: future signaling/peer playback can consume the call controller. */
function createSpaceVoice({ getProfile, el, button }) {
  const media = createVoiceMedia();
  let session;
  const devices = createVoiceDevices({media, onChange:refreshDevices, onError:message => { audioError = message; render(); }});
  const call = createVoiceCall(media, {inputId:devices.preferences.preferredAudioInputId,
    replaceMicrophone:stream => session.replaceMicrophone(stream), onInput:id => devices.setInput(id)});
  const levels = createVoiceLevels({onError:message => { audioError = message; render(); }});
  const root = el('section', 'panel spacevoice');
  root.setAttribute('aria-label', 'SPACEVOICE v0.6');
  const header = el('header', 'section-head');
  header.append(el('h2', '', 'SPACEVOICE'), el('span', 'spacevoice-version', 'v0.6 / voz + tela P2P'));
  const body = el('div', 'spacevoice-body'), sidebar = el('aside', 'spacevoice-room');
  sidebar.append(el('h3', '', '// geral'));
  const participants = el('ul', 'spacevoice-participants'), participant = el('li');
  const localName = el('span'), localSpeaking = el('span', 'spacevoice-speaking');
  participant.append(localName,localSpeaking);
  participants.append(participant); sidebar.append(participants);
  const stage = el('div', 'spacevoice-stage');
  stage.append(el('h3', '', 'Chamada P2P'), el('p', '', 'Entre na sala geral para conversar. Use headset para evitar feedback.'));
  const join = button('[ entrar na chamada ]', () => { levels.start(); void devices.start().then(() => { call.state.inputId = devices.preferences.preferredAudioInputId; return call.join(); }); });
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
  function selectControl(text, name) {
    const label = el('label','spacevoice-quality',text), select = el('select');
    select.setAttribute('aria-label',name); label.append(select); return {label,select};
  }
  const input = selectControl('Mic: ','Microfone'), output = selectControl('Saída: ','Saída de áudio');
  input.select.onchange = () => { void call.switchMicrophone(input.select.value); };
  input.select.onfocus = () => { void devices.start(); };
  output.select.onchange = () => { audioError = ''; void devices.setOutput(output.select.value,remoteElements()); };
  const outputNote = el('span','spacevoice-output-note','saída controlada pelo sistema'); outputNote.hidden = devices.sinkSupported;
  output.label.hidden = !devices.sinkSupported;
  const meterLabel = el('label','spacevoice-input-meter','mic '), meter = el('meter');
  meter.min = 0; meter.max = 1; meter.value = 0; meter.setAttribute('aria-label','Nível do microfone'); meterLabel.append(meter);
  controls.append(mic, deafen, input.label, output.label, outputNote, meterLabel, qualityLabel, share, leave);
  const screenStatus = el('p', 'spacevoice-screen-status'); screenStatus.setAttribute('role', 'status');
  const status = el('p', 'spacevoice-status'); status.setAttribute('role', 'status');
  const device = el('p', 'spacevoice-device');
  root.append(header, body, controls, screenStatus, status, device);
  const clientId = window.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
  const audioByPeer = new Map();
  const rows = new Map();
  const screens = new Map(), blockedPlayback = new Set();
  let focusedScreen = null;
  let remotes = [], networkError = '', audioError = '', currentStream = null, currentScreen = null, signalingStatus = '', lastOutput = devices.preferences.preferredAudioOutputId, lastMuted = false, sessionStarted = false;
  function remoteElements() { return [...audioByPeer.values(), ...[...screens.values()].filter(s => !s.local).map(s => s.video)]; }
  function updatePlayback(id) {
    const volume = devices.volume(id), audio = audioByPeer.get(id), screen = screens.get(id);
    if (audio) { audio.volume = volume; audio.muted = call.state.deafened || volume === 0; }
    if (screen) { screen.video.volume = screen.local ? 0 : volume; screen.video.muted = screen.local || call.state.deafened || volume === 0 || id !== focusedScreen; }
  }
  function refreshDevices({inputs,outputs,preferences}) {
    function populate(select, list, selected, prefix) {
      const option = el('option','','padrão do sistema'); option.value = ''; select.replaceChildren(option);
      list.filter(d => d.deviceId && d.deviceId !== 'default').forEach((d,i) => { const o = el('option','',d.label || prefix+' '+(i+1)); o.value = d.deviceId; select.append(o); });
      select.value = selected;
    }
    populate(input.select,inputs,preferences.preferredAudioInputId,'Microfone');
    populate(output.select,outputs,preferences.preferredAudioOutputId,'Saída');
    if (!call.state.joined) call.state.inputId = preferences.preferredAudioInputId;
    else {
      const active = call.state.localStream?.getAudioTracks()[0]?.getSettings?.().deviceId;
      if (active && (!inputs.length || inputs.some(d=>d.deviceId)) && !inputs.some(d=>d.deviceId===active)) void call.recoverMicrophone();
    }
    if (lastOutput !== preferences.preferredAudioOutputId) { lastOutput = preferences.preferredAudioOutputId; remoteElements().forEach(e => { void devices.route(e); }); }
  }
  function setSpeaking(id, {level,speaking}) {
    const local = id === clientId, row = rows.get(id), muted = local ? call.state.muted || call.state.micUnavailable : !!remotes.find(p=>p.id===id)?.micMuted;
    const indicator = local ? localSpeaking : row?.indicator;
    if (local) meter.value = muted ? 0 : level;
    if (indicator) { indicator.textContent = local && call.state.micUnavailable ? '× mic indisponível' : muted ? '× mutado' : speaking ? '● falando' : '○ conectado'; indicator.dataset.speaking = String(!muted && speaking); }
  }
  const config = window.SPACEVOICE_CONFIG || {};
  const params = new URLSearchParams(window.location?.search || '');
  const transportName = params.get('voiceTransport') || config.transport || 'websocket';
  const signalingFactory = transportName === 'local' ? globalThis.createLocalVoiceSignaling : globalThis.createWebSocketVoiceSignaling;
  const resume = button('[ reproduzir áudio remoto ]', () => {
    levels.start();
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
        video.addEventListener?.('volumechange', () => { if (local || call.state.deafened || devices.volume(id) === 0 || id !== focusedScreen) video.muted = true; });
        entry = { video, local }; screens.set(id, entry); screenViewer.append(video);
        video.dataset.peerId = id;
        if (!local) void devices.route(video);
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
      updatePlayback(id);
      if (id === focusedScreen) play(entry.video);
      else { blockedPlayback.delete(entry.video); entry.video.pause?.(); }
    }
    resume.hidden = !blockedPlayback.size;
  }
  session = createVoiceSession({ clientId,
    signaling: options => signalingFactory({ ...options, url:params.get('voiceWsUrl') || config.url }),
    peer: options => createVoicePeer({ ...options, iceServers:config.iceServers || [{urls:'stun:stun.l.google.com:19302'}] }),
    onStatus: value => { signalingStatus = value; render(); },
    onPeers: peers => { remotes = peers; render(); },
    onStream: (id, stream) => {
      let audio = audioByPeer.get(id);
      if (!audio) { audio = el('audio'); audio.autoplay = true; audio.hidden = true; audio.dataset.peerId = id; audioByPeer.set(id, audio); root.append(audio); void devices.route(audio); }
      audio.srcObject = stream; updatePlayback(id); play(audio);
      levels.monitor(id,stream,value=>setSpeaking(id,value));
      levels.setMuted(id,!!remotes.find(p=>p.id===id)?.micMuted);
    },
    onScreen: (id, stream) => updateScreen(id, stream),
    onRemove: id => {
      levels.remove(id); rows.delete(id);
      const audio = audioByPeer.get(id);
      if (audio) { audio.pause?.(); audio.srcObject = null; audio.remove(); blockedPlayback.delete(audio); audioByPeer.delete(id); }
      updateScreen(id, null);
    },
    onError: message => { networkError = message; render(); },
  });
  function render(state = call.state) {
    root.dataset.joined = String(state.joined);
    localName.textContent = (getProfile().name || 'Meu perfil') + (state.joined ? ' · você' : ' · fora da chamada');
    if (!state.joined) localSpeaking.textContent = '';
    else setSpeaking(clientId,{level:meter.value,speaking:localSpeaking.dataset.speaking==='true'});
    levels.setMuted(clientId,state.muted || state.micUnavailable);
    participants.replaceChildren(participant);
    remotes.forEach((remote,index) => {
      let row = rows.get(remote.id);
      if (!row) {
        const node = el('li'), name = el('span'), indicator = el('span','spacevoice-speaking'); node.dataset.peerId = remote.id;
        const details = el('details','spacevoice-volume'), summary = el('summary','','volume'), label = el('label','','Volume '), range = el('input');
        range.type = 'range'; range.min = 0; range.max = 100; range.step = 1; range.value = Math.round(devices.volume(remote.id)*100); range.setAttribute('aria-label','Volume do participante '+(index+1));
        range.oninput = () => { devices.setVolume(remote.id,Number(range.value)/100); summary.textContent = 'volume '+range.value+'%'; updatePlayback(remote.id); };
        label.append(range); details.append(summary,label); node.append(name,indicator,details); row = {node,name,indicator,range}; rows.set(remote.id,row);
      }
      row.name.textContent = 'Convidado '+(index+1)+' · '+remote.status;
      setSpeaking(remote.id,{level:0,speaking:row.indicator.dataset.speaking==='true'});
      levels.setMuted(remote.id,remote.micMuted); participants.append(row.node);
    });
    for (const id of audioByPeer.keys()) updatePlayback(id);
    for (const id of screens.keys()) updatePlayback(id);
    input.select.disabled = state.micSwitching || state.joining;
    input.select.value = state.inputId;
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
    status.textContent = state.error || audioError || networkError || (state.joined ? (remotes.length ? 'WebRTC · ' + remotes.filter(p => p.status === 'conectado').length + '/' + remotes.length + ' peers conectados' : (signalingStatus && signalingStatus !== 'conectado' ? 'Signaling · ' + signalingStatus : 'Microfone ativo · aguardando peer na sala geral')) : state.joining ? 'Aguardando permissão do navegador…' : 'Clique em entrar na chamada para solicitar o microfone.');
    device.textContent = state.localStream?.getAudioTracks()[0]?.label || '';
    device.hidden = !device.textContent;
  }
  call.subscribe(state => {
    if (!state.joined && !state.joining) levels.stop();
    if (currentStream !== state.localStream) {
      currentStream = state.localStream;
      networkError = '';
      signalingStatus = '';
      if (!currentStream) { session.close(); levels.stop(); devices.stop(); }
      else if (!sessionStarted) {
        try { session.start(currentStream, state.roomId,state.muted); sessionStarted = true; levels.start(); void devices.refresh({permissionGranted:true}); }
        catch (error) { call.leave(); networkError = 'WebRTC/signaling indisponível: ' + error.message; }
      }
      if (currentStream) levels.monitor(clientId,currentStream,value=>setSpeaking(clientId,value));
      else sessionStarted = false;
    }
    if (lastMuted !== state.muted) { lastMuted = state.muted; session.setMuted?.(state.muted); }
    if (currentScreen !== state.screenStream) {
      currentScreen = state.screenStream;
      session.setScreen?.(currentScreen, globalThis.VOICE_SCREEN_PRESETS?.[state.screenPreset]?.maxBitrate || 10000000);
      updateScreen(clientId, currentScreen, true);
    }
    render(state);
  });
  void devices.start();
  window.addEventListener('pagehide', () => call.leave());
  return { root, call, show: () => { void devices.start(); render(); }, leave: () => call.leave() };
}
