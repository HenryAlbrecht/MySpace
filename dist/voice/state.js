/* Runtime call state; streams and permissions are never persisted. */
(function (root) {
  function createVoiceCall(media) {
    const state = { joined: false, joining: false, muted: false, deafened: false, roomId: 'geral', localStream: null, error: '', screenStream:null, screenSharing:false, screenStarting:false, screenError:'', screenPreset:'1080p60' };
    const listeners = new Set();
    let session = 0, detach = () => {};
    let screenRequest = 0, detachScreen = () => {};
    const emit = () => listeners.forEach(listener => listener(state));
    const messages = {
      NotAllowedError: 'Acesso ao microfone negado. Permita o acesso no navegador e tente novamente.',
      NotFoundError: 'Nenhum microfone disponível. Conecte um dispositivo e tente novamente.',
      NotReadableError: 'Não foi possível acessar o microfone. Verifique se ele está em uso.',
      InsecureContextError: 'O microfone precisa de HTTPS ou localhost.',
      MediaUnavailableError: 'Este navegador não disponibiliza acesso ao microfone.',
    };
    function leave() {
      session++;
      stopScreenShare(false);
      detach(); detach = () => {};
      media.release(state.localStream);
      Object.assign(state, { joined: false, joining: false, muted: false, deafened: false, localStream: null, error: '' });
      emit();
    }
    function stopScreenShare(notify = true) {
      screenRequest++;
      detachScreen(); detachScreen = () => {};
      media.release(state.screenStream);
      Object.assign(state, {screenStream:null, screenSharing:false, screenStarting:false, screenError:''});
      if (notify) emit();
    }
    return {
      state,
      subscribe(listener) { listeners.add(listener); listener(state); return () => listeners.delete(listener); },
      async join() {
        if (state.joined || state.joining) return;
        const request = ++session;
        state.joining = true; state.error = ''; emit();
        try {
          const stream = await media.acquire();
          // Leaving while permission is pending must not leak a later stream.
          if (request !== session) { media.release(stream); return; }
          if (!stream.getAudioTracks().length) {
            media.release(stream);
            throw Object.assign(new Error('No audio'), { name: 'NotFoundError' });
          }
          Object.assign(state, { localStream: stream, joined: true, joining: false });
          const ended = () => { leave(); state.error = 'O microfone foi desconectado. Entre novamente para reconectar.'; emit(); };
          const tracks = stream.getAudioTracks();
          tracks.forEach(track => track.addEventListener?.('ended', ended));
          detach = () => tracks.forEach(track => track.removeEventListener?.('ended', ended));
          emit();
        } catch (error) {
          if (request !== session) return;
          state.joining = false;
          state.error = messages[error.name] || 'Não foi possível iniciar o microfone. Tente novamente.';
          emit();
        }
      },
      leave,
      async startScreenShare(preset = '1080p60') {
        if (!state.joined || state.screenStream || state.screenStarting) return;
        const request = ++screenRequest;
        Object.assign(state, {screenStarting:true, screenError:'', screenPreset:preset}); emit();
        try {
          const stream = await media.acquireScreen(preset);
          if (request !== screenRequest || !state.joined) { media.release(stream); return; }
          const video = stream.getVideoTracks()[0];
          if (!video || video.readyState === 'ended') { media.release(stream); throw Object.assign(Error('No video'),{name:'DisplayVideoMissingError'}); }
          const ended = () => stopScreenShare();
          video.addEventListener?.('ended', ended);
          detachScreen = () => video.removeEventListener?.('ended', ended);
          Object.assign(state, {screenStream:stream, screenSharing:true, screenStarting:false}); emit();
        } catch (error) {
          if (request !== screenRequest) return;
          state.screenStarting = false;
          state.screenError = error.name === 'NotAllowedError' || error.name === 'AbortError' ? 'Compartilhamento cancelado ou não permitido.' : error.name === 'DisplayUnavailableError' ? 'Este navegador não disponibiliza captura de tela.' : error.name === 'DisplayVideoMissingError' ? 'A captura não retornou uma track de vídeo.' : error.name === 'InsecureContextError' ? 'Compartilhar tela precisa de HTTPS ou localhost.' : 'Não foi possível compartilhar a tela. Tente novamente.';
          emit();
        }
      },
      stopScreenShare,
      toggleMute() { if (!state.joined) return; state.muted = !state.muted; media.mute(state.localStream, state.muted); emit(); },
      toggleDeafen() { if (!state.joined) return; state.deafened = !state.deafened; emit(); },
    };
  }
  root.createVoiceCall = createVoiceCall;
  if (typeof module !== 'undefined') module.exports = createVoiceCall;
})(globalThis);
