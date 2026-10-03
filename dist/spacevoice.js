/* UI adapter: future signaling/peer playback can consume the call controller. */
function createSpaceVoice({ getProfile, el, button, prepareAvatar }) {
  const roomAPI=globalThis.PARTY_ROOM;
  let room, lobbyEpoch=0, roomEntry=null;
  let localIsSpeaking=false,presenceKey='',presenceTimer=null,presenceSentAt=0;
  const presenceAPI=globalThis.PARTY_PRESENCE;
  const activityPresence=presenceAPI?.create({onIdle:()=>{syncPresence();render();}});
  let recentStorage;try{recentStorage=globalThis.localStorage;}catch{}
  const recents=roomAPI.createRecents(recentStorage);
  let recordedRoom=null,lastRoomName='geral',recentsOpen=false;
  const mediaAPI = globalThis.PARTY_MEDIA_SETTINGS;
  const media = createVoiceMedia();
  let session;
  const devices = createVoiceDevices({media, onChange:refreshDevices, onError:message => { audioError = message; render(); }});
  let mediaPreferences = {...devices.preferences.mediaSettings};
  const call = createVoiceCall(media, {inputId:devices.preferences.preferredAudioInputId, microphoneSettings:() => mediaAPI.constraints(mediaPreferences),
    replaceMicrophone:stream => session.replaceMicrophone(stream), onInput:id => devices.setInput(id)});
  const levels = createVoiceLevels({onError:message => { audioError = message; render(); }});
  const root = el('section', 'panel spacevoice');
  root.setAttribute('aria-label', 'PARTY');
  const header = el('header', 'section-head');
  const roomSummary = el('span', 'spacevoice-version');
  const roomNameLabel=el('span','party-room-name'),roomCounts=el('span','party-room-counts');
  roomSummary.append(roomNameLabel,roomCounts);
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
  const localMood=el('span','party-presence-mood');localMood.hidden=true;
  const localMusic=el('span','party-presence-music');localMusic.hidden=true;
  const localSecondary=el('div','party-presence-secondary'),localSecondaryInner=el('div');localSecondaryInner.append(localMood,localMusic);localSecondary.append(localSecondaryInner);
  const localInfo = el('div', 'spacevoice-person'); localInfo.append(localName,el('span','spacevoice-local','você'),localSpeaking,localSecondary);
  participant.append(localAvatar,localInfo);
  participants.append(participant); sidebar.append(participants);
  const waiting = el('p','spacevoice-waiting','aguardando alguém entrar…'); sidebar.append(waiting);
  const stage = el('div', 'spacevoice-stage');
  const emptyHeading = el('h3', '', '// geral'), emptyText = el('p', '', 'nenhuma chamada ativa para você');
  stage.append(emptyHeading, emptyText);
  const join = button('[ entrar na chamada ]', () => { void enterCall(); });
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
    glyph.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">' +
      icons[kind] +
      '<path class="party-icon-slash" d="M3 3l18 18"/></svg>';
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
  const contextRail=el('aside','party-context-rail'); contextRail.setAttribute('aria-label','Contexto da PARTY'); body.append(contextRail);
  let mediaOpen=false;
  const advanced = el('section','party-media-settings');
  const advancedInner=el('div','party-media-inner'); advanced.append(advancedInner);
  const advancedHead=el('div','party-context-head');
  advancedHead.append(el('h3','','// mídia avançada'),button('[ fechar ]',()=>setContext('none')));
  advancedInner.append(advancedHead);
  advanced.setAttribute('aria-label','Mídia avançada');
  const advancedToggle = button('[ mídia > ]',()=>setContext(mediaOpen?'none':'media')); advancedToggle.setAttribute('aria-expanded','false');
  secondaryControls.append(advancedToggle);
  const mediaNotice=el('p','party-media-notice'); mediaNotice.setAttribute('role','status');
  const mediaFields=new Map();
  function mediaField(parent,key,text,options) {
    const label=el('label','party-media-field',text), control=el('input');
    let node=control;
    if(options) {
      node=el('select');
      for(const [value,title] of options) {const option=el('option','',title);option.value=String(value);node.append(option);}
    } else control.type='checkbox';
    node.setAttribute(
      "aria-label",
      key === "micBitrate"
        ? "Bitrate do microfone"
        : key === "screenAudioBitrate"
          ? "Bitrate do áudio da tela"
          : key === "screenVideoBitrate"
            ? "Bitrate do vídeo da tela"
            : text,
    );
    label.append(node);
    parent.append(label);
    mediaFields.set(key, node);
    node.onchange=()=>void updateMedia({...mediaPreferences,[key]:options ? options.find(([value])=>String(value)===node.value)[0] : node.checked});
  }
  function mediaGroup(title) { const group=el('fieldset');group.append(el('legend','',title));advancedInner.append(group);return group; }
  const micGroup=mediaGroup('Microfone');
  mediaField(micGroup,'micEchoCancellation','Cancelamento de eco');
  mediaField(micGroup,'micNoiseSuppression','Supressão de ruído');
  mediaField(micGroup,'micAutoGainControl','Ganho automático');
  const rates=(list,unit,divisor)=>list.map(value=>[value,value===null?'automático':value/divisor+' '+unit]);
  mediaField(micGroup,'micBitrate','Bitrate',rates(mediaAPI.choices.micBitrate,'kbps',1000));
  mediaField(mediaGroup('Compartilhamento — áudio'),'screenAudioBitrate','Bitrate',rates(mediaAPI.choices.screenAudioBitrate,'kbps',1000));
  const videoGroup=mediaGroup('Compartilhamento — vídeo');
  mediaField(videoGroup,'screenVideoBitrate','Bitrate',[
    ['recommended','recomendado pelo preset'],...rates(mediaAPI.choices.screenVideoBitrate.slice(1),'Mbps',1000000)]);
  mediaField(videoGroup,'screenContentHint','Conteúdo',[['detail','texto/interface'],['motion','vídeo/jogo']]);
  const meshNote=el('p','party-media-note','Tetos solicitados por peer, não taxas garantidas. 10 Mbps × 3 destinatários ≈ até 30 Mbps de upload, além de áudio/overhead.');
  const presetNote=el('p','party-media-note');
  const resetMedia=button('[ restaurar recomendados ]',()=>void updateMedia(mediaAPI.defaults));
  advancedInner.append(presetNote,meshNote,mediaNotice,resetMedia);
  contextRail.append(advanced);
  function renderMedia() {
    for(const [key,node] of mediaFields) {
      if(node.type==='checkbox') node.checked=mediaPreferences[key];else node.value=String(mediaPreferences[key]);
    }
    const preset=call.state.screenSharing?call.state.screenPreset:quality.value;
    presetNote.textContent='Captura: '+preset+' · recomendado: '+mediaAPI.recommended[preset]/1000000+' Mbps. Automático remove o teto; recomendado acompanha o preset.';
  }
  let mediaBusy=false;
  async function updateMedia(value) {
    if(mediaBusy || call.state.micSwitching || call.state.joining) {renderMedia();return;}
    const previous=mediaPreferences, next=mediaAPI.normalize(value);
    mediaBusy=true;resetMedia.disabled=true;mediaNotice.textContent='Aplicando…';mediaFields.forEach(node=>node.disabled=true);
    try {
      mediaPreferences=next;
      const processingChanged=['micEchoCancellation','micNoiseSuppression','micAutoGainControl'].some(key=>previous[key]!==next[key]);
      if(processingChanged && !await call.applyMicrophoneSettings(mediaAPI.constraints(next))) {
        mediaPreferences=previous;mediaNotice.textContent='Não foi possível alterar o processamento. O microfone anterior foi mantido.';return;
      }
      devices.setMediaSettings(next);
      mediaAPI.hint(call.state.screenStream?.getVideoTracks()[0],next.screenContentHint);
      mediaNotice.textContent='';
      await session.setMediaSettings?.(next,call.state.screenSharing?call.state.screenPreset:quality.value);
    } catch {mediaNotice.textContent='O navegador não aplicou todos os ajustes. A chamada continua.';}
    finally {mediaBusy=false;resetMedia.disabled=false;mediaFields.forEach(node=>node.disabled=false);renderMedia();}
  }
  quality.onchange=()=>{renderMedia();void session.setMediaSettings?.(mediaPreferences,quality.value);};
  renderMedia();
  const clientId = roomAPI.secureId(window.crypto || globalThis.crypto);
  const doc = typeof document === "undefined" ? null : document;
  let chatOpen = false;
  const chatView = createPartyChatUI({
    root,
    el,
    button,
    getChat: () => chat,
    getContext: () => ({ open: chatOpen, visible: chatVisible() }),
    onContextChange: renderContext,
    getRoomName: () => room?.state.name || "geral",
    onToggle: () => setContext(chatOpen ? "none" : "chat"),
  });
  const { panel: chatPanel, log: chatLog, input: chatInput, toggle: chatToggle } = chatView;
  contextRail.append(chatPanel);
  const nearChatBottom = () => chatLog.scrollHeight - chatLog.scrollTop - chatLog.clientHeight <= 32;
  const chatAvailable = () => !!room?.state.roomId;
  const chatVisible = () => chatAvailable() && chatOpen && !doc?.hidden && !root.closest?.("[hidden]");
  function setContext(context) {
    if (context === "chat" && !chatAvailable()) return;
    chatOpen = context === "chat";
    mediaOpen = context === "media";
    renderContext();
    chat.viewport(chatVisible(), nearChatBottom());
  }
  function renderContext() {
    if (!chatAvailable()) chatOpen = false;
    chatToggle.hidden = !chatAvailable();
    root.dataset.context = mediaOpen ? "media" : chatOpen ? "chat" : "none";
    root.dataset.chatOpen = String(chatOpen);
    advanced.inert = !mediaOpen;
    advanced.setAttribute("aria-hidden", String(!mediaOpen));
    advancedToggle.setAttribute("aria-expanded", String(mediaOpen));
    advancedToggle.setAttribute("aria-pressed", String(mediaOpen));
    advancedToggle.textContent = mediaOpen ? "[ mídia < ]" : "[ mídia > ]";
  }
  header.append(chatToggle);
  const chat = createVoiceChat({
    clientId,
    getName: () => getProfile().name || "Convidado",
    send: (type, payload) => room?.sendApplication(type, payload) === true,
    onChange: renderChat,
  });
  function renderChat(state, reason) {
    chatView.render(state, reason);
  }
  chatInput.oninput = () => {
    chat.draft(chatInput.value);
    chat.viewport(chatVisible(), nearChatBottom());
  };
  chatInput.onkeydown = (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      chat.submit();
    }
  };
  chatLog.onscroll = () => chat.viewport(chatVisible(), nearChatBottom());
  doc?.addEventListener("visibilitychange", () => chat.viewport(chatVisible(), nearChatBottom()));
  window.addEventListener("hashchange", () =>
    Promise.resolve().then(() => chat.viewport(chatVisible(), nearChatBottom())),
  );
  chat.viewport(chatVisible(), true);
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
  screenViewer.onpointermove = () => {
    screenViewer.dataset.overlay = "true";
    window.clearTimeout?.(overlayTimer);
    overlayTimer = window.setTimeout?.(() => {
      screenViewer.dataset.overlay = "false";
    }, 1600);
  };
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
    const metadata=room?.state.participants.find(p=>p.clientId===id);
    return entry.local ? (getProfile().name || 'Você') : (metadata?.displayName || remotes[remoteIndex]?.name || 'Convidado '+(remoteIndex+1 || 1));
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
    root.dataset.mode = screens.size && screenFocused ? 'screen' : 'voice';
    for(const node of [localSecondary,...[...rows.values()].map(row=>row.secondary)])node.setAttribute('aria-hidden',String(root.dataset.mode==='screen'));
    focusResume.hidden = !screens.size || screenFocused;
    renderChat(chat.state, 'layout');
    emptyHeading.hidden = call.state.joined || !!room?.state.roomId;emptyText.hidden=call.state.joined;
    waiting.hidden = !call.state.joined || !!remotes.length || !!screens.size;
  }
  let remotes = [],
    networkError = "",
    audioError = "",
    currentStream = null,
    currentScreen = null,
    signalingStatus = "",
    lastOutput = devices.preferences.preferredAudioOutputId,
    lastMuted = false,
    sessionStarted = false;
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
    if(local){localIsSpeaking=!muted&&speaking;syncPresence();}
    if (indicator) {
      const member = room?.state.participants.find((p) => p.clientId === id),
        sharing = local ? call.state.screenSharing : screens.has(id);
      const activity =
        !muted && speaking
          ? "speaking"
          : sharing
            ? "sharing"
            : muted
              ? "muted"
              : local
                ? "call"
                : member?.activity || "call";
      presenceText(
        indicator,
        local && call.state.micUnavailable && !sharing
          ? "× mic indisponível"
          : roomAPI.activityLabel({
              inCall: local ? call.state.joined : member?.inCall !== false,
              idle: member?.idle,
              activity,
            }),
      );
      indicator.dataset.speaking = String(!muted && speaking);
    }
  }
  function presenceText(node, text) {
    if (node.textContent === text) return;
    node.textContent = text;
    node.classList?.remove("party-presence-change");
    void node.offsetWidth;
    node.classList?.add("party-presence-change");
  }
  function statusText(){const mood=getProfile().mood;return typeof mood==='string'?mood.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,80):'';}
  function localPresence() {
    const s = call.state;
    return {
      statusText: statusText(),
      idle: activityPresence?.idle || false,
      activity: !s.joined
        ? "room"
        : !s.muted && !s.micUnavailable && localIsSpeaking
          ? "speaking"
          : s.screenSharing
            ? "sharing"
            : s.muted || s.micUnavailable
              ? "muted"
              : "call",
      nowPlaying: window.SPACEAMP?.getNowPlaying() || null,
    };
  }
  function musicText(node,value){
    if(value?.playing){node.dataset.empty='false';node.hidden=false;presenceText(node,'♫ '+value.title+(value.artist?' — '+value.artist:''));return;}
    if(node.hidden||node.dataset.empty==='true')return;
    node.dataset.empty='true';void node.offsetWidth;
    const finish=()=>{if(node.dataset.empty==='true'){node.hidden=true;node.textContent='';}};
    const animations=node.getAnimations?.();if(animations?.length)Promise.allSettled(animations.map(a=>a.finished)).then(finish);else finish();
  }
  function syncPresence(){
    if(!room?.state.roomId)return;
    const next=localPresence(),key=JSON.stringify(next);if(key===presenceKey)return;
    const wait=(presenceAPI?.UPDATE_MS||1000)-(Date.now()-presenceSentAt);
    if(wait>0&&globalThis.setTimeout){if(presenceTimer===null)presenceTimer=setTimeout(()=>{presenceTimer=null;syncPresence();},wait);return;}
    presenceKey=key;presenceSentAt=Date.now();room.updatePresence(next);
  }
  const config = window.SPACEVOICE_CONFIG || {};
  const params = new URLSearchParams(window.location?.search || '');
  const pageUrl=()=>window.location?.href || 'http://localhost/#spacevoice';
  let selectedRoom=roomAPI.parse(pageUrl());
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
  session = createVoiceSession({onMediaWarning:message=>{mediaNotice.textContent=message;}, clientId,
    signaling: options => room.callTransport(options),
    peer:options=>createVoicePeer(options),
    getIceConfiguration:()=>room.getIceConfiguration(),
    iceTransportPolicy:params.get('voiceIcePolicy')==='relay'?'relay':'all',
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
      levels.remove(id);
      const audio = audioByPeer.get(id);
      if (audio) { audio.pause?.(); audio.srcObject = null; audio.remove(); blockedPlayback.delete(audio); audioByPeer.delete(id); }
      updateScreen(id, null);
    },
    onError: message => { networkError = message; render(); },
  });
  const networkDetails=el('details','party-network-diagnostics'),networkSummary=el('summary','','diagnóstico de conexão'),networkOutput=el('pre');
  const refreshNetwork=button('[ atualizar diagnóstico ]',async()=>{
    const items=await session.diagnostics();
    networkOutput.textContent=items.length?items.map(item=>{
      const name=room.state.participants.find(p=>p.clientId===item.id)?.displayName||'Participante';
      const pair=item.candidatePair;
      return (
        name +
        " · " +
        item.status +
        "\n" +
        (pair
          ? pair.route +
            " · " +
            (pair.relayProtocol || pair.protocol || "protocolo indisponível") +
            (pair.rtt !== null ? " · RTT " + Math.round(pair.rtt) + " ms" : "")
          : "rota ainda indisponível")
      );
    }).join('\n\n'):'Nenhuma conexão ativa.';
  });
  networkDetails.append(networkSummary,refreshNetwork,networkOutput);advancedInner.append(networkDetails);
  const roomActions=el('div','party-room-actions'),roomFeedback=el('span','party-room-feedback');roomFeedback.setAttribute('role','status');
  const inviteFallback=el('input','party-invite-fallback');inviteFallback.readOnly=true;inviteFallback.hidden=true;inviteFallback.setAttribute('aria-label','Link de convite');
  const copyInvite=button('[ copiar convite ]',async()=>{
    try {
      if(!room.state.roomId)throw Error('Entre em uma sala para copiar o convite.');
      const url=roomAPI.invite(pageUrl(),room.state.roomId);
      try {if(!globalThis.navigator?.clipboard?.writeText)throw Error();await navigator.clipboard.writeText(url);roomFeedback.textContent='convite copiado';inviteFallback.hidden=true;}
      catch {inviteFallback.value=url;inviteFallback.hidden=false;inviteFallback.focus?.();inviteFallback.select?.();roomFeedback.textContent='copie o link selecionado';}
    }catch(error){roomFeedback.textContent=error.message;}
  });
  const createRoom=button('[ nova party ]',()=>void newParty().catch(error=>{roomFeedback.textContent=error.message;}));
  const roomExit=button('[ sair da sala ]',()=>leaveRoom());
  const roomEnter=button('[ entrar na sala ]',()=>void enterRoom());
  const recentToggle=button('[ recentes ]',()=>{recentsOpen=!recentsOpen;renderRecents();});
  const recentPanel=el('div','party-recents'),recentInner=el('div','party-recents-inner'),recentContent=el('div','party-recents-content'),recentList=el('ul','party-recents-list');
  recentContent.append(el('h3','','// recentes'),recentList);recentInner.append(recentContent);recentPanel.append(recentInner);
  const nameEditor=el('div','party-room-name-editor'),nameInput=el('input');nameEditor.hidden=true;nameInput.maxLength=48;nameInput.setAttribute('aria-label','Nome da sala');
  function setNameEditing(open, restoreFocus = true) {
    nameEditor.hidden = !open;
    roomSummary.dataset.editing = String(open);
    roomNameLabel.hidden = open;
    roomCounts.hidden = open;
    editName.hidden = open || !room.state.roomId;
    if (open) {
      nameInput.value = room.state.name;
      nameInput.focus?.();
      nameInput.select?.();
    } else if (restoreFocus) editName.focus?.();
  }
  function saveRoomName() {
    if (roomAPI.roomName(nameInput.value) === null) {
      roomFeedback.textContent = "Use até 48 caracteres de texto.";
      return;
    }
    if (room.rename(nameInput.value)) {
      setNameEditing(false);
      roomFeedback.textContent = "";
    } else roomFeedback.textContent = "Aguarde a conexão para renomear.";
  }
  nameInput.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();saveRoomName();}if(event.key==='Escape'){event.preventDefault();setNameEditing(false);}};
  nameEditor.append(el('span','','//'),nameInput,button('[ salvar ]',saveRoomName),button('[ cancelar ]',()=>setNameEditing(false)));
  const editName=button('[ editar ]',()=>setNameEditing(true));editName.className='party-room-edit';editName.setAttribute('aria-label','Editar nome da sala');roomSummary.append(editName,nameEditor);
  roomActions.append(copyInvite,createRoom,recentToggle,roomExit,roomEnter,roomFeedback,inviteFallback);functionalArea.append(roomActions,recentPanel);
  function renderRecents(){
    recentPanel.dataset.open = String(recentsOpen);
    recentPanel.inert = !recentsOpen;
    recentPanel.setAttribute("aria-hidden", String(!recentsOpen));
    recentToggle.setAttribute("aria-expanded", String(recentsOpen));
    recentList.replaceChildren();const items=recents.list();
    if(!items.length)recentList.append(el('li','party-recents-empty','nenhuma party recente'));
    for (const item of items) {
      const row = el("li"),
        open = button("", () => {
          recentsOpen = false;
          renderRecents();
          void switchRoom(item.roomId).catch((error) => {
            roomFeedback.textContent = error.message;
          });
        });
      open.className = "party-recent-open";
      open.append(el("span", "", item.name), el("small", "", roomAPI.shortCode(item.roomId)));
      if (item.roomId === room?.state.roomId) open.setAttribute("aria-current", "page");
      const remove = button("[ remover ]", () => {
        recents.remove(item.roomId);
        renderRecents();
      });
      remove.setAttribute("aria-label", "Remover " + item.name + " dos recentes");
      row.append(open, remove);
      recentList.append(row);
    }
  }
  function roomChanged(){
    if(!room.state.roomId)recordedRoom=null;
    else if(room.state.status==='conectado'){
      if(recordedRoom!==room.state.roomId){recents.visit(room.state.roomId,room.state.name);recordedRoom=room.state.roomId;}
      else recents.rename(room.state.roomId,room.state.name);
    }
    if(recentsOpen)renderRecents();render();
  }
  renderRecents();
  room=createPartyRoom({clientId,
    signaling:options=>signalingFactory({...options,url:params.get('voiceWsUrl')||config.url}),
    getMetadata:async()=>{
      const profile=getProfile();let image=profile.avatar;
      if(prepareAvatar&&typeof image==='string'&&image.startsWith('data:'))try{image=await prepareAvatar(image);}catch{image='';}
      const next=localPresence();presenceKey=JSON.stringify(next);presenceSentAt=Date.now();return {...roomAPI.profile({...profile,avatar:image},pageUrl()),...next};
    },onChange:roomChanged,onStatus:value=>chat.connection(value==='conectado'),onApplication:message=>{
      if(['chat-message','chat-history','chat-error','typing-start','typing-stop'].includes(message.type))chat.receive(message);
    },onError:message=>{networkError=message;render();},
  });
  async function enterRoom() {
    let requestedRoom=roomAPI.parse(pageUrl());
    if(!requestedRoom){
      requestedRoom=roomAPI.secureId(window.crypto||globalThis.crypto);
      window.history?.replaceState(null,'',roomAPI.roomUrl(pageUrl(),requestedRoom));
    }
    if(room.state.roomId&&room.state.roomId!==requestedRoom)leaveRoom();
    selectedRoom=requestedRoom;
    if(roomEntry?.id===requestedRoom)return roomEntry.promise;
    if(room.state.roomId===selectedRoom)return;
    const targetRoom=selectedRoom;
    const epoch=lobbyEpoch,entry={id:targetRoom};roomEntry=entry;
    entry.promise=(async()=>{
      networkError='';chat.start(targetRoom);void devices.start();await room.enter(targetRoom);
      if(roomEntry!==entry||epoch!==lobbyEpoch)return;
      if(room.state.roomId!==targetRoom)chat.close();
      else {call.state.roomId=targetRoom;activityPresence?.start();}
      render();
    })().finally(()=>{if(roomEntry===entry)roomEntry=null;});
    return entry.promise;
  }
  async function enterCall() {
    const epoch=lobbyEpoch;
    if(!room.state.roomId)await enterRoom();
    if(!room.state.roomId||epoch!==lobbyEpoch)return;
    const roomId=room.state.roomId;
    try{await room.getIceConfiguration();}catch{networkError='Não foi possível preparar a conexão. Tente entrar novamente.';render();return;}
    if(epoch!==lobbyEpoch||room.state.roomId!==roomId)return;
    levels.start();
    await devices.start();
    if (epoch !== lobbyEpoch || room.state.roomId !== roomId) {
      levels.stop();
      return;
    }
    call.state.inputId = devices.preferences.preferredAudioInputId;
    call.state.roomId = room.state.roomId;
    await call.join();
  }
  function leaveRoom() {
    lobbyEpoch++;
    roomEntry = null;
    call.leave();
    chat.close();
    room.leave();
    activityPresence?.stop();
    globalThis.clearTimeout?.(presenceTimer);
    presenceTimer = null;
    presenceKey = "";
    localIsSpeaking = false;
    devices.stop();
    chatOpen = false;
    mediaOpen = false;
    setNameEditing(false, false);
    networkError = "";
    roomFeedback.textContent = "";
    inviteFallback.hidden = true;
    render();
  }
  async function switchRoom(id){if(!roomAPI.validRoomId(id))return;leaveRoom();selectedRoom=id;window.history?.replaceState(null,'',roomAPI.roomUrl(pageUrl(),id));await enterRoom();}
  async function newParty() {
    await switchRoom(roomAPI.secureId(window.crypto||globalThis.crypto));
  }
  function render(state = call.state) {
    root.dataset.joined = String(state.joined);
    controls.hidden = !state.joined;
    meterLabel.hidden = !state.joined;
    const inRoom=!!room?.state.roomId, members=room?.state.participants || [];
    const visibleRemotes=members.length ? members.filter(p=>p.clientId!==clientId).map(p=>({...remotes.find(r=>r.id===p.clientId),...p,id:p.clientId,name:p.displayName})) : remotes;
    const roomCount=members.length || (inRoom?1:state.joined?remotes.length+1:0), callCount=members.length?members.filter(p=>p.inCall).length:state.joined?remotes.length+1:0;
    root.dataset.inRoom=String(inRoom);
    const roomName=room?.state.name||'geral';
    roomNameLabel.textContent='// '+roomName;
    roomCounts.textContent=inRoom?' · '+roomAPI.shortCode(room.state.roomId)+' · '+roomCount+' na sala · '+callCount+' em chamada':' · fora da sala';
    if(roomName!==lastRoomName){lastRoomName=roomName;roomSummary.classList?.remove('party-room-renamed');void roomSummary.offsetWidth;roomSummary.classList?.add('party-room-renamed');}
    emptyHeading.textContent='// '+roomName;
    editName.hidden=!inRoom||!nameEditor.hidden;editName.disabled=room?.state.status!=='conectado';
    root.dataset.count=String(visibleRemotes.length+1);
    sidebar.hidden=!inRoom&&!state.joined;
    copyInvite.hidden=roomExit.hidden=!inRoom;roomEnter.hidden=inRoom;

    waiting.hidden = !state.joined || !!remotes.length || !!screens.size;
    updateLayout();
    localName.textContent = roomAPI.profile(getProfile(),pageUrl()).displayName;
    const nextAvatarKey = JSON.stringify([getProfile().name,getProfile().avatar]);
    if (nextAvatarKey !== avatarKey) { avatarKey = nextAvatarKey; localAvatar.replaceChildren(...avatar(getProfile().name,getProfile().avatar).children); }
    presenceText(localMood,statusText());localMood.hidden=!localMood.textContent;
    musicText(localMusic,localPresence().nowPlaying);
    if (!state.joined) {localIsSpeaking=false;presenceText(localSpeaking,inRoom?(activityPresence?.idle?'ausente':'fora da chamada'):'');}
    else setSpeaking(clientId,{level:meter.value,speaking:localSpeaking.dataset.speaking==='true'});
    levels.setMuted(clientId,state.muted || state.micUnavailable);
    if (!participants.children.length) participants.append(participant);
    for (const [id,row] of rows) if (!visibleRemotes.some(p=>p.id===id)) { row.node.remove(); rows.delete(id); }
    visibleRemotes.forEach((remote,index) => {
      let row = rows.get(remote.id);
      if (!row) {
        const node = el('li'), name = el('span'), indicator = el('span','spacevoice-speaking'); node.dataset.peerId = remote.id;
        const details = el('details','spacevoice-volume'), summary = el('summary','','volume'), label = el('label','','Volume '), range = el('input');
        range.type = "range";
        range.min = 0;
        range.max = 100;
        range.step = 1;
        range.value = Math.round(devices.volume(remote.id) * 100);
        range.setAttribute("aria-label", "Volume do participante " + (index + 1));
        range.oninput = () => { devices.setVolume(remote.id,Number(range.value)/100); summary.textContent = 'volume '+range.value+'%'; updatePlayback(remote.id); };
        label.append(range); details.append(summary,label);
        const retry=button('[ tentar novamente ]',()=>session.retry(remote.id));retry.hidden=true;
        const mood=el('span','party-presence-mood');mood.hidden=true;
        const music=el('span','party-presence-music');music.hidden=true;
        const secondary = el("div", "party-presence-secondary"),
          secondaryInner = el("div");
        secondaryInner.append(mood, music);
        secondary.append(secondaryInner);
        secondary.setAttribute("aria-hidden", String(root.dataset.mode === "screen"));
        const info = el('div','spacevoice-person'); info.append(name,indicator,secondary,details,retry);
        const image=avatar(remote.name || 'Convidado '+(index+1),remote.avatar);
        node.append(image,info); row = {node,name,indicator,mood,music,secondary,range,details,image,retry,avatarKey:JSON.stringify([remote.name,remote.avatar])}; rows.set(remote.id,row);
      }
      row.name.textContent = remote.name || 'Convidado '+(index+1);
      presenceText(row.mood,remote.statusText||'');row.mood.hidden=!row.mood.textContent;row.node.dataset.idle=String(!!remote.idle);
      musicText(row.music,remote.nowPlaying);
      const key=JSON.stringify([remote.name,remote.avatar]);if(key!==row.avatarKey){row.avatarKey=key;row.image.replaceChildren(...avatar(remote.name,remote.avatar).children);}
      row.retry.hidden=!state.joined||remote.inCall===false||remote.status!=='falha';
      row.details.hidden=!state.joined||remote.inCall===false;
      if(!state.joined||remote.inCall===false){row.node.dataset.speaking='false';presenceText(row.indicator,roomAPI.activityLabel(remote));}
      else setSpeaking(remote.id,{level:0,speaking:row.indicator.dataset.speaking==='true'});
      if(!row.retry.hidden)presenceText(row.indicator,'não foi possível conectar');
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
    status.textContent =
      state.error ||
      audioError ||
      networkError ||
      (state.joined
        ? remotes.length
          ? "WebRTC · " +
            remotes.filter((p) => p.status === "conectado").length +
            "/" +
            remotes.length +
            " peers conectados"
          : signalingStatus && signalingStatus !== "conectado"
            ? "Signaling · " + signalingStatus
            : "Microfone ativo · aguardando peer na sala geral"
        : state.joining
          ? "Aguardando permissão do navegador…"
          : "Clique em entrar na chamada para solicitar o microfone.");
    device.textContent = state.localStream?.getAudioTracks()[0]?.label || '';
    device.hidden = !device.textContent;
    emptyText.textContent = state.joined ? '' : inRoom?'fora da chamada':'entre em uma sala';
    emptyText.hidden=state.joined||inRoom;
    emptyHeading.hidden=inRoom||state.joined;
    syncPresence();
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
      mediaAPI.hint(currentScreen?.getVideoTracks()[0],mediaPreferences.screenContentHint);
      session.setScreen?.(currentScreen);
      void session.setMediaSettings?.(mediaPreferences,state.screenPreset);
      renderMedia();
      updateScreen(clientId, currentScreen, true);
    }
    render(state);
  });
  void session.setMediaSettings?.(mediaPreferences,quality.value);
  void devices.start();
  window.addEventListener('pagehide',leaveRoom);
  window.addEventListener('myspace-profile-change',()=>{syncPresence();render();});
  for(const event of ['spaceamp:trackchange','spaceamp:playstate','spaceamp:privacy'])window.addEventListener(event,()=>{syncPresence();render();});
  return {root,call,chat,room,newParty,enterRoom,leaveRoom,switchRoom,
    show:()=>{void devices.start();void enterRoom();render();chat.viewport(chatVisible(),nearChatBottom());},
    hide:leaveRoom,leave:()=>call.leave()};
}
