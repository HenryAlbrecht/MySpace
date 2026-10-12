const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { createAuthorizedMediaDownloader } = require("../../server/media/authorized-media-download.cjs");

for (const extension of ["webm", "mp3", "flac"]) {
  test("authorized " + extension + " download writes recording metadata and preserves lossless audio", async () => {
    const calls = [];
    const downloader = createAuthorizedMediaDownloader({
      env: { YTDLP_ALLOWED_HOSTS: "example.org" },
      execute(executable, args, options, callback) {
        calls.push({ executable, args });
        const output = executable === "yt-dlp"
          ? args[args.indexOf("--output") + 1].replace("%(ext)s", extension)
          : args.at(-1);
        fs.writeFile(output, "fixture").then(() => callback(null), callback);
      },
    });
    const result = await downloader.download("https://example.org/audio", "audio", {
      title: "Song", artist: "Singer · Guest", album: "Album",
      album_artist: "Singer", date: "1983-04-14", track: "3", genre: "ignored",
    });
    try {
      const args = calls.find((call) => call.executable === "ffmpeg").args;
      assert.ok(args.includes("album_artist=Singer"));
      assert.ok(args.includes("artist=Singer · Guest"));
      assert.ok(args.includes("date=1983-04-14"));
      assert.ok(args.includes("track=3"));
      assert.ok(args.includes("genre="));
      assert.equal(args.includes("-q:a"), false);
      if (extension === "flac") {
        assert.equal(args[args.indexOf("-c") + 1], "copy");
        assert.equal(path.extname(result.file), ".flac");
      } else {
        assert.equal(args[args.indexOf("-b:a") + 1], "320k");
        assert.equal(path.extname(result.file), ".mp3");
      }
    } finally {
      await result.cleanup();
    }
  });
}
