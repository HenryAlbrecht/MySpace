const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs/promises");
const { execFile } = require("node:child_process");
const { createSteamClient } = require("./server/media/steam.cjs");
const { createIgdbClient } = require("./server/media/igdb.cjs");

const { createMediaClient } = require("./server/media/media.cjs");

const { createMusicCatalog } = require("./server/music-catalog.cjs");
const { validSearchCursor } = require("./server/music/youtube-music.cjs");
const { createMusicArtwork } = require('./server/music/music-artwork.cjs');
const { createTranslationClient } = require("./server/translation.cjs");
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".svg": "image/svg+xml", ".webp": "image/webp",
  ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2",
};

function createServer({ artwork = createMusicArtwork(), music = createMusicCatalog(), translation = createTranslationClient(), media = createMediaClient(), steam = createSteamClient(), igdb = createIgdbClient(), directory = path.join(__dirname, "dist") } = {}) {
  const root = path.resolve(directory);
  const insideRoot = (target) => {
    const relative = path.relative(root, target);
    return relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative);
  };
  return http.createServer(async (req, res) => {
    const json = (status, data) => {
      res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
      res.end(JSON.stringify(data));
    };
    try {
      const port = req.socket.localPort;
      const allowedHosts = ["localhost:" + port, "127.0.0.1:" + port];
      if (!allowedHosts.includes(req.headers.host)) return json(403, { error: "Endereço local inválido." });
      const origin = req.headers.origin;
      if (origin && !allowedHosts.map(h => "http://" + h).includes(origin)) return json(403, { error: "Origem inválida." });
      if (req.headers["sec-fetch-site"] === "cross-site") return json(403, { error: "Origem inválida." });
      if (!["GET", "HEAD"].includes(req.method)) return json(405, { error: "Método não permitido." });
      const url = new URL(req.url, "http://" + req.headers.host);
      if(url.pathname==='/api/music/artwork'){
        const image=await artwork(url.searchParams.get('url'));
        res.writeHead(200,{'Content-Type':image.type,'Content-Length':image.body.length,'Cache-Control':'private, max-age=900','X-Content-Type-Options':'nosniff'});return res.end(req.method==='HEAD'?undefined:image.body);
      }
      if (url.pathname === '/api/translation') return json(200, await translation.translate(url.searchParams.get('text'), url.searchParams.get('source') || 'en'));
      if (url.pathname === '/api/music/playback-source') return json(200,await music.playbackSource(url.searchParams.get('title'),url.searchParams.get('artist'),{album:url.searchParams.get('album')||'',duration:url.searchParams.has('duration')?Number(url.searchParams.get('duration')):undefined}));
      if (url.pathname === "/api/music/search") {
        const cursor = url.searchParams.has("cursor")
          ? url.searchParams.get("cursor")
          : undefined;
        if (cursor !== undefined && !validSearchCursor(cursor))
          return json(400, { error: "Cursor de busca inválido." });
        return json(
          200,
          await music.search(
            url.searchParams.get("kind"),
            url.searchParams.get("q"),
            url.searchParams.get("provider") || "auto",
            { cursor },
          ),
        );
      }
      if (url.pathname === '/api/music/tag') return json(200,await music.tag(url.searchParams.get('tag'),url.searchParams.get('section')||'info',Number(url.searchParams.get('page')||1)));
      if (url.pathname === '/api/music/artist-photo') return json(200,await music.artistPhoto(url.searchParams.get('name'),url.searchParams.get('catalogId')||''));
      if (url.pathname === '/api/music/summary') return json(200,await music.summary(url.searchParams.get('kind'),url.searchParams.get('artist'),url.searchParams.get('title')));
      if (/^\/api\/music\/(?:deezer|lastfm|musicbrainz)\//.test(url.pathname) || /^\/api\/music\/artist\/\d+\/albums$/.test(url.pathname)) return json(410,{error:'O catálogo usa Apple/iTunes.'});
      if (url.pathname === '/api/music/recommendations') return json(200,await music.recommendations(url.searchParams.get('kind'),url.searchParams.get('artist'),url.searchParams.get('title'),{localPool:url.searchParams.get('localPool')==='1',reserve:url.searchParams.get('reserve')==='1',force:url.searchParams.get('force')==='1',videoId:url.searchParams.get('videoId')||'',albumId:url.searchParams.get('albumId')||'',artistId:url.searchParams.get('artistId')||''}));
      const musicDetail = url.pathname.match(/^\/api\/music\/(music|album|artist)\/([1-9]\d{0,15})$/);
      if (musicDetail) return json(200, await music.details(musicDetail[1], musicDetail[2]));
      const youtubeDetail = url.pathname.match(/^\/api\/music\/ytmusic\/(music|album|artist)\/([\w-]{8,124})$/);
      if (youtubeDetail) return json(200, await music.details(youtubeDetail[1], 'ytmusic:'+(youtubeDetail[1]==='music'?'video':youtubeDetail[1])+':'+youtubeDetail[2], {title:url.searchParams.get('title')||'',artist:url.searchParams.get('artist')||'',phase:url.searchParams.get('phase')==='core'?'core':'full'}));
      if (url.pathname === "/api/media/metadata") return json(200, await media.metadata(url.searchParams.get("url")));
      if (url.pathname === "/api/igdb/search") return json(200, await igdb.search(url.searchParams.get("q")));
      const igdbDetail = url.pathname.match(/^\/api\/igdb\/games\/([1-9]\d{0,9})$/);
      if (igdbDetail) return json(200, await igdb.details(igdbDetail[1]));
      const suggestions = url.pathname.match(/^\/api\/steam\/recommendations\/([1-9]\d{0,9})$/);
      if (suggestions) return json(200, await steam.recommendations(suggestions[1]));
      if (url.pathname === "/api/steam/search") {
        return json(200, await steam.search(url.searchParams.get("q")));
      }
      const detail = url.pathname.match(/^\/api\/steam\/games\/([1-9]\d{0,9})$/);
      if (detail) return json(200, await steam.details(detail[1]));
      if (url.pathname.startsWith("/api/")) return json(404, { error: "Consulta não encontrada." });
      let pathname;
      try { pathname = decodeURIComponent(url.pathname); }
      catch { return json(400, { error: "Endereço inválido." }); }
      if (pathname.includes("\0") || pathname.includes("\\")) return json(400, { error: "Endereço inválido." });
      const file = path.resolve(root, "." + (pathname === "/" ? "/index.html" : pathname));
      if (!insideRoot(file) || !TYPES[path.extname(file)]) return json(404, { error: "Arquivo não encontrado." });
      let actual;
      try { actual = await fs.realpath(file); }
      catch { return json(404, { error: "Arquivo não encontrado." }); }
      if (!insideRoot(actual)) return json(404, { error: "Arquivo não encontrado." });
      const metadata = await fs.stat(actual);
      if (!metadata.isFile()) return json(404, { error: "Arquivo não encontrado." });
      const etag = `W/"${metadata.size.toString(16)}-${metadata.mtimeMs.toString(16)}-${metadata.ctimeMs.toString(16)}"`;
      const headers = {
        "Content-Type": TYPES[path.extname(file)],
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
        ETag: etag,
        "Last-Modified": metadata.mtime.toUTCString(),
      };
      const candidates = req.headers["if-none-match"];
      if (
        candidates
          ?.split(",")
          .some(
            (value) =>
              value.trim() === "*" ||
              value.trim().replace(/^W\//, "") === etag.replace(/^W\//, ""),
          )
      ) {
        res.writeHead(304, headers);
        return res.end();
      }
      if (req.method === "HEAD") {
        res.writeHead(200, { ...headers, "Content-Length": metadata.size });
        return res.end();
      }
      const content = await fs.readFile(actual);
      res.writeHead(200, { ...headers, "Content-Length": content.length });
      res.end(content);
    } catch (error) {
      json(error.status || 502, { error: error.status ? error.message : "Não consegui consultar esse serviço agora. Tente novamente.",...(error.resolution?{resolution:error.resolution}:{}) });
    }
  });
}

if (require.main === module) {
  try { process.loadEnvFile(path.join(__dirname, ".env")); }
  catch (error) { if (error.code !== "ENOENT") console.error("Não consegui ler o arquivo .env."); }
  const server = createServer();
  server.listen(3000, "127.0.0.1", () => {
    console.log("MySpace: http://localhost:3000\nDeixe esta janela aberta. Ctrl+C encerra o site.");
    if (process.argv.includes("--open") && process.platform === "win32") {
      execFile("cmd.exe", ["/d", "/c", "start http://localhost:3000"], { windowsHide: true }, () => {});
    }
  });
  server.on("error", (error) => {
    console.error(error.code === "EADDRINUSE" ? "A porta 3000 já está ocupada. Feche a outra instância do site e tente novamente." : "Não consegui iniciar o servidor local.");
    process.exitCode = 1;
  });
}

module.exports = { createServer };
