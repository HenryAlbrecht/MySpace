const array = (value) => (Array.isArray(value) ? value : value ? [value] : []);
function createLastfmClient({ env = process.env, fetcher = fetch, interval = 300 } = {}) {
  const apiKey = env.LASTFM_API_KEY || "";
  const cache = new Map(),
    pending = new Map();
  let queue = Promise.resolve(),
    nextRequest = 0;
  function validate(kind, artist, title = "") {
    if (
      !["music", "album"].includes(kind) ||
      typeof artist !== "string" ||
      !artist.trim() ||
      artist.length > 200 ||
      typeof title !== "string" ||
      title.length > 200
    ) {
      const error = Error("Consulta musical inválida.");
      error.status = 400;
      throw error;
    }
  }
  function normalize(row, kind) {
    const artist = typeof row.artist === "string" ? row.artist : row.artist?.name || "";
    const title = row.name || "";
    const images = array(row.image)
      .map((image) => image["#text"])
      .filter(
        (url) =>
          typeof url === "string" &&
          url.startsWith("https://") &&
          !["2a96cbd8b46e442fc41c2b86b821562f", "753c0e5b1b3e0c92deaed5f9a7d36552"].some((hash) =>
            url.includes(hash),
          ),
      );
    return {
      kind,
      catalogId: "lastfm:" + encodeURIComponent(artist) + ":" + encodeURIComponent(title),
      source: "Last.fm",
      artist,
      title,
      image: images.at(-1) || "",
      url:
        "https://www.last.fm/music/" +
        encodeURIComponent(artist) +
        (kind === "music" ? "/_/" : "/") +
        encodeURIComponent(title),
      description: artist,
      summary: row.wiki?.content || row.wiki?.summary || "",
      genres: array(row.tags?.tag || row.toptags?.tag)
        .map((tag) => tag.name)
        .filter(Boolean),
      total: 0,
      unit: kind === "album" ? "faixas" : "audições",
      trackDuration:
        kind === "music" && Number(row.duration) > 0 ? Math.round(Number(row.duration) / 1000) : 0,
      listeners: String(row.listeners || ""),
      playcount: String(row.playcount || ""),
      previewUrl: "",
      releaseDate: "",
    };
  }
  function artistRow(row) {
    const result = normalize({ ...row, artist: row.name }, "artist");
    return {
      ...result,
      catalogId: "lastfm-artist:" + encodeURIComponent(row.name),
      url: "https://www.last.fm/music/" + encodeURIComponent(row.name),
      summary: row.bio?.content || row.bio?.summary || "",
      listeners: String(row.stats?.listeners || ""),
      playcount: String(row.stats?.playcount || ""),
      unit: "audições",
    };
  }
  async function request(method, params) {
    if (!apiKey) {
      const error = Error("Last.fm não configurado. Preencha LASTFM_API_KEY no .env e reinicie o servidor.");
      error.status = 503;
      throw error;
    }
    const key = method + ":" + new URLSearchParams(params);
    const found = cache.get(key);
    if (found && found.expires > Date.now()) return found.value;
    if (pending.has(key)) return pending.get(key);
    const task = queue
      .catch(() => {})
      .then(async () => {
        const delay = Math.max(0, nextRequest - Date.now());
        if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
        nextRequest = Date.now() + interval;
        let response;
        try {
          response = await fetcher(
            "https://ws.audioscrobbler.com/2.0/?" +
              new URLSearchParams({ method, ...params, api_key: apiKey, format: "json" }),
            { signal: AbortSignal.timeout(8000), headers: { Accept: "application/json" } },
          );
        } catch {
          throw Error("Não consegui conectar ao Last.fm agora.");
        }
        if (!response.ok) throw Error("Last.fm indisponível agora.");
        const payload = await response.json();
        if (payload.error) {
          const error = Error(
            [10, 26].includes(Number(payload.error))
              ? "A chave Last.fm não foi aceita. Confira LASTFM_API_KEY no .env."
              : Number(payload.error) === 29
                ? "Last.fm limitou as consultas. Aguarde um pouco."
                : "O Last.fm não disponibilizou esses dados.",
          );
          error.status = [10, 26].includes(Number(payload.error))
            ? 503
            : Number(payload.error) === 29
              ? 429
              : 502;
          throw error;
        }
        if (cache.size >= 100) cache.delete(cache.keys().next().value);
        cache.set(key, { value: payload, expires: Date.now() + 3600000 });
        return payload;
      })
      .finally(() => pending.delete(key));
    pending.set(key, task);
    queue = task;
    return task;
  }
  return {
    tag: async (value, section='info', page=1) => {
      if(typeof value!=='string'||!value.trim()||value.trim().length>80||/[\x00-\x1f\x7f<>]/.test(value)||!['info','music','album','artist','related'].includes(section)||!Number.isInteger(page)||page<1||page>10){const error=Error('Tag inválida.');error.status=400;throw error;}
      const tag=value.trim();
      const methods={info:'tag.getInfo',music:'tag.getTopTracks',album:'tag.getTopAlbums',artist:'tag.getTopArtists',related:'tag.getSimilar'};
      const payload=await request(methods[section],{tag,...(['music','album','artist'].includes(section)?{limit:6,page}: {})});
      if(section==='info')return {name:payload.tag?.name||tag,summary:payload.tag?.wiki?.content||payload.tag?.wiki?.summary||'',source:'Last.fm'};
      if(section==='related')return {tags:array(payload.similartags?.tag).map(row=>row.name).filter(name=>typeof name==='string'&&name.trim()&&name.length<=80).slice(0,12)};
      const container=payload[{music:'tracks',album:'albums',artist:'topartists'}[section]]||{};
      const rows=array(container[{music:'track',album:'album',artist:'artist'}[section]]);
      return {items:rows.map(row=>section==='artist'?artistRow(row):normalize(row,section)),next:Number(container['@attr']?.totalPages)>page?page+1:null};
    },
    summary: async (kind, artist, title = "") => {
      validate(kind === "artist" ? "music" : kind, artist, title);
      const entity = kind === "artist" ? "artist" : kind === "album" ? "album" : "track";
      const payload = await request(entity + ".getInfo", {
        artist,
        ...(entity === "artist" ? {} : { [entity]: title }),
        autocorrect: 0,
      });
      const row = payload[entity];
      return {
        summary: row?.bio?.content || row?.bio?.summary || row?.wiki?.content || row?.wiki?.summary || "",
        summarySource: "Last.fm",
        genres: array(row?.toptags?.tag || row?.tags?.tag).map(tag=>String(tag.name||'').trim()).filter(Boolean).slice(0,8),
      };
    },
    artistArtwork: async (artist) => {
      validate("music", artist);
      const payload = await request("artist.getInfo", { artist, autocorrect: 0 });
      return payload.artist ? artistRow(payload.artist).image : "";
    },
    search: async (kind, query) => {
      if (kind === "artist") {
        validate("music", query);
        if (query.trim().length < 2 || query.length > 120) {
          const error = Error("Busca de artista inválida.");
          error.status = 400;
          throw error;
        }
        const payload = await request("artist.search", { artist: query.trim(), limit: 12 });
        return {
          items: array(payload.results?.artistmatches?.artist)
            .filter((row) => row.name)
            .map(artistRow),
        };
      }
      if (
        !["music", "album"].includes(kind) ||
        typeof query !== "string" ||
        query.trim().length < 2 ||
        query.length > 120
      ) {
        const error = Error("Busca musical inválida.");
        error.status = 400;
        throw error;
      }
      const entity = kind === "album" ? "album" : "track";
      const payload = await request(entity + ".search", { [entity]: query.trim(), limit: 12 });
      return {
        items: array(payload.results?.[entity + "matches"]?.[entity])
          .map((row) => normalize(row, kind))
          .filter((row) => row.title && row.artist),
      };
    },
    details: async (kind, artist, title) => {
      if (kind === "artist") {
        validate("music", artist);
        const payload = await request("artist.getInfo", { artist, autocorrect: 0 });
        if (!payload.artist) throw Error("Artista não encontrado.");
        const result = artistRow(payload.artist);
        result.catalogId = "lastfm-artist:" + encodeURIComponent(artist);
        const albums = await request("artist.getTopAlbums", { artist, limit: 8 }).catch(() => ({}));
        const tracks = await request("artist.getTopTracks", { artist, limit: 8 }).catch(() => ({}));
        const similar = await request("artist.getSimilar", { artist, limit: 8 }).catch(() => ({}));
        result.topAlbums = array(albums.topalbums?.album).map((row) =>
          normalize({ ...row, artist: row.artist || artist }, "album"),
        );
        result.topTracks = array(tracks.toptracks?.track).map((row) =>
          normalize({ ...row, artist: row.artist || artist }, "music"),
        );
        result.similarArtists = array(similar.similarartists?.artist)
          .filter((row) => row.name)
          .map(artistRow);
        return result;
      }
      validate(kind, artist, title);
      if (!title.trim()) {
        const error = Error("Título musical inválido.");
        error.status = 400;
        throw error;
      }
      const entity = kind === "album" ? "album" : "track";
      const payload = await request(entity + ".getInfo", { artist, [entity]: title, autocorrect: 0 });
      if (!payload[entity]) throw Error("Título musical não encontrado.");
      const result = normalize(payload[entity], kind);
      // Preserve the requested identity; corrections do not create a second saved item.
      result.catalogId = "lastfm:" + encodeURIComponent(artist) + ":" + encodeURIComponent(title);
      if (kind === "album") {
        result.trackNames = array(payload.album.tracks?.track)
          .map((track) => track.name)
          .filter(Boolean);
        result.total = result.trackNames.length;
      }
      if (!result.image && payload.track?.album?.image)
        result.image = normalize({ name: title, artist, image: payload.track.album.image }, kind).image;
      return result;
    },
    recommendations: async (kind, artist, title) => {
      if (kind === "artist") {
        validate("music", artist);
        const payload = await request("artist.getSimilar", { artist, limit: 48, autocorrect: 0 });
        return {
          items: array(payload.similarartists?.artist)
            .filter((row) => row.name)
            .map(artistRow),
          basis: "Artistas similares no Last.fm",
        };
      }
      validate(kind, artist, title);
      if (kind === "music") {
        const similar = async (track) => {
          const payload = await request("track.getSimilar", { artist, track, limit: 48, autocorrect: 1 });
          return array(payload.similartracks?.track).map((row) => normalize(row, "music"));
        };
        let items = await similar(title),
          seedTitle = title;
        // Only recommendations may use the base recording after an empty exact lookup.
        // Keep live/remix/acoustic/version qualifiers and all saved metadata intact.
        const mastering =
          /(?:\s*[([](?:\d{4}\s+)?(?:digital\s+master|remaster(?:ed)?)(?:\s+\d{4})?[)\]]|\s+[-–—]\s*(?:\d{4}\s+)?(?:digital\s+master|remaster(?:ed)?)(?:\s+\d{4})?)\s*$/i;
        const base = title.replace(mastering, "").trim();
        if (!items.length && base && base !== title) {
          items = await similar(base);
          seedTitle = base;
        }
        return { items, basis: "Faixas similares no Last.fm", seedTitle, seedFallback: seedTitle !== title };
      }
      const payload = await request("artist.getSimilar", { artist, limit: 4, autocorrect: 1 });
      const items = [];
      for (const similar of array(payload.similarartists?.artist).slice(0, 4)) {
        try {
          const albums = await request("artist.getTopAlbums", { artist: similar.name, limit: 12 });
          items.push(...array(albums.topalbums?.album).map((row) => normalize(row, "album")));
        } catch {}
      }
      return { items, basis: "Álbuns populares de artistas similares no Last.fm" };
    },
  };
}
module.exports = { createLastfmClient };
