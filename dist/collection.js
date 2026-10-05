/* Regras da coleção, compartilhadas pela página e pelos testes. */
(function (root) {
  const kinds = {
    game: "Jogos",
    anime: "Animes",
    manga: "Mangás",
    book: "Livros",
    film: "Filmes",
    series: "Séries",
    music: "Músicas",
    album: "Álbuns",
    artist: "Artistas",
    other: "Outros",
  };
  const statuses = {
    planned: "Na fila",
    active: "Em andamento",
    done: "Concluído",
    paused: "Pausado",
    dropped: "Abandonado",
  };
  function validateItem(data) {
    if (!data || typeof data !== "object") throw Error("Item inválido.");
    data = { ...data };
    if(data.kind==='music')data=(root.MusicModel||(typeof require==='function'?require('./music-model.js'):null)).library(data);
    for (const field of ['topTracks','topAlbums','similarArtists','relatedArtists','albumTracks']) delete data[field];
    const title = String(data.title || "").trim();
    if (!title || title.length > 120)
      throw Error("Informe um título de até 120 caracteres.");
    if (
      !Object.hasOwn(kinds, data.kind) ||
      !Object.hasOwn(statuses, data.status)
    )
      throw Error("Tipo ou status inválido.");
    const progress = Number(data.progress || 0),
      total = Number(data.total || 0),
      score =
        data.score === "" || data.score == null ? null : Number(data.score);
    if (
      !Number.isFinite(progress) ||
      !Number.isFinite(total) ||
      progress < 0 ||
      total < 0 ||
      progress > 100000 ||
      total > 100000 ||
      (total > 0 && progress > total)
    )
      throw Error("O progresso deve estar entre zero e o total.");
    if (score !== null && (!Number.isFinite(score) || score < 0 || score > 10))
      throw Error("A nota deve estar entre 0 e 10.");
    const dates = {};
    for (const field of ['startedAt', 'finishedAt']) {
      const value = String(data[field] || '');
      if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value)) throw Error('Informe uma data válida.');
      dates[field] = value;
    }
    if (dates.startedAt && dates.finishedAt && dates.finishedAt < dates.startedAt) throw Error('A conclusão deve ser posterior ao início.');
    return {
      ...data,
      ...dates,
      title,
      progress,
      total,
      score,
      featured: data.featured === true,
      coverLayout: data.coverLayout === "horizontal" ? "horizontal" : "vertical",
      platform: String(data.platform || "").slice(0, 80),
      notes: String(data.notes || "").slice(0, 2000),
      lists: [...new Set((Array.isArray(data.lists) ? data.lists : String(data.lists || '').split(',')).map(value => String(value).trim()).filter(Boolean))].slice(0,20).map(value => value.slice(0,60)),
      unit: String(data.unit || "").slice(0, 25),
    };
  }
  function filterItems(
    items,
    { kind = "all", status = "all", query = "", sort = "recent", featured = false, genre = '', platform = '', year = '', list = '' } = {},
  ) {
    const q = query
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    return items
      .filter(
        (i) =>
          (kind === "all" || i.kind === kind) &&
          (status === "all" || i.status === status) &&
          (!featured || i.featured) &&
          (!genre || i.genres?.includes(genre)) &&
          (!platform || i.platform === platform || i.platforms?.includes(platform)) &&
          (!year || String(i.releaseDate || i.year || i.seasonYear || '').slice(0,4) === year) &&
          (!list || i.lists?.includes(list)) &&
          (!q ||
            [i.title, i.platform, i.artist, i.description, i.notes].filter(Boolean).join(' ')
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .toLowerCase()
              .includes(q)),
      )
      .sort((a, b) =>
        sort === "title"
          ? a.title.localeCompare(b.title, "pt-BR")
          : sort === "score"
            ? (b.score ?? -1) - (a.score ?? -1)
            : Number(b.updated || 0) - Number(a.updated || 0),
      );
  }
  root.Collection = { kinds, statuses, validateItem, filterItems };
  if (typeof module !== "undefined") module.exports = root.Collection;
})(typeof window === "undefined" ? globalThis : window);
