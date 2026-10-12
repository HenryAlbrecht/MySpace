const { parseClientConfig } = require("../music/youtube-music.cjs");

const ID = /^[\w-]{11}$/;
const HEADERS = {
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
};
const MAX_RESULTS = 50;

function text(value) {
  if (typeof value?.simpleText === "string") return value.simpleText.trim();
  return Array.isArray(value?.runs)
    ? value.runs.map((run) => run.text || "").join("").trim()
    : "";
}

function parseVideoResults(payload, limit = MAX_RESULTS) {
  const items = [];
  const seen = new Set();
  function visit(value, depth = 0) {
    if (!value || typeof value !== "object" || depth > 30 || items.length >= limit) return;
    const renderer = value.videoRenderer;
    if (renderer) {
      const id = renderer.videoId;
      if (ID.test(id || "") && !seen.has(id)) {
        const title = text(renderer.title);
        if (title) {
          seen.add(id);
          const channel = text(renderer.ownerText || renderer.shortBylineText);
          const thumbnails = renderer.thumbnail?.thumbnails || [];
          const thumbnail = thumbnails
            .filter((entry) => typeof entry.url === "string" && entry.url.startsWith("https://"))
            .sort((a, b) => (b.width || 0) - (a.width || 0))[0]?.url;
          items.push({
            id,
            title: title.slice(0, 500),
            channel: channel.slice(0, 200),
            url: "https://www.youtube.com/watch?v=" + id,
            thumbnail: thumbnail || "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg",
          });
        }
      }
      return;
    }
    for (const child of Object.values(value)) {
      visit(child, depth + 1);
      if (items.length >= limit) return;
    }
  }
  visit(payload);
  return items;
}

function createYouTubeVideoSearch({
  fetcher = fetch,
  now = Date.now,
  timeout = 9000,
  ttl = 15 * 60 * 1000,
} = {}) {
  const cache = new Map();
  const pending = new Map();
  let config;
  let configAt = 0;
  let configTask;

  async function getConfig(signal) {
    if (config && now() - configAt < 4 * 60 * 60 * 1000) return config;
    if (configTask) return configTask;
    configTask = (async () => {
      const response = await fetcher("https://www.youtube.com/", {
        signal,
        headers: HEADERS,
      });
      if (!response.ok) throw Error("YouTube search configuration unavailable");
      const parsed = parseClientConfig(await response.text());
      config = {
        key: parsed.key,
        client: {
          ...parsed.client,
          clientName: "WEB",
          hl: "pt-BR",
          gl: "BR",
        },
      };
      configAt = now();
      return config;
    })().finally(() => (configTask = undefined));
    return configTask;
  }

  async function request(query) {
    const signal = AbortSignal.timeout(timeout);
    const settings = await getConfig(signal);
    const response = await fetcher(
      "https://www.youtube.com/youtubei/v1/search?" +
        new URLSearchParams({ key: settings.key, prettyPrint: "false" }),
      {
        method: "POST",
        signal,
        headers: {
          ...HEADERS,
          "Content-Type": "application/json",
          Origin: "https://www.youtube.com",
          Referer: "https://www.youtube.com/",
        },
        body: JSON.stringify({ context: { client: settings.client }, query }),
      },
    );
    if (!response.ok) {
      if (response.status === 400 || response.status === 403) config = undefined;
      throw Error("YouTube video search unavailable");
    }
    const payload = await response.json();
    if (!payload || typeof payload !== "object" || payload.error)
      throw Error("YouTube video search unavailable");
    return payload;
  }

  function cached(key, work) {
    const found = cache.get(key);
    if (found && now() - found.at < ttl)
      return Promise.resolve(structuredClone(found.items));
    if (pending.has(key)) return pending.get(key).then(structuredClone);
    const task = (async () => {
      const items = await work();
      if (cache.size >= 80) cache.delete(cache.keys().next().value);
      cache.set(key, { at: now(), items });
      return items;
    })().finally(() => pending.delete(key));
    pending.set(key, task);
    return task.then(structuredClone);
  }

  return {
    async search(value, limit = MAX_RESULTS) {
      const query = String(value || "").trim();
      if (query.length < 2 || query.length > 120) {
        const error = Error("Digite um título entre 2 e 120 caracteres.");
        error.status = 400;
        throw error;
      }
      const count = Number.isInteger(limit) ? Math.max(1, Math.min(limit, MAX_RESULTS)) : MAX_RESULTS;
      const key = query.toLocaleLowerCase("pt-BR") + ":" + count;
      const items = await cached(key, async () =>
        parseVideoResults(await request(query), count),
      );
      return { items, provider: "YouTube" };
    },
  };
}

module.exports = { createYouTubeVideoSearch, parseVideoResults };
