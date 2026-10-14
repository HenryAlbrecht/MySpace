/* Validate imported profile/extras/preferences without writing storage or capturing media. */
function validateProfileBackup(
  payload,
  { emptyData, normalizeSectionOrder, validateItem, kinds, defaults, safeUrl },
) {
  if (
    payload.format !== "myspace-backup" ||
    payload.version !== 1 ||
    !payload.profile ||
    !payload.extras
  )
    throw Error("Esse arquivo não é um backup do perfil.");
  const next = emptyData();
  const titlePreferences =
    payload.titlePreferences === undefined
      ? null
      : TitlePreferences.validate(payload.titlePreferences);
  for (const key of ["items", "favorites", "badges", "photos", "blocks"]) {
    if (!Array.isArray(payload.extras[key]) || payload.extras[key].length > 500)
      throw Error("Backup inválido.");
    next[key] = payload.extras[key];
    for (const item of next[key]) {
      if (!item || typeof item !== "object" || typeof item.id !== "string")
        throw Error("Item inválido no backup.");
      for (const [field, v] of Object.entries(item))
        if (
          typeof v === "object" &&
          v !== null &&
          !(
            (["playbackSource", "metadataSources"].includes(field) &&
              item.kind === "music" &&
              !Array.isArray(v) &&
              JSON.stringify(v).length <= 14000) ||
            (field === "xmbArt" &&
              key === "items" &&
              item.kind === "game" &&
              !Array.isArray(v) &&
              Object.entries(v).every(([slot, value]) =>
                ["bubble", "image", "background"].includes(slot)
                  ? typeof value === "string" &&
                    value.length <= 8 * 1024 * 1024 &&
                    /^(https?:\/\/|data:image\/|\/|xmb-art:|appearance-art:)/i.test(value)
                  : ["focusAudio", "idleVideo"].includes(slot)
                    ? typeof value === "string" &&
                      value.length <= 8 * 1024 * 1024 &&
                      /^(https?:\/\/|\/|xmb-art:|appearance-art:)/i.test(value)
                    : slot === "screenshots"
                      ? Array.isArray(value) &&
                        value.length <= 24 &&
                        value.every(
                          (source) =>
                            typeof source === "string" &&
                            source.length <= 8 * 1024 * 1024 &&
                            /^(https?:\/\/|\/|xmb-art:|appearance-art:)/i.test(source),
                        )
                      : ["focusAudioEnabled", "idleVideoMuted", "backgroundVideo"].includes(slot)
                        ? typeof value === "boolean"
                        : ["x", "y"].includes(slot) &&
                          Number.isFinite(value) &&
                          value >= -1 &&
                          value <= 1,
              )) ||
            ([
              "lists",
              "genres",
              "platforms",
              "developers",
              "publishers",
              "screenshots",
              "categories",
              "dlcIds",
              "relatedIds",
              "packages",
              "studios",
              "synonyms",
              "relationIds",
              "relationTitles",
              "relationImages",
              "relationKinds",
              "relationTypes",
              "subjectPlaces",
              "subjectPeople",
              "subjectTimes",
              "characterNames",
              "characterImages",
              "characterUrls",
              "characterRoles",
              "recommendationIds",
              "recommendationTitles",
              "recommendationImages",
              "recommendationKinds",
              "trackNames",
              "artworks",
              "artworkLabels",
              "videoIds",
              "videoTitles",
              "localizedCoverImages",
              "localizedCoverLabels",
              "relatedGameIds",
              "relatedGameTitles",
              "relatedGameImages",
              "relatedGameTypes",
              "relatedGameYears",
            ].includes(field) &&
              Array.isArray(v) &&
              v.length <= 100 &&
              v.every((entry) => typeof entry === "string"))
          )
        )
          throw Error("Item inválido no backup.");
    }
  }
  for (const key of ["favorites", "badges"])
    for (const item of next[key])
      if (typeof item.name !== "string" || !item.name.trim())
        throw Error("Nome inválido no backup.");
  for (const item of next.blocks)
    if (typeof item.title !== "string" || !item.title.trim())
      throw Error("Título inválido no backup.");
  for (const item of next.photos)
    if (typeof item.image !== "string" || !safeUrl(item.image, true))
      throw Error("Foto inválida no backup.");
  for (const key of ["items", "favorites", "badges", "photos", "blocks"]) {
    if (new Set(next[key].map((i) => i.id)).size !== next[key].length)
      throw Error("IDs repetidos no backup.");
    for (const item of next[key])
      for (const field of [
        "image",
        "caption",
        "url",
        "text",
        "linkText",
        "artist",
        "album",
        "fileName",
      ])
        if (item[field] !== undefined && typeof item[field] !== "string")
          throw Error("Campo inválido no backup.");
  }
  next.items = next.items.map(validateItem);
  const normalizeMusicRows = (rows) => {
    if (!Array.isArray(rows) || rows.length > 500) throw Error("Faixas inválidas no backup.");
    return rows.map((row) => {
      if (!row || typeof row !== "object" || typeof row.id !== "string" || !row.id ||
          typeof row.title !== "string" || !row.title.trim() || row.title.length > 300)
        throw Error("Faixa inválida no backup.");
      const track = { ...row, kind: "music", title: row.title.slice(0, 300) };
      if (track.playbackSource) {
        track.playbackSource = MusicModel.source(track.playbackSource);
        if (!track.playbackSource) throw Error("Fonte musical inválida no backup.");
      }
      if (track.metadataSources) track.metadataSources = MusicModel.references(track);
      for (const field of ["artist", "albumTitle", "image", "album", "fileName", "url"])
        if (track[field] !== undefined && typeof track[field] !== "string")
          throw Error("Metadado musical inválido no backup.");
      return track;
    });
  };
  const importedPlaylists = payload.extras.playlists;
  if (importedPlaylists !== undefined &&
      (!Array.isArray(importedPlaylists) || importedPlaylists.length > 100))
    throw Error("Playlists inválidas no backup.");
  const normalizePlaylistCover = (cover) => {
    if (cover === undefined) return { mode: "auto" };
    if (!cover || typeof cover !== "object" || Array.isArray(cover))
      throw Error("Capa de playlist inválida no backup.");
    if (cover.mode === "auto") return { mode: "auto" };
    if (cover.mode === "custom") {
      if (
        typeof cover.reference !== "string" ||
        cover.reference.length > 150 ||
        !window.XmbArtworkStorage?.isReference(cover.reference)
      )
        throw Error("Referência da capa personalizada inválida no backup.");
      return { mode: "custom", reference: cover.reference };
    }
    if (cover.mode === "track") {
      if (
        typeof cover.trackId !== "string" ||
        !cover.trackId ||
        cover.trackId.length > 150 ||
        (cover.catalogId !== undefined &&
          (typeof cover.catalogId !== "string" || cover.catalogId.length > 150)) ||
        (cover.image !== undefined &&
          (typeof cover.image !== "string" || cover.image.length > 4096))
      )
        throw Error("Artwork escolhida para playlist inválida no backup.");
      const image = cover.image || "";
      if (image && !window.XmbArtworkStorage?.isReference(image) && !safeUrl(image))
        throw Error("URL da artwork da playlist inválida no backup.");
      return {
        mode: "track",
        trackId: cover.trackId,
        ...(cover.catalogId ? { catalogId: cover.catalogId } : {}),
        image: window.XmbArtworkStorage?.isReference(image) ? image : safeUrl(image) || "",
      };
    }
    throw Error("Modo de capa de playlist inválido no backup.");
  };
  next.playlists = (importedPlaylists || []).map((playlist) => {
    if (!playlist || typeof playlist.id !== "string" || !playlist.id ||
        typeof playlist.name !== "string" || !playlist.name.trim() || playlist.name.length > 120)
      throw Error("Playlist inválida no backup.");
    return {
      id: playlist.id.slice(0, 150),
      name: playlist.name.trim().slice(0, 120),
      tracks: normalizeMusicRows(playlist.tracks || []),
      cover: normalizePlaylistCover(playlist.cover),
      ...(Number.isFinite(playlist.createdAt) ? { createdAt: playlist.createdAt } : {}),
    };
  });
  if (new Set(next.playlists.map((playlist) => playlist.id)).size !== next.playlists.length)
    throw Error("IDs de playlists repetidos no backup.");
  const profile = { ...defaults };
  for (const key of Object.keys(defaults))
    if (typeof payload.profile[key] === "string") profile[key] = payload.profile[key];
  next.featuredMusic = payload.extras.featuredMusic
    ? normalizeMusicRows([payload.extras.featuredMusic])[0]
    : null;
  if (payload.extras.history !== undefined) {
    if (!Array.isArray(payload.extras.history) || payload.extras.history.length > 100)
      throw Error("Histórico inválido.");
    next.history = payload.extras.history.map((row) => {
      if (
        !row ||
        typeof row.title !== "string" ||
        typeof row.id !== "string" ||
        !Number.isFinite(row.at) ||
        !Array.isArray(row.fields) ||
        row.fields.some((value) => typeof value !== "string")
      )
        throw Error("Histórico inválido.");
      const snapshot = (value) =>
        value && typeof value === "object"
          ? {
              status: String(value.status || "").slice(0, 30),
              score: typeof value.score === "number" ? value.score : null,
              progress: typeof value.progress === "number" ? value.progress : 0,
            }
          : null;
      return {
        title: row.title.slice(0, 120),
        id: row.id.slice(0, 150),
        at: row.at,
        fields: row.fields.slice(0, 20).map((value) => value.slice(0, 40)),
        before: snapshot(row.before),
        after: snapshot(row.after),
      };
    });
  }
  if (next.favorites.length > 8) throw Error("O top 8 tem itens demais.");
  if (
    payload.extras.appearance &&
    (typeof payload.extras.appearance !== "object" || Array.isArray(payload.extras.appearance))
  )
    throw Error("Aparência inválida no backup.");
  const importedVideo = payload.extras.featuredVideo;
  if (
    importedVideo?.url &&
    MediaEmbeds.parse(importedVideo.url)?.provider !== "youtube" &&
    !MediaEmbeds.directVideo(importedVideo.url)
  )
    throw Error("Vídeo inválido no backup.");
  if (
    importedVideo?.localId &&
    (typeof importedVideo.localId !== "string" ||
      !/^featured-video:[a-zA-Z0-9-]{1,100}$/.test(importedVideo.localId))
  )
    throw Error("Vídeo local inválido no backup.");
  next.featuredVideo = {
    localId: importedVideo?.localId || "",
    fileName: typeof importedVideo?.fileName === "string" ? importedVideo.fileName : "",
    thumbnail: safeUrl(importedVideo?.thumbnail) || "",
    url: importedVideo?.url || "",
    title: typeof importedVideo?.title === "string" ? importedVideo.title.slice(0, 120) : "",
  };
  next.appearance = payload.extras.appearance || {};
  next.sectionOrder = normalizeSectionOrder(payload.extras.sectionOrder);
  next.favoriteKind = Object.hasOwn(kinds, payload.extras.favoriteKind)
    ? payload.extras.favoriteKind
    : "all";
  next.visibility = {};
  for (const k of [
    "about",
    "music",
    "wall",
    "mood",
    "interests",
    "favorites",
    "badges",
    "blocks",
    "featured",
    "video",
  ])
    if (typeof payload.extras.visibility?.[k] === "boolean")
      next.visibility[k] = payload.extras.visibility[k];
  return { next, profile, titlePreferences };
}
