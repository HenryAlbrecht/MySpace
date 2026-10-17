/* Optional transports/configuration. Catalog and the shared web rules retain ownership. */
(() => {
  const native = window.__TAURI__?.core;
  if (!native?.invoke) return;
  const check = (signal) => {
    if (signal?.aborted) throw new DOMException("Carregamento cancelado.", "AbortError");
  };
  async function invoke(command, args, signal) {
    check(signal);
    let timer;
    try {
      const value = await Promise.race([
        native.invoke(command, args),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(Error("Tempo limite do serviço musical. Tente novamente.")), 18000);
        }),
      ]);
      check(signal);
      return value;
    } finally {
      clearTimeout(timer);
    }
  }
  let configured;
  let revision = 0;
  let lastfmFailure = "";
  let recommendationState = {};
  window.DesktopTranslation = window.TranslationClient.createTranslationClient({
    requester: (text, source) => invoke("translate_desktop_summary", { text, source }),
  });
  const lastfm = window.LastfmClient.createLastfmClient({
    requester: async (method, params) => {
      configured ??= await invoke("lastfm_configured");
      if (!configured) throw Error("Last.fm opcional: API Key não configurada.");
      try {
        const payload = await invoke("request_lastfm", { method, params });
        lastfmFailure = "";
        return payload;
      } catch (error) {
        lastfmFailure = String(error.message || error);
        throw error;
      }
    },
  });
  const original = window.DesktopMusicRecommendations;
  const browse = window.DesktopMusicBrowse.details.bind(window.DesktopMusicBrowse);
  window.DesktopMusicBrowse.details = async (kind, id, options = {}) => {
    const detail = await browse(kind, id, options);
    check(options.signal);
    if (options.phase === "core") return detail;
    // Editorial never changes identity, image, track order or discography.
    try {
      const editorial = await lastfm.summary(kind, kind === "artist" ? detail.title : detail.artist, detail.title);
      check(options.signal);
      return {
        ...detail,
        ...(editorial.summary ? { summary: editorial.summary, summarySource: "Last.fm", summaryStatus: "available" } : {}),
        ...(!detail.genres?.length && editorial.genres?.length ? { genres: editorial.genres, genresSource: "Last.fm" } : {}),
      };
    } catch {
      check(options.signal);
      return { ...detail, summaryStatus: detail.summary ? "available" : "unavailable" };
    }
  };
  function createRecommendations(signal) {
    const youtubeMusic = {
      search: async (kind, query) => {
        check(signal);
        const items = await window.Catalog.search(kind, query, { signal });
        check(signal);
        return { items };
      },
      details: async (kind, id) => {
        check(signal);
        const detail = await window.Catalog.prefetchCore({ kind, catalogId: "ytmusic:" + kind + ":" + id });
        check(signal);
        return detail;
      },
      peek: (kind, id) => window.Catalog.peekCore({ kind, catalogId: "ytmusic:" + (kind === "music" ? "video" : kind) + ":" + id }),
      radio: async (videoId, { force = false } = {}) => ({ items: await original.recommendations({ kind: "music", catalogId: "ytmusic:video:" + videoId }, { signal, force }) }),
    };
    return window.createMusicRecommendations({
      youtubeMusic,
      lastfm: {
        async recommendations(...args) {
          check(signal);
          configured ??= await invoke("lastfm_configured", undefined, signal);
          if (!configured) return { items: [] };
          return lastfm.recommendations(...args);
        },
      },
      MusicModel: window.MusicModel,
      state: recommendationState,
      ...window.MusicRecommendationRanking,
    });
  }
  window.DesktopMusicRecommendations = {
    get revision() { return revision; },
    async recommendations(item, options = {}) {
      if (navigator.onLine === false) throw Error("Sem conexão. As músicas locais continuam disponíveis.");
      const controller = new AbortController();
      const cancel = () => controller.abort();
      options.signal?.addEventListener("abort", cancel, { once: true });
      if (options.signal?.aborted) cancel();
      const timer = setTimeout(cancel, 40000);
      const id = item.catalogId || "";
      try {
        check(controller.signal);
        const api = createRecommendations(controller.signal);
        let result;
        try {
          result = await api.recommendations(item.kind, item.kind === "artist" ? item.title : item.artist || "", item.title || "", {
            ...options,
            videoId: item.kind === "music" ? item.playbackSource?.videoId || id.match(/^ytmusic:video:([\w-]{11})$/)?.[1] || "" : "",
            artistId: item.kind === "artist" ? id.match(/^ytmusic:artist:(UC[\w-]{8,80})$/)?.[1] || "" : "",
            albumId: item.kind === "album" ? id.match(/^ytmusic:album:(MPRE[\w-]{4,120})$/)?.[1] || "" : "",
          });
        } catch (error) {
          check(controller.signal);
          // Resolve fallback signals with the same conservative web path.
          if (!window.MusicModel.validCatalogId(item.kind, id)) throw error;
          try {
            result = await api.recommendations(item.kind, item.kind === "artist" ? item.title : item.artist || "", item.title || "", options);
            result.resolution = { ...result.resolution, status: "partial", failures: (result.resolution?.failures || 0) + 1 };
          } catch {
            throw error;
          }
        }
        check(controller.signal);
        const rows = [...(result.items || [])];
        Object.defineProperties(rows, {
          reserveAvailable: { configurable: true, value: !!result.reserveAvailable },
          sourceExhausted: { configurable: true, value: !(result.reserveAvailable || result.resolution?.failures) },
          resolution: { configurable: true, value: result.resolution || { status: "complete", failures: 0, total: rows.length } },
          basis: { configurable: true, value: result.basis || "Conteúdo relacionado no YouTube Music" },
        });
        return rows;
      } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", cancel);
      }
    },
  };
  window.DesktopOnlineSettings = {
    async saveLastfmKey(key) {
      const result = await invoke("save_lastfm_key", { key });
      configured = result;
      lastfmFailure = "";
      recommendationState = {};
      revision++;
      return result;
    },
  };
  const dialog = document.querySelector(".desktop-poc");
  if (!dialog) return;
  const section = document.createElement("section");
  section.className = "desktop-api-keys";
  const heading = document.createElement("h3");
  heading.textContent = "Chaves de API";
  const label = document.createElement("label");
  label.textContent = "Last.fm — API Key pessoal (opcional)";
  const input = document.createElement("input");
  input.type = "password";
  input.maxLength = 32;
  input.autocomplete = "off";
  input.spellcheck = false;
  label.append(input);
  const save = document.createElement("button");
  save.type = "button";
  save.textContent = "Salvar chave";
  const remove = document.createElement("button");
  remove.type = "button";
  remove.textContent = "Remover chave";
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  status.textContent = "A chave fica no perfil local deste aplicativo, fora do backup .myspace.";
  const attribution = document.createElement("a");
  attribution.href = "https://www.last.fm/";
  attribution.textContent = "Similaridade e informações fornecidas pelo Last.fm";
  attribution.target = "_blank";
  attribution.rel = "noopener noreferrer";
  async function saveKey(key) {
    input.value = "";
    save.disabled = remove.disabled = true;
    try {
      const active = await window.DesktopOnlineSettings.saveLastfmKey(key);
      status.textContent = active ? "Chave Last.fm salva neste perfil. Será usada na próxima consulta compatível." : "Chave removida. YouTube Music continua disponível.";
    } catch (error) {
      status.textContent = String(error.message || error);
    } finally {
      save.disabled = remove.disabled = false;
    }
  }
  save.onclick = () => {
    const key = input.value.trim();
    if (!/^[a-f\d]{32}$/i.test(key)) {
      status.textContent = "Informe a API Key de 32 caracteres, sem Shared Secret.";
      return;
    }
    return saveKey(key);
  };
  remove.onclick = () => saveKey("");
  dialog.addEventListener("close", () => { input.value = ""; });
  section.append(heading, label, save, remove, status, attribution);
  dialog.append(section);
  const open = document.createElement("button");
  open.type = "button";
  open.className = "amp-panel-action";
  open.textContent = "configurações Desktop";
  open.onclick = () => {
    if (!dialog.open) dialog.showModal();
    section.scrollIntoView({ block: "nearest" });
    input.focus({ preventScroll: true });
    void invoke("lastfm_configured").then((active) => {
      configured = active;
      status.textContent = active ? lastfmFailure || "Uma API Key Last.fm está salva neste perfil." : "Last.fm opcional: nenhuma chave configurada.";
    }).catch(() => { status.textContent = "Não foi possível ler a configuração Last.fm."; });
  };
  document.querySelector("#music .amp-panel-actions")?.append(open);
})();
