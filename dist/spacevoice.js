/* UI adapter: future signaling/peer playback can consume the call controller. */
function createSpaceVoice({ getProfile, el, button }) {
  const media = createVoiceMedia();
  let session;
  const devices = createVoiceDevices({media, onChange:refreshDevices, onError:message => { audioError = message; render(); }});
  const call = createVoiceCall(media, {inputId:devices.preferences.preferredAudioInputId,
    replaceMicrophone:stream => session.replaceMicrophone(stream), onInput:id => devices.setInput(id)});
  const levels = createVoiceLevels({onError:message => { audioError = message; render(); }});
  const root = el('section', 'panel spacevoice');
  root.setAttribute('aria-label', 'PARTY');
  const header = el('header', 'section-head');
  const roomSummary = el('span', 'spacevoice-version');
  header.append(el('h2', '', 'PARTY'), roomSummary);
  const body = el('div', 'spacevoice-body'), sidebar = el('aside', 'spacevoice-room');
  sidebar.append(el('h3', '', '// geral'));
  const participants = el('ul', 'spacevoice-participants'), participant = el('li');
  const localName = el('span'), localSpeaking = el('span', 'spacevoice-speaking');
  function avatar(name, source) {
    const box = el('div', 'spacevoice-avatar');
    const initials = el('span', '', (name || '?').trim().split(/\s+/).slice(0,2).map(n=>n[0]).join('').toUpperCase() || '?');
    box.append(initials);
    if (source && /^(https?:\/\/|data:image\/(png|jpeg|webp|gif);base64,|[\w.-]+\.(png|jpg|jpeg|webp|gif)$)/i.test(source)) {
      const image = el('img'); image.src = source; image.alt = ''; image.onerror = () => { image.hidden = true; initials.hidden = false; };
      initials.hidden = true; box.append(image);
    }
    return box;
  }
  const localAvatar = avatar(getProfile().name, getProfile().avatar);
  let avatarKey = JSON.stringify([getProfile().name,getProfile().avatar]);
  const localInfo = el('div', 'spacevoice-person'); localInfo.append(localName,el('span','spacevoice-local','você'),localSpeaking);
  participant.append(localAvatar,localInfo);
  participants.append(participant); sidebar.append(participants);
  const waiting = el('p','spacevoice-waiting','aguardando alguém entrar…'); sidebar.append(waiting);
  const stage = el('div', 'spacevoice-stage');
  const emptyHeading = el('h3', '', '// geral'), emptyText = el('p', '', 'nenhuma chamada ativa para você');
  stage.append(emptyHeading, emptyText);
  const join = button('[ entrar na chamada ]', () => { levels.start(); void devices.start().then(() => { call.state.inputId = devices.preferences.preferredAudioInputId; return call.join(); }); });
  stage.append(join);
  const screenArea = el('div', 'spacevoice-screens');
  const screenTabs = el('div', 'spacevoice-screen-tabs'); screenTabs.setAttribute('aria-label', 'Telas disponíveis');
  const screenViewer = el('div', 'spacevoice-screen-viewer');
  screenArea.append(screenTabs, screenViewer); screenArea.hidden = true; stage.append(screenArea);
  body.append(sidebar, stage);
  const controls = el('div', 'spacevoice-controls');
  controls.setAttribute('aria-label', 'Controles da chamada');
  const icons = {
    mic:'<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/>',
    headphones:'<path d="M4 14v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="12" width="4" height="8"/><rect x="17" y="12" width="4" height="8"/>',
    screen:'<g class="party-icon-normal"><rect x="3" y="4" width="18" height="13"/><path d="M12 17v4M8 21h8"/></g><rect class="party-icon-stop" x="6" y="6" width="12" height="12"/>',
    leave:'<path d="M10 4H4v16h6M9 12h12M16 7l5 5-5 5"/>',
    fit:'<path d="M9 3H3v6M15 3h6v6M3 15v6h6M21 15v6h-6"/><rect x="8" y="8" width="8" height="8"/>',
    fullscreen:'<path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/>',
  };
  function iconButton(kind, label, action) {
    const node = button('', action); node.className = 'party-icon-button'; node.dataset.icon = kind;
    const glyph = el('span','party-icon'); glyph.setAttribute('aria-hidden','true');
    glyph.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">'+icons[kind]+'<path class="party-icon-slash" d="M3 3l18 18"/></svg>';
    node.append(glyph); labelIcon(node,label); return node;
  }
  function labelIcon(node,label) { node.title = label; node.setAttribute('aria-label',label); }
  const mic = iconButton('mic','Silenciar microfone', () => call.toggleMute());
  const deafen = iconButton('headphones','Silenciar áudio recebido', () => call.toggleDeafen());
  deafen.title = 'Silenciar apenas a reprodução remota nesta aba.';
  const qualityLabel = el('label', 'spacevoice-quality', 'Tela: ');
  const quality = el('select'); quality.setAttribute('aria-label', 'Qualidade da tela');
  for (const preset of ['720p60','1080p30','1080p60','1440p60']) { const option = el('option', '', preset); option.value = preset; quality.append(option); }
  quality.value = '1080p60'; qualityLabel.append(quality);
  const share = iconButton('screen','Compartilhar tela', () => call.state.screenSharing ? call.stopScreenShare() : call.startScreenShare(quality.value));
  const leave = iconButton('leave','Sair da party', () => call.leave()); leave.className += ' party-leave';
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
  controls.append(mic, deafen, share, leave);
  const secondaryControls = el('div', 'spacevoice-secondary-controls');
  secondaryControls.append(input.label, output.label, outputNote, meterLabel, qualityLabel);
  const screenStatus = el('p', 'spacevoice-screen-status'); screenStatus.setAttribute('role', 'status');
  const status = el('p', 'spacevoice-status'); status.setAttribute('role', 'status');
  const device = el('p', 'spacevoice-device');
  const functionalArea = el('div','spacevoice-functional-area'), diagnostics = el('div','spacevoice-diagnostics');
  diagnostics.append(status,device); functionalArea.append(controls,secondaryControls,screenStatus,diagnostics);
  root.append(header, body, functionalArea);
  const clientId = window.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
  const chatPanel = el('aside','spacevoice-chat'), chatHeading = el('h3','','// chat · geral');
  chatPanel.setAttribute('aria-label','Chat da sala');
  const chatLog = el('div','spacevoice-chat-log'); chatLog.setAttribute('role','log'); chatLog.setAttribute('aria-live','off'); chatLog.setAttribute('aria-label','Mensagens da sala'); chatLog.tabIndex=0;
  const chatTyping = el('p','spacevoice-chat-typing'), chatError = el('p','spacevoice-chat-error'); chatError.setAttribute('role','status');
  const chatInput = el('textarea','spacevoice-chat-input'); chatInput.rows=2; chatInput.placeholder='mensagem…'; chatInput.setAttribute('aria-label','Mensagem para a sala');
  const chatCounter = el('span','spacevoice-chat-counter');
  const chatSend = button('[ enviar ]',()=>chat.submit());
  const chatForm = el('div','spacevoice-chat-compose'); chatForm.append(chatInput,chatCounter,chatSend);
  const chatNew = button('[ novas mensagens ]',()=>{chatLog.scrollTop=chatLog.scrollHeight;chat.viewport(chatVisible(),true);});
  const chatInner = el('div','spacevoice-chat-inner');
  chatInner.append(chatHeading,chatLog,chatNew,chatTyping,chatForm,chatError);chatPanel.append(chatInner);body.append(chatPanel);
  const doc = typeof document === 'undefined' ? null : document;
  let title = doc?.title || '', lastChatTitle = title;
  let chatOpen = false;
  const chatRows = new Map(), timeFormat = new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'});
  const nearChatBottom = ()=>chatLog.scrollHeight-chatLog.scrollTop-chatLog.clientHeight<=32;
  const chatVisible = ()=>chatOpen&&!doc?.hidden&&!root.closest?.('[hidden]');
  const chatToggle = button('[ chat ]',()=>{chatOpen=!chatOpen;root.dataset.chatOpen=String(chatOpen);chat.viewport(chatVisible(),nearChatBottom());});
  header.append(chatToggle);
  const chat = createVoiceChat({clientId,getName:()=>getProfile().name||'Convidado',send:(type,payload)=>session?.sendApplication(type,payload)===true,onChange:renderChat});
  function renderChat(state,reason){
    // Only this panel changes. Never call render/renderScreens on chat events.
    chatPanel.inert=!chatOpen;chatPanel.setAttribute('aria-hidden',String(!chatOpen));root.dataset.chatOpen=String(chatOpen);chatHeading.textContent='// chat · '+(state.roomId||'geral');
    chatLog.dataset.empty = String(!state.messages.length);
    if(['message','history','lifecycle'].includes(reason)){
      const scroll=chatLog.scrollTop||0, shouldScroll=state.visible&&state.nearBottom;
      const ids=new Set(state.messages.map(m=>m.id));
      for(const [id,row] of chatRows)if(!ids.has(id)){row.remove();chatRows.delete(id);}
      for(const m of state.messages){let row=chatRows.get(m.id);if(!row){row=el('div','spacevoice-chat-line');row.dataset.messageId=m.id;row.dataset.authorId=m.authorId;row.dataset.createdAt=String(m.createdAt);
          const timestamp=el('time','spacevoice-chat-time','['+timeFormat.format(new Date(m.createdAt))+']');timestamp.dateTime=new Date(m.createdAt).toISOString();
          row.append(timestamp,el('span','spacevoice-chat-author',m.authorName+': '),el('span','spacevoice-chat-text',m.text));chatRows.set(m.id,row);}
        chatLog.append(row);
      }
      chatLog.scrollTop=shouldScroll?chatLog.scrollHeight:scroll;
    }
    const names=state.typing.map(t=>t.name);chatTyping.textContent=names.length>2?'* '+names.length+' pessoas estão digitando…':names.length?'* '+names.join(' e ')+(names.length===1?' está':' estão')+' digitando…':'';
    chatError.textContent=state.error;chatError.hidden=!state.error;
    if(chatInput.value!==state.draft)chatInput.value=state.draft;
    chatInput.disabled=!state.roomId;chatSend.disabled=!state.connected||!state.draft.trim()||state.draft.length>2000;
    chatCounter.textContent=state.draft.length+'/2000';chatCounter.dataset.overLimit=String(state.draft.length>2000);
    chatToggle.textContent='[ chat'+(state.unread?' · '+state.unread:'')+(chatOpen?' <':' >')+' ]';chatToggle.setAttribute('aria-expanded',String(chatOpen));
    chatToggle.setAttribute('aria-pressed',String(chatOpen));
    chatNew.textContent='[ '+state.unread+' novas mensagens ]';chatNew.hidden=!state.unread;
    if(doc){if(doc.title!==lastChatTitle)title=doc.title;doc.title=state.unread?'('+state.unread+') '+title:title;lastChatTitle=doc.title;}
  }
  chatInput.oninput=()=>{chat.draft(chatInput.value);chat.viewport(chatVisible(),nearChatBottom());};
  chatInput.onkeydown=event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();chat.submit();}};
  chatLog.onscroll=()=>chat.viewport(chatVisible(),nearChatBottom());
  doc?.addEventListener('visibilitychange',()=>chat.viewport(chatVisible(),nearChatBottom()));
  window.addEventListener('hashchange',()=>Promise.resolve().then(()=>chat.viewport(chatVisible(),nearChatBottom())));
  chat.viewport(chatVisible(),true);
  const audioByPeer = new Map();
  const rows = new Map();
  const screens = new Map(), blockedPlayback = new Set();
  let focusedScreen = null, screenFocused = true;
  const screenHeading = el('p', 'spacevoice-share-heading');
  const screenFacts = el('p', 'spacevoice-share-facts');
  const fullscreen = iconButton('fullscreen','Tela cheia', () => { void screenViewer.requestFullscreen?.().catch?.(()=>{}); });
  const fit = iconButton('fit','Preencher área (corta as bordas)', () => {
    const fill = screenViewer.dataset.fit !== 'cover'; screenViewer.dataset.fit = fill ? 'cover' : 'contain';
    fit.setAttribute('aria-pressed',String(fill)); labelIcon(fit,fill ? 'Ajustar à área (sem cortes)' : 'Preencher área (corta as bordas)');
  }); screenViewer.dataset.fit = 'contain'; fit.setAttribute('aria-pressed','false');
  const back = button('[ sair do foco ]', () => { shareMenu.open = false; screenFocused = false; renderScreens(); });
  const stopLocal = button('[ parar compartilhamento ]', () => call.stopScreenShare());
  stopLocal.className = 'spacevoice-stop-local';
  const focusResume = button('[ ver telas ]', () => { screenFocused = true; renderScreens(); }); header.append(focusResume);
  const overlay = el('div','spacevoice-fullscreen-overlay'), overlayName = el('span');
  const exitFullscreen = button('[ sair da tela cheia ]', () => { void doc?.exitFullscreen?.().catch?.(()=>{}); });
  overlay.append(overlayName,exitFullscreen); screenViewer.append(overlay);
  let overlayTimer;
  screenViewer.onpointermove = () => { screenViewer.dataset.overlay = 'true'; window.clearTimeout?.(overlayTimer); overlayTimer = window.setTimeout?.(()=>{screenViewer.dataset.overlay='false';},1600); };
  doc?.addEventListener('fullscreenchange',()=>{ window.clearTimeout?.(overlayTimer); screenViewer.dataset.overlay = 'false'; });
  const shareHeader = el('div', 'spacevoice-share-header'), shareInfo = el('div', 'spacevoice-share-info');
  const shareMenu = el('details','spacevoice-share-menu'), menuSummary = el('summary','','[ ⋯ ]');
  menuSummary.title = 'Ações da tela'; menuSummary.setAttribute('aria-label','Ações da tela');
  const menuBody = el('div','spacevoice-share-menu-body'); menuBody.append(back); shareMenu.append(menuSummary,menuBody);
  const shareActions = el('div','spacevoice-share-actions'); shareActions.append(fit,fullscreen,shareMenu);
  shareInfo.append(screenHeading, screenFacts); shareHeader.append(shareInfo, shareActions,stopLocal);
  screenArea.replaceChildren(shareHeader, screenTabs, screenViewer);
  function screenName(id, entry) {
    const remoteIndex = remotes.findIndex(p=>p.id===id);
    return entry.local ? (getProfile().name || 'Você') : (remotes[remoteIndex]?.name || 'Convidado '+(remoteIndex+1 || 1));
  }
  function renderScreenMetadata() {
    const entry = screens.get(focusedScreen);
    if (!entry) return;
    const name = screenName(focusedScreen, entry);
    const settings = entry.video.srcObject?.getVideoTracks?.()[0]?.getSettings?.() || {};
    const width = settings.width || entry.video.videoWidth, height = settings.height || entry.video.videoHeight;
    const facts = [width && height ? width+'×'+height : '', settings.frameRate ? settings.frameRate+' fps' : '', entry.video.srcObject?.getAudioTracks?.().length ? 'áudio ✓' : ''].filter(Boolean);
    screenHeading.textContent = name+' · compartilhando';
    overlayName.textContent = screenHeading.textContent;
    stopLocal.hidden = !entry.local;
    screenFacts.textContent = facts.join(' · '); screenFacts.hidden = !facts.length;
  }
  function updateLayout() {
    const wasScreen = root.dataset.mode === 'screen';
    root.dataset.mode = screens.size && screenFocused ? 'screen' : 'voice';
    focusResume.hidden = !screens.size || screenFocused;
    if (screens.size && screenFocused && !wasScreen && !window.matchMedia?.('(max-width: 800px)').matches) chatOpen = true;
    renderChat(chat.state, 'layout');
    emptyHeading.hidden = emptyText.hidden = call.state.joined;
    waiting.hidden = !call.state.joined || !!remotes.length || !!screens.size;
  }
  let remotes = [], networkError = '', audioError = '', currentStream = null, currentScreen = null, signalingStatus = '', lastOutput = devices.preferences.preferredAudioOutputId, lastMuted = false, sessionStarted = false;
  function remoteElements() { return [...audioByPeer.values(), ...[...screens.values()].filter(s => !s.local).map(s => s.video)]; }
  function updatePlayback(id) {
    const volume = devices.volume(id), audio = audioByPeer.get(id), screen = screens.get(id);
    if (audio) { audio.volume = volume; audio.muted = call.state.deafened || volume === 0; }
    if (screen) { screen.video.volume = screen.local ? 0 : volume; screen.video.muted = screen.local || call.state.deafened || volume === 0 || id !== focusedScreen || !screenFocused; }
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
    const node = local ? participant : row?.node;
    if (node) node.dataset.speaking = String(!muted && speaking);
    if (indicator) { indicator.textContent = local && call.state.micUnavailable ? '× mic indisponível' : muted ? '× mutado' : local && call.state.deafened ? 'áudio desligado' : speaking ? '● falando' : screens.has(id) ? 'compartilhando' : '○ '+(local ? 'conectado' : remotes.find(p=>p.id===id)?.status || 'conectado'); indicator.dataset.speaking = String(!muted && speaking); }
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
        screenFocused = true;
        const video = el('video'); video.autoplay = true; video.playsInline = true; video.controls = false;
        video.addEventListener?.('loadedmetadata', renderScreenMetadata);
        video.addEventListener?.('resize', renderScreenMetadata);
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
    if (!screens.size) { window.clearTimeout?.(overlayTimer); if (doc?.fullscreenElement === screenViewer) void doc.exitFullscreen?.().catch?.(()=>{}); }
    if (!screens.has(focusedScreen)) focusedScreen = screens.keys().next().value ?? null;
    screenArea.hidden = !screens.size || !screenFocused;
    screenTabs.hidden = screens.size < 2;
    updateLayout();
    screenTabs.replaceChildren();
    for (const [id, entry] of screens) {
      const name = screenName(id, entry);
      const tab = button('[ ' + name + ' · tela ]', () => { focusedScreen = id; renderScreens(); });
      tab.setAttribute('aria-pressed', String(id === focusedScreen)); screenTabs.append(tab);
      entry.video.hidden = id !== focusedScreen || !screenFocused;
      updatePlayback(id);
      if (id === focusedScreen && screenFocused) {
        renderScreenMetadata();
        play(entry.video);
      }
      else { blockedPlayback.delete(entry.video); entry.video.pause?.(); }
    }
    resume.hidden = !blockedPlayback.size;
  }
  session = createVoiceSession({ clientId,
    signaling: options => signalingFactory({ ...options, url:params.get('voiceWsUrl') || config.url }),
    peer: options => createVoicePeer({ ...options, iceServers:config.iceServers || [{urls:'stun:stun.l.google.com:19302'}] }),
    onStatus: value => { signalingStatus = value; chat.connection(value==='conectado'); render(); },
    onApplication: message => chat.receive(message),
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
      levels.remove(id); rows.get(id)?.node.remove(); rows.delete(id);
      const audio = audioByPeer.get(id);
      if (audio) { audio.pause?.(); audio.srcObject = null; audio.remove(); blockedPlayback.delete(audio); audioByPeer.delete(id); }
      updateScreen(id, null);
    },
    onError: message => { networkError = message; render(); },
  });
  function render(state = call.state) {
    root.dataset.joined = String(state.joined);
    controls.hidden = !state.joined;
    meterLabel.hidden = !state.joined;
    roomSummary.textContent = '// '+(state.roomId || 'geral')+' · '+(state.joined ? (remotes.length+1)+' participante'+(remotes.length?'s':'')+' · em chamada' : 'fora da chamada');
    root.dataset.count = String(remotes.length+1);
    sidebar.hidden = !state.joined;
    waiting.hidden = !state.joined || !!remotes.length || !!screens.size;
    updateLayout();
    localName.textContent = getProfile().name || 'Meu perfil';
    const nextAvatarKey = JSON.stringify([getProfile().name,getProfile().avatar]);
    if (nextAvatarKey !== avatarKey) { avatarKey = nextAvatarKey; localAvatar.replaceChildren(...avatar(getProfile().name,getProfile().avatar).children); }
    if (!state.joined) localSpeaking.textContent = '';
    else setSpeaking(clientId,{level:meter.value,speaking:localSpeaking.dataset.speaking==='true'});
    levels.setMuted(clientId,state.muted || state.micUnavailable);
    if (!participants.children.length) participants.append(participant);
    for (const [id,row] of rows) if (!remotes.some(p=>p.id===id)) { row.node.remove(); rows.delete(id); }
    remotes.forEach((remote,index) => {
      let row = rows.get(remote.id);
      if (!row) {
        const node = el('li'), name = el('span'), indicator = el('span','spacevoice-speaking'); node.dataset.peerId = remote.id;
        const details = el('details','spacevoice-volume'), summary = el('summary','','volume'), label = el('label','','Volume '), range = el('input');
        range.type = 'range'; range.min = 0; range.max = 100; range.step = 1; range.value = Math.round(devices.volume(remote.id)*100); range.setAttribute('aria-label','Volume do participante '+(index+1));
        range.oninput = () => { devices.setVolume(remote.id,Number(range.value)/100); summary.textContent = 'volume '+range.value+'%'; updatePlayback(remote.id); };
        label.append(range); details.append(summary,label);
        const info = el('div','spacevoice-person'); info.append(name,indicator,details);
        node.append(avatar(remote.name || 'Convidado '+(index+1)),info); row = {node,name,indicator,range}; rows.set(remote.id,row);
      }
      row.name.textContent = remote.name || 'Convidado '+(index+1);
      setSpeaking(remote.id,{level:0,speaking:row.indicator.dataset.speaking==='true'});
      levels.setMuted(remote.id,remote.micMuted); participants.append(row.node);
    });
    for (const id of audioByPeer.keys()) updatePlayback(id);
    for (const id of screens.keys()) updatePlayback(id);
    input.select.disabled = state.micSwitching || state.joining;
    input.select.value = state.inputId;
    share.disabled = !state.joined || state.screenStarting;
    labelIcon(share,state.screenSharing ? 'Parar compartilhamento' : state.screenStarting ? 'Escolhendo tela…' : 'Compartilhar tela');
    share.setAttribute('aria-pressed',String(state.screenSharing));
    quality.disabled = state.screenStarting || state.screenSharing;
    screenStatus.textContent = state.screenError || '';
    screenStatus.hidden = !screenStatus.textContent;
    join.hidden = state.joined; join.disabled = state.joining;
    join.textContent = state.joining ? '[ aguardando microfone… ]' : '[ entrar na chamada ]';
    mic.disabled = deafen.disabled = !state.joined;
    leave.disabled = !state.joined && !state.joining;
    mic.setAttribute('aria-pressed', String(state.muted));
    mic.setAttribute('aria-label', state.muted ? 'Ativar microfone' : 'Silenciar microfone');
    labelIcon(mic,state.muted ? 'Ativar microfone' : 'Silenciar microfone');
    deafen.setAttribute('aria-pressed', String(state.deafened));
    labelIcon(deafen,state.deafened ? 'Restaurar áudio recebido' : 'Silenciar áudio recebido');
    status.textContent = state.error || audioError || networkError || (state.joined ? (remotes.length ? 'WebRTC · ' + remotes.filter(p => p.status === 'conectado').length + '/' + remotes.length + ' peers conectados' : (signalingStatus && signalingStatus !== 'conectado' ? 'Signaling · ' + signalingStatus : 'Microfone ativo · aguardando peer na sala geral')) : state.joining ? 'Aguardando permissão do navegador…' : 'Clique em entrar na chamada para solicitar o microfone.');
    device.textContent = state.localStream?.getAudioTracks()[0]?.label || '';
    device.hidden = !device.textContent;
    emptyText.textContent = state.joined ? '' : 'fora da chamada';
  }
  call.subscribe(state => {
    if (!state.joined && !state.joining) levels.stop();
    if (currentStream !== state.localStream) {
      currentStream = state.localStream;
      networkError = '';
      signalingStatus = '';
      if (!currentStream) { chat.close(); session.close(); levels.stop(); devices.stop(); }
      else if (!sessionStarted) {
        try { chat.start(state.roomId); session.start(currentStream, state.roomId,state.muted); sessionStarted = true; levels.start(); void devices.refresh({permissionGranted:true}); }
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
  return { root, call, chat, show: () => { void devices.start(); render(); chat.viewport(chatVisible(),nearChatBottom()); }, leave: () => call.leave() };
}
