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
  for (const key of ["items", "favorites", "badges", "photos", "blocks", "tracks"]) {
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
              (key === "tracks" || item.kind === "music") &&
              !Array.isArray(v) &&
              JSON.stringify(v).length <= 14000) ||
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
  for (const track of next.tracks) {
    if (track.playbackSource) track.playbackSource = MusicModel.source(track.playbackSource);
    if (track.metadataSources) track.metadataSources = MusicModel.references(track);
  }
  for (const key of ["favorites", "badges"])
    for (const item of next[key])
      if (typeof item.name !== "string" || !item.name.trim())
        throw Error("Nome inválido no backup.");
  for (const key of ["blocks", "tracks"])
    for (const item of next[key])
      if (typeof item.title !== "string" || !item.title.trim())
        throw Error("Título inválido no backup.");
  for (const item of next.photos)
    if (typeof item.image !== "string" || !safeUrl(item.image, true))
      throw Error("Foto inválida no backup.");
  for (const key of ["items", "favorites", "badges", "photos", "blocks", "tracks"]) {
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
  for (const k of ["activeTrack", "startTrack"])
    next[k] = next.tracks.some((t) => t.id === payload.extras[k])
      ? payload.extras[k]
      : next.tracks[0]?.id || "";
  const profile = { ...defaults };
  for (const key of Object.keys(defaults))
    if (typeof payload.profile[key] === "string") profile[key] = payload.profile[key];
  return { next, profile, titlePreferences };
}
