const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { execFile } = require("node:child_process");

const MAX_BYTES = 200 * 1024 * 1024;
const BLOCKED_HOSTS = [
  "youtube.com",
  "youtube-nocookie.com",
  "youtu.be",
  "googlevideo.com",
];
const MIME_TYPES = {
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg",
  ".ogv": "video/ogg",
  ".webm": "video/webm",
  ".mp4": "video/mp4",
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

  async function download(value, kindValue) {
    const url = validateUrl(value);
    const kind = String(kindValue || "");
    if (!["audio", "video"].includes(kind))
      throw new DownloadError("Tipo de mídia inválido.", 400);
    const directory = await fileSystem.mkdtemp(path.join(temp.tmpdir(), "myspace-media-"));
    const output = path.join(directory, "media.%(ext)s");
    const format =
      kind === "audio" ? "bestaudio[ext=m4a]/bestaudio/best" : "best[height<=1080]/best";
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
      url,
    ];
    try {
      await new Promise((resolve, reject) => {
        execute(executable, args, { timeout: 120000, maxBuffer: 65536, windowsHide: true }, (error) =>
          error ? reject(error) : resolve(),
        );
      });
      const files = await fileSystem.readdir(directory);
      if (files.length !== 1)
        throw new DownloadError("A fonte não retornou um único arquivo de mídia.", 422);
      const file = path.join(directory, files[0]);
      const extension = path.extname(file).toLowerCase();
      const contentType =
        kind === "audio" && extension === ".webm" ? "audio/webm" : MIME_TYPES[extension];
      const stat = await fileSystem.stat(file);
      if (!contentType || !stat.isFile() || stat.size < 1 || stat.size > maxBytes)
        throw new DownloadError("O arquivo retornado não é compatível ou excede 200 MB.", 413);
      return {
        file,
        directory,
        contentType,
        size: stat.size,
        name: "media" + extension,
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
      throw new DownloadError("yt-dlp não conseguiu baixar mídia desta fonte autorizada.", 502);
    }
  }

  return { isAllowed, download, configured: allowedHosts.size > 0 };
}

module.exports = { createAuthorizedMediaDownloader, DownloadError };
