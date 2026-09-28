/* Runtime call state; streams and permissions are never persisted. */
(function (root) {
  function createVoiceCall(media) {
    const state = { joined: false, joining: false, muted: false, deafened: false, roomId: 'geral', localStream: null, error: '' };
    const listeners = new Set();
    let session = 0, detach = () => {};
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
      detach(); detach = () => {};
      media.release(state.localStream);
      Object.assign(state, { joined: false, joining: false, muted: false, deafened: false, localStream: null, error: '' });
      emit();
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
      toggleMute() { if (!state.joined) return; state.muted = !state.muted; media.mute(state.localStream, state.muted); emit(); },
      toggleDeafen() { if (!state.joined) return; state.deafened = !state.deafened; emit(); },
    };
  }
  root.createVoiceCall = createVoiceCall;
  if (typeof module !== 'undefined') module.exports = createVoiceCall;
})(globalThis);
