(function (root) {
  const names = {
    anime: "AniList",
    manga: "AniList",
    book: "Open Library",
    game: "Steam",
    film: "Wikipedia",
    series: "TVmaze",
    music: "iTunes", album: "iTunes", artist: "iTunes",
    other: "Wikipedia",
  };
  const http = (url) => {
    try {
      const u = new URL(url);
      return u.protocol === "https:" ? u.href : "";
    } catch {
      return "";
    }
  };
  function request(kind, query, wikipediaOnly = false, provider = "steam") {
    const q = String(query || "")
      .trim()
      .slice(0, 120);
    if (q.length < 2) throw Error("Digite pelo menos 2 caracteres.");
    if (['music', 'album', 'artist'].includes(kind)) return '/api/music/search?' + new URLSearchParams({ kind, q });
    if (!wikipediaOnly && kind === "game")
      return "/api/" + (provider === "igdb" ? "igdb" : "steam") + "/search?" + new URLSearchParams({ q });
    if (!wikipediaOnly && (kind === "anime" || kind === "manga"))
      return "https://graphql.anilist.co";
    if (!wikipediaOnly && kind === "series")
      return "https://api.tvmaze.com/search/shows?" + new URLSearchParams({ q });
    if (!wikipediaOnly && kind === "book")
      return (
        "https://openlibrary.org/search.json?" +
        new URLSearchParams({
          q,
          limit: "8",
          fields:
            "key,title,author_name,first_publish_year,cover_i,number_of_pages_median",
        })
      );
    const suffix =
      {
        game: "video game",
        anime: "anime",
        manga: "manga",
        film: "film",
        series: "television series",
        book: "book",
        other: "",
      }[kind] || "";
    return (
      "https://en.wikipedia.org/w/api.php?" +
      new URLSearchParams({
        action: "query",
        format: "json",
        formatversion: "2",
        origin: "*",
        generator: "search",
        gsrsearch: q + " " + suffix,
        gsrlimit: "8",
        gsrnamespace: "0",
        prop: "pageimages|pageterms|info",
        piprop: "thumbnail",
        pithumbsize: "500",
        pilicense: "any",
        wbptterms: "description",
        inprop: "url",
      })
    );
  }
  function normalize(kind, payload, wikipediaOnly = false, provider = "steam") {
    let items = [];
    if (!wikipediaOnly && kind === "game" && provider === "igdb")
      items = (payload.items || []).map(i => ({ ...i, source: "IGDB" }));
    else if (['music','album','artist'].includes(kind)) items = payload.items || [];
    else if (!wikipediaOnly && kind === "game")
      items = (payload.items || []).filter(i => Number.isSafeInteger(i.id) && i.id > 0).map(i => ({
        catalogId: "steam:" + i.id,
        title: i.name || "",
        image: "https://cdn.akamai.steamstatic.com/steam/apps/" + i.id + "/library_600x900.jpg",
        imageFallback: http(i.tiny_image),
        verticalImage: "https://cdn.akamai.steamstatic.com/steam/apps/" + i.id + "/library_600x900.jpg",
        horizontalImage: http(i.tiny_image),
        url: "https://store.steampowered.com/app/" + i.id + "/",
        description: "Steam",
        total: 0,
        unit: "horas",
      }));
    else if (!wikipediaOnly && (kind === "anime" || kind === "manga"))
      items = (payload.data?.Page?.media || []).map((i) => ({
        catalogId: "anilist:" + i.id,
        title: i.title?.english || i.title?.romaji || i.title?.native || "",
        image: http(i.coverImage?.extraLarge || i.coverImage?.large),
        url: http(i.siteUrl),
        summary: i.description || "",
        genres: i.genres || [],
        description: [i.format?.replaceAll("_", " "), i.seasonYear]
          .filter(Boolean)
          .join(" · "),
        total:
          kind === "anime" ? Number(i.episodes) || 0 : Number(i.chapters) || 0,
        unit: kind === "anime" ? "episódios" : "capítulos",
      }));
    else if (!wikipediaOnly && kind === "series")
      items = (Array.isArray(payload) ? payload : []).slice(0, 8).map(({ show: i }) => ({
        catalogId: "tvmaze:" + i.id,
        title: i.name || "",
        image: http(i.image?.original || i.image?.medium),
        url: http(i.url),
        summary: i.summary || "",
        genres: i.genres || [],
        description: [i.type, i.premiered?.slice(0, 4)].filter(Boolean).join(" · "),
        total: 0,
        unit: "episódios",
      }));
    else if (!wikipediaOnly && kind === "book")
      items = (payload.docs || []).map((i) => ({
        catalogId: "ol:" + i.key,
        title: i.title || "",
        image: i.cover_i
          ? "https://covers.openlibrary.org/b/id/" +
            Number(i.cover_i) +
            "-L.jpg"
          : "",
        url: i.key ? "https://openlibrary.org" + i.key : "",
        description: [
          ...(i.author_name || []).slice(0, 2),
          i.first_publish_year,
        ]
          .filter(Boolean)
          .join(" · "),
        total: Number(i.number_of_pages_median) || 0,
        unit: "páginas",
      }));
    else
      items = (payload.query?.pages || [])
        .slice()
        .sort((a, b) => (a.index || 0) - (b.index || 0))
        .map((i) => ({
          catalogId: "wiki:" + i.pageid,
          title: i.title || "",
          image: http(i.thumbnail?.source),
          url: http(i.fullurl),
          description: (i.terms?.description || [])[0] || "",
          total: 0,
          unit:
            kind === "game"
              ? "horas"
              : kind === "anime"
                ? "episódios"
                : kind === "manga"
                  ? "capítulos"
                  : kind === "series"
                    ? "episódios"
                  : "itens",
        }));
    return items
      .filter((i) => i.title)
      .map((i) => ({
        ...i,
        title: i.title.slice(0, 120),
        description: String(i.description).slice(0, 180),
        source: wikipediaOnly ? "Wikipedia" : i.source || names[kind] || "Wikipedia",
        kind,
      }));
  }
  const cache = new Map();
  const searchTimes = new Map();
  function requireLocalServer() {
    if (root.location?.protocol === "file:")
      throw Error("Para usar os catálogos locais, abra iniciar.cmd. Se já tiver dados neste HTML, exporte um backup aqui e importe no site local.");
  }
  async function search(
    kind,
    query,
    { signal, fetcher = root.fetch?.bind(root), provider = "steam", context = '' } = {},
  ) {
    if (kind === "artist" && context === "song") {
      const tracks = await search("music", query, { signal, fetcher, provider });
      const seen = new Set();
      const artists = tracks
        .filter(
          (track) =>
            track.artistCatalogId && !seen.has(track.artistCatalogId) && seen.add(track.artistCatalogId),
        )
        .map((track) => ({
          kind: "artist",
          catalogId: track.artistCatalogId,
          title: track.artist,
          artist: track.artist,
          source: track.source,
          description: "Artista de " + track.title,
          url: track.artistCatalogId.startsWith("itunes:")
            ? "https://music.apple.com/artist/" + track.artistCatalogId.split(":")[1]
            : "https://www.deezer.com/artist/" + track.artistCatalogId.split(":")[1],
          image: "",
          knownTrack: track.title,
        }));
      const selected = artists.slice(0, 8);
      let next = 0;
      await Promise.all(
        Array.from({ length: Math.min(3, selected.length) }, async () => {
          while (next < selected.length) {
            const row = selected[next++];
            try {
              const response = await fetcher(
                "/api/music/artist-photo?" +
                  new URLSearchParams({ name: row.title, catalogId: row.catalogId }),
                { signal },
              );
              if (response.ok) {
                const photo = await response.json();
                row.image = http(photo.image);
                row.artworkSource = row.image ? "Deezer" : "";
              }
            } catch (error) {
              if (signal?.aborted) throw error;
            }
          }
        }),
      );
      return selected;
    }
    if (kind === 'book' && context === 'author') query = 'author:' + String(query).trim();
    const url = request(kind, query, false, provider);
    if (["game", "music", "album", "artist"].includes(kind)) requireLocalServer();
    const key = kind + ":" + provider + ":" + String(query).trim().slice(0, 120).toLowerCase();
    if (cache.has(key) && Date.now()-(searchTimes.get(key)||0)<300000) return cache.get(key);
    const options = {
      signal,
      credentials: "omit",
      headers: { Accept: "application/json" },
    };
    let response;
    let wikipediaOnly = false;
    const hasAlternative = ["anime", "manga", "book", "series"].includes(kind);
    const primaryOptions = kind === "anime" || kind === "manga" ? {
      ...options,
      method: "POST",
      headers: { ...options.headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query ($search: String, $type: MediaType) {
          Page(perPage: 8) {
            media(search: $search, type: $type, isAdult: false) {
              id title { english romaji native } coverImage { extraLarge large }
              siteUrl format seasonYear episodes chapters description genres
            }
          }
        }`,
        variables: { search: String(query).trim().slice(0, 120), type: kind.toUpperCase() },
      }),
    } : options;
    try {
      response = await fetcher(url, primaryOptions);
    } catch (error) {
      if (signal?.aborted || error.name === "AbortError") throw error;
      if (kind === "game") throw Error("Não consegui conectar à busca Steam. Abra iniciar.cmd e mantenha a janela aberta.");
      if (!hasAlternative)
        throw error;
      wikipediaOnly = true;
    }
    if (
      hasAlternative &&
      (wikipediaOnly || response.status >= 500 || response.status === 429)
    ) {
      wikipediaOnly = true;
      response = await fetcher(request(kind, query, true), options);
    }
    if (!response.ok) {
      if (kind === "game") {
        let message;
        try { message = (await response.json()).error; } catch { /* Resposta sem JSON. */ }
        throw Error(message || "A busca Steam está indisponível. Tente novamente.");
      }
      if (response.status === 429)
        throw Error(
          "O catálogo está ocupado. Aguarde alguns segundos e tente novamente.",
        );
      throw Error(
        "Não consegui consultar o catálogo agora. Você pode adicionar manualmente.",
      );
    }
    const payload = await response.json();
    if (payload.errors?.length)
      throw Error("O catálogo não conseguiu completar a busca. Tente novamente ou adicione manualmente.");
    const normalized = normalize(kind, payload, wikipediaOnly, provider);
    if (kind === 'game') for (const row of normalized) if (row.gameType) row.description = [row.gameType, row.description].filter(Boolean).join(' · ');
    const clean = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
    const needle = clean(query), seen = new Set();
    const music = ['music', 'album', 'artist'].includes(kind);
    const exactArtist = value => String(value || '').normalize('NFC').toLowerCase().trim();
    const accentSensitive = /\p{M}/u.test(String(query).normalize('NFD'));
    const relevance = row => kind === 'artist' && accentSensitive && exactArtist(row.title) === exactArtist(query) ? 6 : clean(row.title) === needle ? 5 : music && clean(row.artist) === needle ? 4 : kind === 'game' && /Jogo base|Remake|Remaster/.test(row.gameType || '') ? 3 : clean(row.title).startsWith(needle) ? 2 : 1;
    const results = (music ? normalized.slice() : normalized.slice().sort((a,b) => relevance(b) - relevance(a))).filter(row => {
      const identity = kind === 'artist' ? row.catalogId || exactArtist(row.title) : music ? clean(row.title) + ':' + clean(row.artist) : row.catalogId;
      if (!identity) return true;
      if (seen.has(identity)) return false; seen.add(identity); return true;
    });
    if (cache.size > 30) {cache.clear();searchTimes.clear();}
    if(results.length){cache.set(key, results);searchTimes.set(key,Date.now());}
    return results;
  }
  const detailCache = new Map();
  const detailTimes = new Map(), detailLifetime = 15 * 60 * 1000;
  try {
    const rows = JSON.parse(root.sessionStorage?.getItem('myspace-catalog-session') || '[]');
    if (Array.isArray(rows)) for (const row of rows.slice(-10)) if (typeof row.key === 'string' && row.value && row.value.kind && row.value.catalogId && row.key === row.value.kind+':'+row.value.catalogId && Date.now()-row.at < detailLifetime && !(row.value.kind === 'artist' && row.value.catalogId.startsWith('itunes:') && row.value.topAlbums?.some(album => !album.albumType))) { detailCache.set(row.key,row.value);detailTimes.set(row.key,row.at); }
  } catch {}
  const needsIsrcLookup = item => item.kind === 'music' && !item.isrc && item.isrcLookupVersion !== 4;
  async function details(item, { signal, fetcher = root.fetch?.bind(root), force = false } = {}) {
    const id = String(item.catalogId || "");
    if (['music','album','artist'].includes(item.kind) && id && !/^itunes:[1-9]\d{0,15}$/.test(id)) return item;
    if (!id) return item;
    const key = item.kind + ":" + id;
    if (!force && detailCache.has(key) && !needsIsrcLookup(detailCache.get(key)) && Date.now()-(detailTimes.get(key) || 0)<detailLifetime) return { ...item, ...detailCache.get(key) };
    let url, options = { signal, credentials: "omit", headers: { Accept: "application/json" } };
    if (/^itunes:[1-9]\d{0,15}$/.test(id) && ['music','album','artist'].includes(item.kind)) {
      requireLocalServer(); url = '/api/music/' + item.kind + '/' + id.split(':')[1];
    } else if (/^igdb:[1-9]\d{0,9}$/.test(id)) {
      requireLocalServer();
      url = "/api/igdb/games/" + id.split(":")[1];
    } else if (/^steam:[1-9]\d{0,9}$/.test(id)) {
      requireLocalServer();
      url = "/api/steam/games/" + id.split(":")[1];
    } else if (/^anilist:\d+$/.test(id)) {
      url = "https://graphql.anilist.co";
      options = { ...options, method: "POST", headers: { ...options.headers, "Content-Type": "application/json" }, body: JSON.stringify({
        query: `query ($id: Int) { Media(id: $id) {
          id title { english romaji native } coverImage { extraLarge large }
          siteUrl format seasonYear episodes chapters volumes duration description genres
          status averageScore source synonyms countryOfOrigin
          startDate { year month day } endDate { year month day }
          bannerImage
          characters(perPage: 12, sort: [ROLE, RELEVANCE, ID]) { edges { role node { name { full } image { large } siteUrl } } }
          recommendations(perPage: 12, sort: RATING_DESC) { nodes { mediaRecommendation { id type isAdult title { english romaji native } coverImage { large } } } }
          studios(isMain: true) { nodes { name } }
          relations { edges { relationType node { id type title { english romaji native } coverImage { large } } } }
        } }`,
        variables: { id: Number(id.split(":")[1]) },
      }) };
    } else if (/^wiki:\d+$/.test(id)) {
      url = "https://en.wikipedia.org/w/api.php?" + new URLSearchParams({
        action: "query", format: "json", formatversion: "2", origin: "*",
        pageids: id.split(":")[1], prop: "extracts|pageimages|info|pageterms",
        explaintext: "1", piprop: "thumbnail", pithumbsize: "700",
        pilicense: "any", inprop: "url", wbptterms: "description",
      });
    } else if (/^ol:\/works\/OL\d+W$/.test(id)) {
      url = "https://openlibrary.org" + id.slice(3) + ".json";
    } else if (/^tvmaze:\d+$/.test(id)) {
      url = "https://api.tvmaze.com/shows/" + id.split(":")[1];
    } else return item;
    const response = await fetcher(url, options);
    if (!response.ok) throw Error("Não consegui carregar as informações agora.");
    const payload = await response.json();
    let result;
    if (id.startsWith('deezer:') || id.startsWith('lastfm-artist:') || id.startsWith('lastfm:') || id.startsWith('musicbrainz:') || id.startsWith('itunes:')) {
      if (payload.catalogId !== id || payload.kind !== item.kind) throw Error('Título musical inválido.');
      result = payload;
    } else if (id.startsWith("igdb:")) {
      if (payload.catalogId !== id) throw Error("Jogo não encontrado no IGDB.");
      result = { ...payload, source: "IGDB", kind: "game" };
    } else if (id.startsWith("steam:")) {
      if (String(payload.steam_appid) !== id.split(":")[1]) throw Error("Título não encontrado na Steam.");
      result = {
        catalogId: id, kind: "game", source: "Steam", title: payload.name || "",
        image: http(payload.cover_image || payload.header_image),
        imageFallback: http(payload.header_image),
        verticalImage: http(payload.vertical_image ?? payload.cover_image),
        horizontalImage: http(payload.horizontal_image || payload.header_image),
        coverLayout: payload.vertical_image === "" ? "horizontal" : "vertical",
        url: "https://store.steampowered.com/app/" + payload.steam_appid + "/",
        summary: payload.detailed_description || payload.short_description || '',
        bannerImage: http(payload.banner_image),
        shortSummary: payload.short_description || '',
        languages: payload.supported_languages || '',
        metacriticScore: Number.isFinite(payload.metacritic?.score) ? payload.metacritic.score : null,
        metacriticUrl: http(payload.metacritic?.url),
        drm: payload.drm_notice || '',
        dlcIds: (payload.dlc || []).map(String),
        relatedIds: payload.related_ids || [],
        packages: payload.package_names || [],
        screenshots: (payload.screenshots || []).map(http).filter(Boolean),
        categories: payload.categories || [],
        requirementsMinimum: payload.pc_requirements?.minimum || '',
        requirementsRecommended: payload.pc_requirements?.recommended || '',
        developers: payload.developers || [], publishers: payload.publishers || [],
        website: http(payload.website),
        description: [payload.release_date?.date, ...(payload.developers || [])].filter(Boolean).join(" · "),
        genres: (payload.genres || []).map(i => i.description).filter(Boolean),
        platforms: Object.entries(payload.platforms || {}).filter(([, available]) => available).map(([name]) => ({ windows: "Windows", mac: "macOS", linux: "Linux" })[name] || name),
        total: 0, unit: "horas",
      };
    } else if (id.startsWith("anilist:")) {
      if (!payload.data?.Media) throw Error("Título não encontrado no catálogo.");
      const media = payload.data.Media;
      const date = value => value?.year ? [value.year, value.month, value.day].filter(Boolean).join('/') : '';
      const characters = (media.characters?.edges || []).filter(edge => edge.node?.name?.full).slice(0, 12);
      const recommendations = (media.recommendations?.nodes || []).map(row => row.mediaRecommendation).filter(row => row?.id && !row.isAdult && row.id !== media.id).slice(0, 12);
      const relations = (media.relations?.edges || []).filter(edge => edge.node?.id && ['ANIME', 'MANGA'].includes(edge.node.type)).slice(0, 12);
      result = { ...normalize(item.kind, { data: { Page: { media: [media] } } })[0],
        bannerImage: http(media.bannerImage),
        characterNames: characters.map(edge => edge.node.name.full),
        characterImages: characters.map(edge => http(edge.node.image?.large)),
        characterUrls: characters.map(edge => http(edge.node.siteUrl)),
        characterRoles: characters.map(edge => edge.role || ''),
        recommendationIds: recommendations.map(row => 'anilist:' + row.id),
        recommendationTitles: recommendations.map(row => row.title?.english || row.title?.romaji || row.title?.native || ''),
        recommendationImages: recommendations.map(row => http(row.coverImage?.large)),
        recommendationKinds: recommendations.map(row => row.type === 'MANGA' ? 'manga' : 'anime'),
        catalogRating: Number.isFinite(media.averageScore) ? media.averageScore : null,
        mediaStatus: media.status || '', format: media.format || '',
        startDate: date(media.startDate), endDate: date(media.endDate),
        studios: (media.studios?.nodes || []).map(studio => studio.name),
        synonyms: media.synonyms || [], origin: media.countryOfOrigin || '',
        volumes: media.volumes || 0, episodeDuration: media.duration || 0,
        adaptationSource: media.source || '',
        relationIds: relations.map(edge => 'anilist:' + edge.node.id),
        relationTitles: relations.map(edge => edge.node.title?.english || edge.node.title?.romaji || edge.node.title?.native || ''),
        relationImages: relations.map(edge => http(edge.node.coverImage?.large)),
        relationKinds: relations.map(edge => edge.node.type === 'ANIME' ? 'anime' : 'manga'),
        relationTypes: relations.map(edge => edge.relationType || ''),
      };
    } else if (id.startsWith("wiki:")) {
      const page = payload.query?.pages?.[0];
      if (!page || page.missing) throw Error("Título não encontrado no catálogo.");
      result = { ...normalize(item.kind, payload, true)[0], summary: page.extract || "" };
    } else if (id.startsWith("tvmaze:")) {
      result = { ...normalize("series", [{ show: payload }])[0],
        catalogRating: payload.rating?.average ?? null, ratingScale: 10,
        mediaStatus: payload.status || '', languages: payload.language || '',
        startDate: payload.premiered || '', endDate: payload.ended || '',
        network: payload.network?.name || payload.webChannel?.name || '',
        episodeDuration: payload.averageRuntime || payload.runtime || 0,
        website: http(payload.officialSite),
      };
    } else {
      result = { ...item, catalogId: id, kind: "book", source: "Open Library", title: payload.title || item.title,
        url: "https://openlibrary.org" + id.slice(3),
        image: payload.covers?.find(n => n > 0) ? "https://covers.openlibrary.org/b/id/" + payload.covers.find(n => n > 0) + "-L.jpg" : item.image || "",
        summary: typeof payload.description === "string" ? payload.description : payload.description?.value || "",
        genres: (payload.subjects || []).slice(0, 6),
        description: item.description || payload.first_publish_date || "",
        startDate: payload.first_publish_date || "",
        subjectPlaces: (payload.subject_places || []).slice(0, 20),
        subjectPeople: (payload.subject_people || []).slice(0, 20),
        subjectTimes: (payload.subject_times || []).slice(0, 20),
        unit: "páginas", total: item.total || 0,
      };
    }
    if (detailCache.size >= 30) {detailCache.clear();detailTimes.clear();}
    detailCache.set(key, result);
    detailTimes.set(key,Date.now());
    try {
      let rows=[...detailCache].slice(-10).map(([key,value])=>({key,value,at:detailTimes.get(key)}));let json=JSON.stringify(rows);
      while(json.length>1024*1024&&rows.length){rows.shift();json=JSON.stringify(rows);}root.sessionStorage?.setItem('myspace-catalog-session',json);
    } catch {}
    return { ...item, ...result };
  }
  const describe = item => {
    if (item.kind === 'artist') return [item.knownTrack ? 'Conhecido por: ' + item.knownTrack : '', item.description || item.source || ''].filter(Boolean).filter((value,index,rows)=>index===0 || !item.knownTrack || !value.includes(item.knownTrack)).join(' · ');
    return [...new Set([item.artist || item.description || item.source, item.kind === 'music' ? item.albumTitle : '', item.releaseDate ? (['music','album'].includes(item.kind) ? 'edição ' : '') + item.releaseDate.slice(0,4) : '', item.version, item.explicit ? 'Explícita' : ''].filter(Boolean))].join(' · ');
  };
  async function artistAlbums(item, offset) {
    if (!/^deezer:[1-9]\d{0,15}$/.test(item.catalogId)) throw Error('Este catálogo não oferece paginação de álbuns.');
    const response = await root.fetch('/api/music/artist/' + item.catalogId.split(':')[1] + '/albums?offset=' + offset);
    const payload = await response.json(); if (!response.ok) throw Error(payload.error || 'Não consegui carregar os álbuns.');
    return { ...payload, items: (payload.items || []).map(album => ({ ...album, artist: item.title, artistCatalogId: item.catalogId })) };
  }
  root.Catalog = { names, request, normalize, search, details, describe, artistAlbums };
  if (typeof module !== "undefined") module.exports = root.Catalog;
})(typeof window === "undefined" ? globalThis : window);
