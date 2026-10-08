/* Runtime call state; streams and permissions are never persisted. */
(function (root) {
  function createVoiceCall(
    media,
    {
      inputId = "",
      replaceMicrophone = async () => {},
      onInput = () => {},
      microphoneSettings = () => ({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      }),
    } = {},
  ) {
    const state = {
      joined: false,
      joining: false,
      muted: false,
      deafened: false,
      roomId: "geral",
      localStream: null,
      error: "",
      inputId,
      micSwitching: false,
      micUnavailable: false,
      screenStream: null,
      screenSharing: false,
      screenStarting: false,
      screenError: "",
      screenPreset: "1080p60",
    };
    const listeners = new Set();
    let session = 0,
      detach = () => {};
    let screenRequest = 0,
      detachScreen = () => {};
    let micRequest = 0;
    const emit = () => listeners.forEach((listener) => listener(state));
    const messages = {
      NotAllowedError:
        "Acesso ao microfone negado. Permita o acesso no navegador e tente novamente.",
      NotFoundError: "Nenhum microfone disponível. Conecte um dispositivo e tente novamente.",
      NotReadableError: "Não foi possível acessar o microfone. Verifique se ele está em uso.",
      InsecureContextError: "O microfone precisa de HTTPS ou localhost.",
      MediaUnavailableError: "Este navegador não disponibiliza acesso ao microfone.",
    };
    function leave() {
      session++;
      micRequest++;
      stopScreenShare(false);
      detach();
      detach = () => {};
      media.release(state.localStream);
      Object.assign(state, {
        joined: false,
        joining: false,
        muted: false,
        deafened: false,
        localStream: null,
        error: "",
        micSwitching: false,
        micUnavailable: false,
      });
      emit();
    }
    function watchMicrophone(stream) {
      detach();
      const tracks = stream.getAudioTracks();
      const ended = () => {
        if (state.joined && state.localStream === stream) recoverMicrophone();
      };
      tracks.forEach((track) => track.addEventListener?.("ended", ended));
      detach = () => tracks.forEach((track) => track.removeEventListener?.("ended", ended));
    }
    function validateMicrophone(stream) {
      if (!stream.getAudioTracks().length || stream.getAudioTracks()[0].readyState === "ended")
        throw Object.assign(Error("No live microphone"), { name: "NotFoundError" });
    }
    async function switchMicrophone(id = "") {
      if (state.micSwitching || state.joining) return false;
      if (!state.joined) {
        state.inputId = id;
        onInput(id);
        emit();
        return true;
      }
      const epoch = session,
        request = ++micRequest,
        previous = state.localStream;
      let next;
      state.micSwitching = true;
      state.error = "";
      emit();
      try {
        next = await media.acquire(id, microphoneSettings());
        validateMicrophone(next);
        if (epoch !== session || request !== micRequest) {
          media.release(next);
          return false;
        }
        media.mute(next, state.muted);
        await replaceMicrophone(next);
        if (epoch !== session || request !== micRequest) {
          media.release(next);
          return false;
        }
        // No old track is stopped until the entire mesh committed its replacement.
        media.mute(next, state.muted);
        state.localStream = next;
        state.inputId = id;
        state.micUnavailable = false;
        watchMicrophone(next);
        onInput(id);
        emit();
        media.release(previous);
        return true;
      } catch (error) {
        media.release(next);
        if (epoch !== session || request !== micRequest) return false;
        state.micUnavailable = previous?.getAudioTracks()[0]?.readyState === "ended";
        state.error = state.micUnavailable
          ? "Microfone indisponível. A chamada continua; selecione um microfone para tentar novamente."
          : "Não foi possível trocar o microfone. O anterior foi mantido.";
        return false;
      } finally {
        if (epoch === session && request === micRequest) {
          state.micSwitching = false;
          emit();
        }
      }
    }
    async function recoverMicrophone() {
      if (!state.joined || state.micSwitching || state.micUnavailable) return false;
      return switchMicrophone("");
    }
    function stopScreenShare(notify = true) {
      screenRequest++;
      detachScreen();
      detachScreen = () => {};
      media.release(state.screenStream);
      Object.assign(state, {
        screenStream: null,
        screenSharing: false,
        screenStarting: false,
        screenError: "",
      });
      if (notify) emit();
    }
    return {
      state,
      subscribe(listener) {
        listeners.add(listener);
        listener(state);
        return () => listeners.delete(listener);
      },
      async join() {
        if (state.joined || state.joining) return;
        const request = ++session;
        state.joining = true;
        state.error = "";
        emit();
        try {
          let stream;
          try {
            stream = await media.acquire(state.inputId, microphoneSettings());
          } catch (error) {
            if (
              !state.inputId ||
              !["NotFoundError", "OverconstrainedError"].includes(error.name) ||
              request !== session
            )
              throw error;
            state.inputId = "";
            onInput("");
            stream = await media.acquire("", microphoneSettings());
          }
          // Leaving while permission is pending must not leak a later stream.
          if (request !== session) {
            media.release(stream);
            return;
          }
          if (
            !stream.getAudioTracks().length ||
            stream.getAudioTracks()[0].readyState === "ended"
          ) {
            media.release(stream);
            throw Object.assign(new Error("No audio"), { name: "NotFoundError" });
          }
          Object.assign(state, {
            localStream: stream,
            joined: true,
            joining: false,
            micUnavailable: false,
          });
          watchMicrophone(stream);
          emit();
        } catch (error) {
          if (request !== session) return;
          state.joining = false;
          state.error =
            messages[error.name] || "Não foi possível iniciar o microfone. Tente novamente.";
          emit();
        }
      },
      leave,
      switchMicrophone,
      recoverMicrophone,
      async applyMicrophoneSettings(processing) {
        if (state.micSwitching || state.joining) return false;
        if (!state.joined) return true;
        const track = state.localStream?.getAudioTracks()[0],
          epoch = session;
        const previousConstraints = track?.getConstraints?.() || {};
        state.micSwitching = true;
        emit();
        try {
          if (!track?.applyConstraints || track.readyState === "ended")
            throw Error("Runtime constraints unavailable");
          await track.applyConstraints({ ...track.getConstraints?.(), ...processing });
          const actual = track.getSettings?.() || {};
          if (
            Object.entries(processing).some(
              ([key, value]) => key in actual && actual[key] !== value,
            )
          )
            throw Error("Constraints ignored");
          return epoch === session;
        } catch {
          if (epoch !== session) return false;
        } finally {
          if (epoch === session) {
            state.micSwitching = false;
            emit();
          }
        }
        const replaced = await switchMicrophone(state.inputId);
        if (!replaced && epoch === session && state.localStream?.getAudioTracks()[0] === track) {
          try {
            await track?.applyConstraints?.(previousConstraints);
          } catch {}
        }
        return replaced;
      },
      async startScreenShare(preset = "1080p60") {
        if (!state.joined || state.screenStream || state.screenStarting) return;
        const request = ++screenRequest;
        Object.assign(state, { screenStarting: true, screenError: "", screenPreset: preset });
        emit();
        try {
          const stream = await media.acquireScreen(preset);
          if (request !== screenRequest || !state.joined) {
            media.release(stream);
            return;
          }
          const video = stream.getVideoTracks()[0];
          if (!video || video.readyState === "ended") {
            media.release(stream);
            throw Object.assign(Error("No video"), { name: "DisplayVideoMissingError" });
          }
          const ended = () => stopScreenShare();
          video.addEventListener?.("ended", ended);
          detachScreen = () => video.removeEventListener?.("ended", ended);
          Object.assign(state, {
            screenStream: stream,
            screenSharing: true,
            screenStarting: false,
          });
          emit();
        } catch (error) {
          if (request !== screenRequest) return;
          state.screenStarting = false;
          state.screenError =
            error.name === "NotAllowedError" || error.name === "AbortError"
              ? "Compartilhamento cancelado ou não permitido."
              : error.name === "DisplayUnavailableError"
                ? "Este navegador não disponibiliza captura de tela."
                : error.name === "DisplayVideoMissingError"
                  ? "A captura não retornou uma track de vídeo."
                  : error.name === "InsecureContextError"
                    ? "Compartilhar tela precisa de HTTPS ou localhost."
                    : "Não foi possível compartilhar a tela. Tente novamente.";
          emit();
        }
      },
      stopScreenShare,
      toggleMute() {
        if (!state.joined) return;
        state.muted = !state.muted;
        media.mute(state.localStream, state.muted);
        emit();
      },
      toggleDeafen() {
        if (!state.joined) return;
        state.deafened = !state.deafened;
        emit();
      },
    };
  }
  root.createVoiceCall = createVoiceCall;
  if (typeof module !== "undefined") module.exports = createVoiceCall;
})(globalThis);
