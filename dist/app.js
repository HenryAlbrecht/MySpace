const $ = (id) => document.getElementById(id);
const defaults = {
  name: "Halourt",
  location: "Brasil",
  tagline: "“ainda preso em 2007.”",
  mood: "nostálgico",
  bio: "Um pouco de música, umas ideias aleatórias e uma saudade de uma internet que eu nem sei se existiu desse jeito. Aqui eu posso ser eu, sem muito filtro.",
  interests: "música, anime, internet antiga, madrugada, café, playlists",
  wall: "Saudades de quando trocar a música do perfil era um evento. Resolvi criar um espaço só meu de novo. Seja bem-vindo :)",
  theme: "night",
  avatar: "profile-art.png",
  banner: "profile-art.png",
  song: "Nenhuma música",
  artist: "",
  musicUrl: "",
  album: "",
};
let state = { ...defaults },
  pending = {},
  localAudio = "",
  objectUrl = "",
  loadedSource = "",
  editVersion = 0,
  musicTask = Promise.resolve(),
  imageTasks = [];
try {
  const saved = JSON.parse(localStorage.getItem("myspace-profile-v1"));
  if (saved && typeof saved === "object")
    for (const key of Object.keys(defaults))
      if (typeof saved[key] === "string") state[key] = saved[key];
} catch {}
const form = $("profileForm"),
  audio = $("audio");
let ampStorage;try{ampStorage=localStorage;}catch{}
window.SPACEAMP=SpaceAmp.create({storage:ampStorage});
let ampTrackKey='',ampAudioPlaying=false,ampStopped=false,ytBinding=null,ytTrack=null,ytPlaying=false,ytEpoch=0;
const ampMediaSession=SpaceAmpIntegrations.mediaSession({controls:{play:()=>ytBinding?ytBinding.play():audio.play(),pause:()=>ytBinding?ytBinding.pause():audio.pause(),stop:()=>stopAmp(),previoustrack:()=>window.SPACEAMP.previous(),nexttrack:()=>window.SPACEAMP.next()}});
function updateAmp(){const embed=!localAudio&&MediaEmbeds.parse(state.musicUrl),track=ytTrack||SpaceAmp.track({...state,local:!!localAudio},embed),active=embed?.provider==='youtube'?ytPlaying:ampAudioPlaying&&!embed&&!!loadedSource&&!audio.paused&&!audio.ended&&!audio.error;window.SPACEAMP.update(track,active);ampMediaSession.update(track,{playing:active,stopped:ampStopped,available:!!loadedSource||!!ytBinding});const key=JSON.stringify(track);if(key!==ampTrackKey){ampTrackKey=key;$('music').classList.remove('spaceamp-track-change');void $('music').offsetWidth;$('music').classList.add('spaceamp-track-change');}}
function stopAmp(){ampStopped=true;ytPlaying=false;ytBinding?.stop();audio.pause();audio.currentTime=0;updateAmp();}
function attachYouTube(iframe){const epoch=ytEpoch;let videoVersion=0,currentVideo=MediaEmbeds.parse(state.musicUrl)?.url,pendingMetadata=false,confirmedPlaying=false;
 ytBinding=SpaceAmpIntegrations.youtube({iframe,onState:async event=>{
  if(epoch!==ytEpoch)return;confirmedPlaying=event.playing;ytPlaying=!pendingMetadata&&confirmedPlaying;if(event.ended)ampStopped=true;else if(event.playing)ampStopped=false;
  const video=MediaEmbeds.parse(event.url);
  if(video?.provider==='youtube'&&video.url!==currentVideo){
   currentVideo=video.url;const version=++videoVersion;pendingMetadata=true;ytPlaying=false;ytTrack=SpaceAmp.track({song:'Vídeo do YouTube',artist:'',musicUrl:video.url},video);updateAmp();
   const metadata=await MediaEmbeds.metadata(video.url);if(epoch!==ytEpoch||version!==videoVersion)return;
   pendingMetadata=false;ytTrack=SpaceAmp.track({song:metadata?.title||'Vídeo do YouTube',artist:metadata?.artist||'',album:metadata?.thumbnail||'',musicUrl:video.url},video);ytPlaying=confirmedPlaying;
  }
  render();
 }});updateAmp();
}
$('sharePartyMusic').checked=window.SPACEAMP.getState().shared;
$('sharePartyMusic').onchange=e=>window.SPACEAMP.share(e.target.checked);
audio.volume = 0.7;
function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("toast").classList.remove("visible"), 3200);
}
function safeUrl(value, allowData = false) {
  if (!value) return "";
  if (value === "profile-art.png") return value;
  if (allowData && /^data:image\/(png|jpeg|webp|gif);base64,/.test(value))
    return value;
  try {
    const u = new URL(value);
    if (u.protocol === "https:" || u.protocol === "http:") return u.href;
  } catch {}
  return "";
}
function image(el, url) {
  el.style.backgroundImage = url ? `url(${JSON.stringify(url)})` : "";
}
const musicEmbed = document.createElement('div');
musicEmbed.className = 'music-embed';
$('music').insertBefore(musicEmbed, $('playerNote'));
let embeddedSource = '';
function render() {
  document.body.dataset.theme = ["night", "terminal", "candy", "paper"].includes(
    state.theme,
  )
    ? state.theme
    : "night";
  $("profileName").textContent = state.name;
  $("breadcrumb").textContent = state.name.toLowerCase();
  $("handle").textContent = "@" + state.name.toLowerCase().replace(/\s+/g, "_");
  for (const key of ["location", "tagline", "mood", "bio"])
    $(key).textContent = state[key];
  $("moodCard").textContent = state.mood;
  $("wallText").textContent = state.wall;
  document.title = "MySpace / " + state.name;
  $("interestTags").replaceChildren(
    ...state.interests
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const el = document.createElement("span");
        el.textContent = s;
        return el;
      }),
  );
  const av = safeUrl(state.avatar, true);
  image($("avatar"), av);
  $("avatar").firstElementChild.hidden = !!av;
  image($("banner"), safeUrl(state.banner, true));
  $("songTitle").textContent = state.song || "Nenhuma música";
  $("songArtist").textContent = state.artist;
  const embed = !localAudio && MediaEmbeds.parse(state.musicUrl);
  const embedSource = embed?.src || '';
  if(embedSource!==embeddedSource){ytEpoch++;ytBinding?.close();ytBinding=null;ytTrack=null;ytPlaying=false;ampStopped=false;}
  const currentTrack=ytTrack||SpaceAmp.track({...state,local:!!localAudio},embed);
  $('songTitle').textContent=currentTrack.title;$('songArtist').textContent=currentTrack.artist;
  $('songSource').textContent=currentTrack.source;
  const cover = safeUrl(currentTrack.artwork, true);
  $("albumImage").hidden = !cover;
  $("albumPlaceholder").hidden = !!cover;
  if (cover) $("albumImage").src = cover;
  else $("albumImage").removeAttribute("src");
  if (embedSource !== embeddedSource) {
    musicEmbed.replaceChildren(...(embed ? [MediaEmbeds.surface(embed, state.song || 'Música do perfil', { thumbnail: safeUrl(state.album, true),...(embed.provider==='youtube'?{onPlayerFrame:attachYouTube}:{}) })] : []));
    embeddedSource = embedSource;
  }
  musicEmbed.hidden = !embed;
  $('music').classList.toggle('external-player', !!embed);
  $('music').dataset.provider = embed?.provider || '';
  const source = localAudio || (embed ? '' : safeUrl(state.musicUrl));
  if (source !== loadedSource) {
    ampStopped=false;
    ampAudioPlaying=false;
    audio.pause();
    if (source) audio.src = source;
    else audio.removeAttribute("src");
    loadedSource = source;
    audio.load();
  }
  $("playerNote").textContent =
    !embed && !source && state.song && state.song !== defaults.song
      ? "Selecione o arquivo de áudio novamente para tocar."
      : "";
  window.dispatchEvent(new Event('myspace-profile-change'));
  updateAmp();
}
function openEditor(section) {
  editVersion++;
  pending = {};
  musicTask = Promise.resolve();
  imageTasks = [];
  $("removeAlbum").checked = false;
  $("coverStatus").textContent =
    "MP3 e FLAC: lê título, artista e capa quando estiverem no arquivo.";
  $("formError").textContent = "";
  for (const key of Object.keys(defaults)) {
    const field = form.elements.namedItem(key);
    if (field) field.value = state[key];
  }
  for (const id of ["avatarFile", "bannerFile", "musicFile", "albumFile"])
    $(id).value = "";
  $("editor").showModal();
  if (section === "music")
    setTimeout(() => $("musicFields").scrollIntoView({ block: "center" }), 40);
}
for (const id of ["editTop", "editProfile", "editBanner"])
  $(id).onclick = () => openEditor();
$("addMusic").onclick = () => openEditor("music");
for (const id of ["closeEditor", "cancel"])
  $(id).onclick = () => $("editor").close();
function persist(next) {
  try {
    localStorage.setItem("myspace-profile-v1", JSON.stringify(next));
    return true;
  } catch {
    $("formError").textContent =
      "Não foi possível salvar. Tente imagens menores ou libere o armazenamento do navegador.";
    return false;
  }
}
async function resizeImage(file, max = 600, maxDataLength = Infinity) {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    const originalMax = Math.max(bitmap.width, bitmap.height);
    for (const target of [max, Math.round(max * 0.875), Math.round(max * 0.75), Math.round(max * 0.625)]) {
      const scale = Math.min(1, target / originalMax);
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.85, 0.76, 0.67]) {
        const result = canvas.toDataURL("image/jpeg", quality);
        if (result.length <= maxDataLength) return result;
      }
    }
    return "";
  } finally {
    bitmap.close();
  }
}
async function preparePartyAvatar(value, maxDataLength) {
  if (/^data:image\/gif;base64,/i.test(value)) return value.length <= maxDataLength ? value : "";
  const bitmap = await createImageBitmap(await (await fetch(value)).blob());
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const left = (bitmap.width - side) / 2;
    const top = (bitmap.height - side) / 2;
    const canvas = document.createElement("canvas");
    const sizes = [...new Set([512, 448, 384, 320].map(size => Math.min(size, side)))];
    for (const size of sizes) {
      canvas.width = canvas.height = size;
      const context = canvas.getContext("2d");
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(bitmap, left, top, side, side, 0, 0, size, size);
      const png = canvas.toDataURL("image/png");
      if (png.length <= maxDataLength) return png;
      for (const quality of [0.96, 0.94, 0.92]) {
        const webp = canvas.toDataURL("image/webp", quality);
        if (webp.startsWith("data:image/webp;") && webp.length <= maxDataLength) return webp;
      }
    }
    return "";
  } finally {
    bitmap.close();
  }
}
for (const [id, key] of [
  ["avatarFile", "avatar"],
  ["bannerFile", "banner"],
  ["albumFile", "album"],
])
  $(id).onchange = (e) => {
    const file = e.target.files[0],
      version = editVersion;
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      $("formError").textContent = "Escolha uma imagem de até 3 MB.";
      e.target.value = "";
      return;
    }
    const task = resizeImage(file, key === "banner" ? 1600 : 600)
      .then((url) => {
        if (version !== editVersion || e.target.files[0] !== file) return;
        pending[key] = url;
        if (key === "album") $("removeAlbum").checked = false;
        $("formError").textContent = "";
      })
      .catch(() => {
        if (version !== editVersion) return;
        $("formError").textContent =
          "Não consegui abrir essa imagem. Tente PNG, JPG ou WebP.";
        e.target.value = "";
      });
    imageTasks.push(task);
  };
$("musicFile").onchange = (e) => {
  const file = e.target.files[0],
    version = editVersion;
  if (!file) return;
  $("coverStatus").textContent = "Lendo informações do arquivo…";
  const song = form.elements.namedItem("song"),
    artist = form.elements.namedItem("artist");
  song.value = file.name.replace(/\.[^.]+$/, "");
  artist.value = "";
  const proposedTitle = song.value;
  musicTask = (async () => {
    let tags = {};
    try {
      tags = readAudioTags(await file.slice(0, 16 * 1024 * 1024).arrayBuffer());
    } catch {}
    if (version !== editVersion || $("musicFile").files[0] !== file) return;
    if (tags.title && song.value === proposedTitle) song.value = tags.title;
    if (tags.artist && !artist.value) artist.value = tags.artist;
    let cover = "";
    if (tags.picture) {
      try {
        cover = await resizeImage(
          new Blob([tags.picture.bytes], { type: tags.picture.mime }),
        );
      } catch {}
    }
    if (version !== editVersion || $("musicFile").files[0] !== file) return;
    if (!$("albumFile").files.length) pending.album = cover;
    $("coverStatus").textContent = cover
      ? "Capa encontrada no arquivo."
      : "Esse arquivo não contém uma capa legível. Você pode escolher uma imagem abaixo.";
  })();
};
const musicLink = form.elements.namedItem('musicUrl');
async function fillMusicMetadata() {
  const url = musicLink.value.trim();
  if (!MediaEmbeds.parse(url)) return;
  const version = editVersion;
  const song = form.elements.namedItem('song');
  const artist = form.elements.namedItem('artist');
  const originalSong = song.value;
  const originalArtist = artist.value;
  $('coverStatus').textContent = 'Buscando informações do link…';
  const info = await MediaEmbeds.metadata(url);
  if (version !== editVersion || musicLink.value.trim() !== url) return;
  if (!info) { $('coverStatus').textContent = 'Não consegui ler o link. Você pode preencher os dados ou tentar novamente.'; return; }
  const changed = url !== state.musicUrl;
  if (song.value === originalSong && ((changed && song.value === state.song) || !song.value || ['Sem título', defaults.song].includes(song.value))) song.value = info.title || song.value;
  if (artist.value === originalArtist && ((changed && artist.value === state.artist) || !artist.value)) artist.value = info.artist || '';
  if (info.thumbnail && !pending.album && !$('albumFile').files.length && !$('removeAlbum').checked && (changed || !state.album)) pending.album = info.thumbnail;
  $('coverStatus').textContent = info.artist ? 'Título, canal/artista e capa encontrados. Você pode ajustar os dados.' : 'Título e capa encontrados. O Spotify não fornece o artista nesta consulta; preencha se quiser.';
}
musicLink.onchange = () => { musicTask = fillMusicMetadata(); };
form.onsubmit = async (e) => {
  e.preventDefault();
  const version = editVersion,
    submit = form.querySelector("button[type=submit]");
  submit.disabled = true;
  try {
    await musicTask;
    if (MediaEmbeds.parse(musicLink.value.trim()) && musicLink.value.trim() !== state.musicUrl) await fillMusicMetadata();
    await Promise.all(imageTasks);
    if (version !== editVersion || !$("editor").open) return;
    const data = new FormData(form),
      next = { ...state, ...pending };
    for (const key of [
      "name",
      "location",
      "tagline",
      "mood",
      "bio",
      "interests",
      "wall",
      "theme",
      "song",
      "artist",
      "musicUrl",
    ])
      next[key] = String(data.get(key) || "").trim();
    if ($("removeAlbum").checked) next.album = "";
    if (!next.name) {
      $("formError").textContent = "Seu perfil precisa de um nome.";
      return;
    }
    if (next.musicUrl && !safeUrl(next.musicUrl)) {
      $("formError").textContent = "Use um link do Spotify, YouTube ou áudio com http ou https.";
      return;
    }
    if (next.musicUrl && /^(?:https?:\/\/)(?:open\.spotify\.com|(?:music\.|www\.)?youtube\.com|youtu\.be)(?:\/|$)/i.test(next.musicUrl) && !MediaEmbeds.parse(next.musicUrl)) {
      $('formError').textContent = 'Use um link de música, álbum, playlist ou vídeo válido.';
      return;
    }
    const file = $("musicFile").files[0];
    if (
      !file &&
      next.musicUrl !== state.musicUrl &&
      !("album" in pending) &&
      !$("removeAlbum").checked
    )
      next.album = "";
    if (!persist(next)) return;
    if (file) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(file);
      localAudio = objectUrl;
    } else if (next.musicUrl !== state.musicUrl) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = "";
      localAudio = "";
    }
    state = next;
    render();
    $("editor").close();
    toast("Perfil salvo.");
  } catch {
    $("formError").textContent =
      "Não foi possível carregar o arquivo. Tente novamente.";
  } finally {
    submit.disabled = false;
  }
};
$("albumImage").onerror = () => {
  $("albumImage").hidden = true;
  $("albumPlaceholder").hidden = false;
};
$("play").onclick = async () => {
  if (!loadedSource) {
    openEditor("music");
    return;
  }
  if (!audio.paused) {
    audio.pause();
    return;
  }
  try {
    await audio.play();
  } catch {
    toast("Não consegui tocar esse áudio. Tente outro link ou um arquivo.");
  }
};
$("stop").onclick = stopAmp;
$("repeat").onclick = () => {
  audio.loop = !audio.loop;
  $("repeat").setAttribute("aria-pressed", String(audio.loop));
};
$("volume").oninput = (e) => (audio.volume = Number(e.target.value));
$("seek").oninput = (e) => {
  if (Number.isFinite(audio.duration) && audio.duration > 0)
    audio.currentTime = (audio.duration * Number(e.target.value)) / 100;
};
const clock = (n) =>
  Number.isFinite(n)
    ? String(Math.floor(n / 60)).padStart(2, "0") +
      ":" +
      String(Math.floor(n % 60)).padStart(2, "0")
    : "00:00";
audio.onloadedmetadata = () => {
  $("duration").textContent = clock(audio.duration);
};
audio.ontimeupdate = () => {
  $("time").textContent = clock(audio.currentTime);
  $("seek").value = audio.duration
    ? (audio.currentTime / audio.duration) * 100
    : 0;
};
function playing() {
  const active = !audio.paused && !audio.ended;
  if(!active)ampAudioPlaying=false;
  $("play").textContent = active ? "Ⅱ" : "▶";
  $("play").setAttribute("aria-label", active ? "Pausar" : "Reproduzir");
  $("equalizer").classList.toggle("active", active);
  $('trackState').textContent=active?'TOCANDO':'FAIXA ATUAL';
  updateAmp();
}
audio.onplay = playing;
audio.onpause = playing;
audio.onended = playing;
audio.onerror = () => {
  ampStopped=true;
  ampAudioPlaying=false;
  updateAmp();
  if (loadedSource)
    $("playerNote").textContent =
      "Áudio indisponível. Escolha outro link ou arquivo.";
};
audio.addEventListener('playing',()=>{ampAudioPlaying=true;ampStopped=false;playing();});
audio.addEventListener('ended',()=>{ampStopped=true;updateAmp();});
audio.addEventListener('waiting',()=>{ampAudioPlaying=false;updateAmp();});
audio.addEventListener('emptied',()=>{ampAudioPlaying=false;playing();});
$("like").onclick = () => {
  const value = $("like").getAttribute("aria-pressed") !== "true";
  $("like").setAttribute("aria-pressed", String(value));
  $("likeLabel").textContent = value ? "curtido" : "curtir";
};
// Mantém os dados pessoais já salvos; substitui apenas o texto padrão antigo.
const oldBio =
  "Um pouco de música, umas ideias aleatórias e uma saudade de uma internet que eu nem sei se existiu desse jeito. Aqui eu posso ser eu, sem muito filtro.";
const oldWall =
  "Saudades de quando trocar a música do perfil era um evento. Resolvi criar um espaço só meu de novo. Seja bem-vindo :)";
if (state.bio === oldBio) state.bio = "Ainda não escrevi nada aqui.";
if (state.wall === oldWall) state.wall = "Sem novidades por enquanto.";
if (state.song === "Sua música, seu universo") state.song = defaults.song;
if (state.artist === "adicione um MP3 para começar") state.artist = "";
render();
if (document.modelContext?.registerTool) {
  try {
    Promise.resolve(
      document.modelContext.registerTool({
        name: "update_profile",
        title: "Editar perfil",
        description:
          "Salva os dados de texto do perfil neste navegador e atualiza a página.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", maxLength: 40 },
            bio: { type: "string", maxLength: 1200 },
            mood: { type: "string", maxLength: 40 },
            theme: { type: "string", enum: ["night", "terminal", "candy", "paper"] },
          },
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false },
        execute(input) {
          if (!input || typeof input !== "object" || Array.isArray(input))
            throw new Error("Dados inválidos");
          const limits = { name: 40, bio: 1200, mood: 40, theme: 20 };
          for (const [k, v] of Object.entries(input)) {
            if (
              !(k in limits) ||
              typeof v !== "string" ||
              v.length > limits[k] ||
              (k === "name" && !v.trim()) ||
              (k === "theme" && !["night", "terminal", "candy", "paper"].includes(v))
            )
              throw new Error("Campo inválido: " + k);
          }
          const next = { ...state, ...input };
          if (!persist(next)) throw new Error("Falha ao salvar");
          state = next;
          render();
          return { saved: true, name: state.name, theme: state.theme };
        },
      }),
    ).catch(() => {});
  } catch {}
}
