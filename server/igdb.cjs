const FIELDS = "id,name,url,summary,cover.image_id,similar_games.id,similar_games.name,similar_games.cover.image_id,screenshots.image_id,screenshots.width,screenshots.height,artworks.image_id,artworks.width,artworks.height,genres.name,platforms.name,first_release_date,involved_companies.developer,involved_companies.company.name";
const DETAILS = FIELDS + ',storyline,game_type,parent_game,version_parent,rating,rating_count,aggregated_rating,aggregated_rating_count,videos.name,videos.video_id,game_localizations.name,game_localizations.region.name,game_localizations.cover.image_id,dlcs.id,dlcs.name,dlcs.cover.image_id,expansions.id,expansions.name,expansions.cover.image_id,forks.id,forks.name,forks.game_type,forks.cover.image_id';
const RELATION_FIELDS = ['dlcs','expansions','forks','bundles','remakes','remasters','expanded_games','ports'].flatMap(key => ['id','name','cover.image_id','first_release_date'].map(field => key + '.' + field)).join(',');
class CatalogError extends Error {
  constructor(message, status = 502) { super(message); this.status = status; }
}
function createIgdbClient({ env = process.env, fetcher = fetch } = {}) {
  const clientId = env.IGDB_CLIENT_ID || "", secret = env.IGDB_CLIENT_SECRET || "";
  let token = "", expires = 0, tokenTask, queue = Promise.resolve();
  const cache = new Map();
  const image = (id, size) => /^[\w-]+$/.test(id || "") ? "https://images.igdb.com/igdb/image/upload/t_" + size + "/" + id + ".jpg" : "";
  async function accessToken() {
    if (!clientId || !secret) throw new CatalogError("IGDB não configurado. Preencha IGDB_CLIENT_ID e IGDB_CLIENT_SECRET no arquivo .env e reinicie o site. A Steam continua disponível.", 503);
    if (token && expires > Date.now()) return token;
    if (tokenTask) return tokenTask;
    tokenTask = (async () => {
      const response = await fetcher("https://id.twitch.tv/oauth2/token", {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: clientId, client_secret: secret, grant_type: "client_credentials" }),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new CatalogError("Não consegui autenticar o IGDB. Confira as credenciais da Twitch.", 503);
      const data = await response.json();
      if (!data.access_token || !Number.isFinite(data.expires_in)) throw new CatalogError("A Twitch retornou uma autenticação inválida.");
      token = data.access_token;
      expires = Date.now() + Math.max(0, data.expires_in - 60) * 1000;
      return token;
    })();
    try { return await tokenTask; } finally { tokenTask = undefined; }
  }
  function normalize(game) {
    const year = game.first_release_date ? new Date(game.first_release_date * 1000).getUTCFullYear() : "";
    const verticalImage = image(game.cover?.image_id, "cover_big_2x");
    const horizontalImage = image(game.screenshots?.[0]?.image_id, "screenshot_big");
    const landscape = (game.artworks || []).find(art => art.width > art.height)
      || (game.screenshots || []).find(art => art.width > art.height);
    const bannerImage = image(landscape?.image_id, "1080p");
    const relations = [
      ...(game.dlcs || []).map(row => ({ row, type: 'DLC' })),
      ...(game.expansions || []).map(row => ({ row, type: 'Expansão' })),
      ...(game.forks || []).map(row => ({ row, type: row.game_type === 5 ? 'Mod' : 'Derivado' })),
      ...[['bundles','Pacote'],['remakes','Remake'],['remasters','Remaster'],['expanded_games','Versão expandida'],['ports','Port']].flatMap(([key,type]) => (game[key] || []).map(row => ({ row, type })))
    ].slice(0, 100);
    return {
      catalogId: "igdb:" + game.id, kind: "game", source: "IGDB", title: game.name || "",
      url: "https://www.igdb.com/games/" + encodeURIComponent(String(game.url || "").split("/").pop() || game.id),
      image: verticalImage || horizontalImage, verticalImage, horizontalImage,
      bannerImage,
      gameType: ({0:'Jogo base',1:'DLC',2:'Expansão',3:'Pacote',4:'Expansão independente',5:'Mod',8:'Remake',9:'Remaster',10:'Versão expandida',11:'Port',12:'Derivado',13:'Pacote',14:'Atualização'})[game.game_type ?? game.category] || '', parentGame: game.parent_game || null, versionParent: game.version_parent || null,
      releaseYear: String(year),
      screenshots: (game.screenshots || []).map(row => image(row.image_id, '1080p')).filter(Boolean),
      artworks: (game.artworks || []).map(row => image(row.image_id, '1080p')).filter(Boolean),
      artworkLabels: (game.artworks || []).map(row => row.image_type?.name || 'Artwork'),
      videoIds: (game.videos || []).filter(row => /^[\w-]{11}$/.test(row.video_id || '')).map(row => row.video_id),
      videoTitles: (game.videos || []).filter(row => /^[\w-]{11}$/.test(row.video_id || '')).map(row => row.name || 'Vídeo'),
      localizedCoverImages: (game.game_localizations || []).filter(row => row.cover?.image_id).map(row => image(row.cover.image_id, 'cover_big_2x')),
      localizedCoverLabels: (game.game_localizations || []).filter(row => row.cover?.image_id).map(row => [row.name, row.region?.name].filter(Boolean).join(' · ') || 'Capa regional'),
      catalogRating: Number.isFinite(game.rating) ? Math.round(game.rating * 10) / 10 : null, ratingScale: 100,
      ratingCount: game.rating_count || 0,
      criticRating: Number.isFinite(game.aggregated_rating) ? Math.round(game.aggregated_rating * 10) / 10 : null,
      criticRatingCount: game.aggregated_rating_count || 0,
      storyline: game.storyline || '',
      relatedGameIds: relations.map(({row}) => 'igdb:' + row.id),
      relatedGameTitles: relations.map(({row}) => row.name || ''),
      relatedGameImages: relations.map(({row}) => image(row.cover?.image_id, 'cover_big_2x')),
      relatedGameTypes: relations.map(({type}) => type),
      relatedGameYears: relations.map(({row}) => row.first_release_date ? String(new Date(row.first_release_date * 1000).getUTCFullYear()) : ''),
      recommendationIds: (game.similar_games || []).slice(0, 12).map(row => 'igdb:' + row.id),
      recommendationTitles: (game.similar_games || []).slice(0, 12).map(row => row.name || ''),
      recommendationImages: (game.similar_games || []).slice(0, 12).map(row => image(row.cover?.image_id, 'cover_big_2x')),
      recommendationKinds: (game.similar_games || []).slice(0, 12).map(() => 'game'),
      coverLayout: verticalImage ? "vertical" : "horizontal",
      summary: game.summary || "", genres: (game.genres || []).map(g => g.name),
      platforms: (game.platforms || []).map(p => p.name),
      description: [year, ...(game.involved_companies || []).filter(c => c.developer).map(c => c.company?.name)].filter(Boolean).join(" · "),
      total: 0, unit: "horas",
    };
  }
  async function query(body, retry = true, endpoint = 'games', raw = false) {
    const authorization = await accessToken();
    const response = await fetcher("https://api.igdb.com/v4/" + endpoint, {
      method: "POST", headers: { "Client-ID": clientId, Authorization: "Bearer " + authorization, Accept: "application/json" },
      body, signal: AbortSignal.timeout(8000),
    });
    if (response.status === 401 && retry) { token = ""; return query(body, false, endpoint, raw); }
    if (response.status === 429) throw new CatalogError("IGDB ocupado. Aguarde um pouco e tente novamente.", 429);
    if (!response.ok) throw new CatalogError("Não consegui consultar o IGDB agora.");
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new CatalogError("Resposta inválida do IGDB.");
    return raw ? rows : rows.filter(g => Number.isSafeInteger(g.id) && g.id > 0).map(normalize);
  }
  function load(key, body, endpoint = 'games', raw = false) {
    const found = cache.get(key);
    if (found && found.expires > Date.now()) return Promise.resolve(found.value);
    const task = queue.catch(() => {}).then(async () => {
      try {
        const value = await query(body, true, endpoint, raw);
        if (cache.size >= 60) cache.delete(cache.keys().next().value);
        cache.set(key, { value, expires: Date.now() + 900000 });
        return value;
      } catch (error) {
        if (error.status) throw error;
        throw new CatalogError("Não consegui conectar ao IGDB. Tente novamente.");
      }
    });
    queue = task.catch(() => {}).then(() => new Promise(resolve => setTimeout(resolve, 300)));
    return task;
  }
  return {
    configured: !!clientId && !!secret,
    async search(value) {
      const term = String(value || "").trim();
      if (term.length < 2 || term.length > 120) throw new CatalogError("Digite entre 2 e 120 caracteres.", 400);
      let items = await load("search:" + term.toLowerCase(), "search " + JSON.stringify(term) + "; fields " + FIELDS + ',game_type,parent_game,version_parent' + "; limit 50;");
      if (!items.length) items = await load('partial:' + term.toLowerCase(), 'fields ' + FIELDS + ',game_type,parent_game; where name ~ *' + JSON.stringify(term) + '*; limit 50;');
      const clean = value => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
      const needle = clean(term);
      const score = row => clean(row.title) === needle ? 0 : /Jogo base|Remake|Remaster/.test(row.gameType) || (!row.parentGame && !row.gameType) ? 1 : 2;
      items.sort((a, b) => score(a) - score(b) || (clean(a.title).startsWith(needle) ? 0 : 1) - (clean(b.title).startsWith(needle) ? 0 : 1) || a.title.length - b.title.length);
      return { items: items.slice(0, 24) };
    },
    async details(value) {
      const id = String(value || "");
      if (!/^[1-9]\d{0,9}$/.test(id)) throw new CatalogError("Identificador inválido.", 400);
      const rows = await load("game:" + id, "fields " + DETAILS + ',' + RELATION_FIELDS + "; where id = " + id + "; limit 1;");
      const game = rows.find(g => g.catalogId === "igdb:" + id);
      if (!game) throw new CatalogError("Jogo não encontrado no IGDB.", 404);
      const children = await load('children:' + id, 'fields ' + FIELDS + ',game_type; where parent_game = ' + id + ' & game_type = (1,2,3,4,5,8,9,10,11,12,13); limit 50;').catch(() => []);
      for (const child of children.filter(row => row.gameType && !game.relatedGameIds.includes(row.catalogId))) {
        game.relatedGameIds.push(child.catalogId); game.relatedGameTitles.push(child.title); game.relatedGameImages.push(child.image); game.relatedGameTypes.push(child.gameType);
        game.relatedGameYears.push(child.releaseYear);
      }
      const editionBase = Number.isSafeInteger(game.versionParent) ? game.versionParent : Number(id);
      const editions = await load('editions:' + editionBase, 'fields ' + FIELDS + ',game_type; where version_parent = ' + editionBase + '; limit 30;').catch(() => []);
      for (const edition of editions.filter(row => row.catalogId !== game.catalogId && !game.relatedGameIds.includes(row.catalogId))) {
        game.relatedGameIds.push(edition.catalogId); game.relatedGameTitles.push(edition.title); game.relatedGameImages.push(edition.image); game.relatedGameTypes.push('Edição');
        game.relatedGameYears.push(edition.releaseYear);
      }
      const time = await load('time:' + id, 'fields game_id,hastily,normally,completely,count; where game_id = ' + id + '; limit 1;', 'game_time_to_beats', true).catch(() => []);
      const durations = time.find(row => row.game_id === Number(id));
      if (durations) {
        game.timeMain = durations.hastily || 0; game.timeExtras = durations.normally || 0; game.timeComplete = durations.completely || 0; game.timeSubmissions = durations.count || 0;
      }
      const originalId = game.versionParent || game.parentGame;
      if (Number.isSafeInteger(originalId) && originalId > 0) {
        const original = await load('original:' + originalId, 'fields ' + FIELDS + '; where id = ' + originalId + '; limit 1;').catch(() => []);
        if (original[0] && !game.relatedGameIds.includes(original[0].catalogId)) {
          game.relatedGameIds.unshift(original[0].catalogId); game.relatedGameTitles.unshift(original[0].title); game.relatedGameImages.unshift(original[0].image); game.relatedGameTypes.unshift(/Remake|Remaster/.test(game.gameType) ? 'Jogo original' : 'Jogo base');
          game.relatedGameYears.unshift(original[0].releaseYear);
        }
      }
      return game;
    },
  };
}
module.exports = { createIgdbClient };


