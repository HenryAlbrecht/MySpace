const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { execFile } = require("node:child_process");

const MAX_BYTES = 200 * 1024 * 1024;
const MAX_COVER_BYTES = 768 * 1024;
const MAX_METADATA_LENGTH = 300;
const BLOCKED_HOSTS = [
  "peido.com"
];
const MIME_TYPES = {
  ".aac": "audio/aac",
  ".flac": "audio/flac",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg",
  ".wav": "audio/wav",
  ".aiff": "audio/aiff",
  ".aif": "audio/aiff",
  ".ogv": "video/ogg",
  ".webm": "video/webm",
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".mkv": "video/x-matroska",
  ".mov": "video/quicktime",
  ".avi": "video/x-msvideo",
};

class DownloadError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

function createAuthorizedMediaDownloader({
  env = process.env,
  execute = execFile,
  fileSystem = fs,
  temp = os,
  executable = env.YT_DLP_PATH || "yt-dlp",
  ffmpeg = env.FFMPEG_PATH || "ffmpeg",
  maxBytes = MAX_BYTES,
} = {}) {
  const allowedHosts = new Set(
    String(env.YTDLP_ALLOWED_HOSTS || "")
      .split(",")
      .map((host) => host.trim().toLowerCase().replace(/\.$/, ""))
      .filter(
        (host) =>
          /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/.test(
            host,
          ) &&
          host !== "localhost" &&
          !host.endsWith(".localhost") &&
          !host.endsWith(".local") &&
          !host.endsWith(".internal"),
      ),
  );

  function validateUrl(value) {
    let url;
    try {
      url = new URL(String(value || ""));
    } catch {
      throw new DownloadError("Endereço de mídia inválido.", 400);
    }
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    const blocked = BLOCKED_HOSTS.some((domain) => host === domain || host.endsWith("." + domain));
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (url.port && url.port !== "443") ||
      net.isIP(host) ||
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      blocked
    )
      throw new DownloadError("Essa fonte não permite download offline pelo MySpace.", 403);
    if (!allowedHosts.has(host))
      throw new DownloadError("O domínio da fonte não está autorizado para download offline.", 403);
    return url.href;
  }

  function isAllowed(value) {
    try {
      validateUrl(value);
      return true;
    } catch {
      return false;
    }
  }

  function metadataFields(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      ["title", "artist", "album", "album_artist", "date", "track"]
        .map((key) => [
          key,
          typeof value[key] === "string"
            ? value[key].replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, MAX_METADATA_LENGTH)
            : "",
        ])
        .filter(([, text]) => text),
    );
  }

  function coverBytes(value) {
    if (!value) return null;
    const match = /^data:image\/jpeg;base64,([a-z\d+/]+={0,2})$/i.exec(String(value));
    if (!match) throw new DownloadError("A capa do álbum não está em JPEG válido.", 400);
    const buffer = Buffer.from(match[1], "base64");
    if (!buffer.length || buffer.length > MAX_COVER_BYTES)
      throw new DownloadError("A capa do álbum excede 768 KB.", 413);
    return buffer;
  }

  async function run(executablePath, args) {
    await new Promise((resolve, reject) => {
      execute(
        executablePath,
        args,
        { timeout: 120000, maxBuffer: 65536, windowsHide: true },
        (error) => (error ? reject(error) : resolve()),
      );
    });
  }

  async function remuxMetadata(file, directory, kind, metadata, coverFile) {
    const sourceExtension = path.extname(file).toLowerCase();
    const convertWebmToMp3 = kind === "audio" && sourceExtension === ".webm";
    const encodeMp3 = kind === "audio" && [".webm", ".mp3"].includes(sourceExtension);
    const extension =
      kind === "audio" && sourceExtension === ".aac"
        ? ".m4a"
        : convertWebmToMp3
          ? ".mp3"
          : sourceExtension;
    const canEmbedCover =
      kind === "audio" &&
      coverFile &&
      [".mp3", ".m4a", ".mp4", ".flac"].includes(extension);
    const output = path.join(directory, "tagged" + extension);
    const args = ["-y", "-i", file];
    if (canEmbedCover) args.push("-i", coverFile);
    args.push("-map", canEmbedCover || encodeMp3 ? "0:a:0" : "0");
    if (encodeMp3) {
      args.push("-c:a", "libmp3lame", "-b:a", "320k", "-id3v2_version", "3");
      if (canEmbedCover) args.push("-c:v", "copy");
    } else args.push("-c", "copy");
    if (canEmbedCover)
      args.push(
        "-map",
        "1:v:0",
        "-disposition:v:0",
        "attached_pic",
        "-metadata:s:v:0",
        "title=Album cover",
        "-metadata:s:v:0",
        "comment=Cover (front)",
      );
    for (const [key, value] of Object.entries(metadata))
      args.push("-metadata", key + "=" + value);
    if (kind === "audio") args.push("-metadata", "genre=");
    if (kind === "video" && extension === ".mp4") args.push("-movflags", "+faststart");
    args.push(output);
    try {
      await run(ffmpeg, args);
    } catch (error) {
      await fileSystem.rm(output, { force: true }).catch(() => {});
      if (canEmbedCover) return remuxMetadata(file, directory, kind, metadata, null);
      if (error.code === "ENOENT")
        throw new DownloadError("FFmpeg é necessário para converter o áudio e gravar tags/capa.", 503);
      if (convertWebmToMp3)
        throw new DownloadError("FFmpeg não conseguiu converter o áudio WebM para MP3.", 502);
      throw new DownloadError("FFmpeg não conseguiu gravar os metadados da mídia.", 502);
    }
    await fileSystem.rm(file, { force: true });
    return { file: output, coverEmbedded: Boolean(canEmbedCover) };
  }

  async function download(value, kindValue, metadataValue) {
    const url = validateUrl(value);
    const kind = String(kindValue || "");
    if (!["audio", "video"].includes(kind))
      throw new DownloadError("Tipo de mídia inválido.", 400);
    const metadata = metadataFields(metadataValue);
    const cover = coverBytes(metadataValue?.coverData);
    const directory = await fileSystem.mkdtemp(path.join(temp.tmpdir(), "myspace-media-"));
    const output = path.join(directory, "media.%(ext)s");
    const coverFile = cover ? path.join(directory, "album-cover.jpg") : null;
    const format =
      kind === "audio" ? "bestaudio/best" : "best[height<=1080]/best";
    const args = [
      "--no-playlist",
      "--no-progress",
      "--no-warnings",
      "--max-filesize",
      Math.floor(maxBytes / (1024 * 1024)) + "M",
      "--format",
      format,
      "--output",
      output,
    ];
    args.push(url);
    try {
      if (cover) await fileSystem.writeFile(coverFile, cover);
      await run(executable, args);
      const files = (await fileSystem.readdir(directory)).filter((name) => name.startsWith("media."));
      if (files.length !== 1)
        throw new DownloadError("A fonte não retornou um único arquivo de mídia.", 422);
      let file = path.join(directory, files[0]);
      let extension = path.extname(file).toLowerCase();
      let contentType =
        kind === "audio" && extension === ".webm" ? "audio/webm" : MIME_TYPES[extension];
      let stat = await fileSystem.stat(file);
      if (!contentType || !stat.isFile() || stat.size < 1 || stat.size > maxBytes)
        throw new DownloadError("O arquivo retornado não é compatível ou excede 200 MB.", 413);
      let coverEmbedded = false;
      if (Object.keys(metadata).length || cover || (kind === "audio" && [".webm", ".mp3"].includes(extension))) {
        const processed = await remuxMetadata(file, directory, kind, metadata, coverFile);
        file = processed.file;
        coverEmbedded = processed.coverEmbedded;
        extension = path.extname(file).toLowerCase();
        contentType =
          kind === "audio" && extension === ".webm" ? "audio/webm" : MIME_TYPES[extension];
        stat = await fileSystem.stat(file);
        if (!contentType || !stat.isFile() || stat.size < 1 || stat.size > maxBytes)
          throw new DownloadError("O arquivo com metadados excede 200 MB.", 413);
      }
      return {
        file,
        directory,
        contentType,
        size: stat.size,
        name: "media" + extension,
        coverEmbedded,
        async cleanup() {
          await fileSystem.rm(directory, { recursive: true, force: true });
        },
      };
    } catch (error) {
      await fileSystem.rm(directory, { recursive: true, force: true }).catch(() => {});
      if (error instanceof DownloadError) throw error;
      if (error.code === "ENOENT")
        throw new DownloadError("yt-dlp não está instalado ou não foi encontrado no PATH.", 503);
      if (error.code === "ETIMEDOUT" || error.killed)
        throw new DownloadError("O download demorou demais e foi interrompido.", 504);
      const detail = String(error.stderr || "");
      if (/unsupported url/i.test(detail))
        throw new DownloadError(
          "yt-dlp não reconheceu esse link. Use a URL direta do arquivo de mídia, em um domínio autorizado.",
          422,
        );
      if (/no video formats found|requested format is not available/i.test(detail))
        throw new DownloadError("yt-dlp não encontrou mídia compatível nessa URL.", 422);
      throw new DownloadError("yt-dlp não conseguiu baixar mídia desta fonte autorizada.", 502);
    }
  }

  return { isAllowed, download, configured: allowedHosts.size > 0 };
}

module.exports = { createAuthorizedMediaDownloader, DownloadError };
