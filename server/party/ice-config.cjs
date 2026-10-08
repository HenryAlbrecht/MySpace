const { createHmac, randomUUID } = require("node:crypto");
const ICE = require("../../dist/voice/ice-config.js");
function readConfig(env = process.env) {
  const stun = ICE.urls(env.PARTY_STUN_URLS || ICE.DEFAULT_STUN).filter((u) => /^stuns?:/i.test(u));
  const turn = ICE.urls(env.PARTY_TURN_URLS).filter((u) => /^turns?:/i.test(u));
  const ttl = Number(env.PARTY_TURN_TTL || 3600);
  if (!Number.isInteger(ttl) || ttl < 120 || ttl > 86400)
    throw Error("PARTY_TURN_TTL must be 120..86400 seconds");
  const provider = env.PARTY_ICE_PROVIDER || "coturn";
  if (!["coturn", "metered"].includes(provider)) throw Error("Invalid PARTY_ICE_PROVIDER");
  let meteredDomain = "";
  if (provider === "metered") {
    try {
      const url = new URL(env.METERED_DOMAIN);
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.pathname !== "/" ||
        url.search ||
        url.hash
      )
        throw Error();
      meteredDomain = url.origin;
    } catch {
      throw Error("Invalid METERED_DOMAIN");
    }
    if (!env.METERED_TURN_API_KEY) throw Error("METERED_TURN_API_KEY required");
  }
  return {
    provider,
    meteredDomain,
    meteredKey: env.METERED_TURN_API_KEY || "",
    stun,
    turn,
    secret: env.PARTY_TURN_SECRET || "",
    ttl,
    origins: String(env.PARTY_ALLOWED_ORIGINS || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
  };
}
function issue(config, { now = Date.now(), suffix = randomUUID() } = {}) {
  const iceServers = config.stun.length ? [{ urls: config.stun }] : [];
  let expiresAt = 0;
  if (config.turn.length && config.secret) {
    const expiry = Math.floor(now / 1000) + config.ttl;
    expiresAt = expiry * 1000;
    const username = `${expiry}:${suffix}`;
    iceServers.push({
      urls: config.turn,
      username,
      credential: createHmac("sha1", config.secret).update(username).digest("base64"),
    });
  }
  return { iceServers, expiresAt, turn: expiresAt > 0 };
}
function createLimiter({ windowMs = 60000, socketMax = 6, ipMax = 30, now = Date.now } = {}) {
  const ips = new Map(),
    sockets = new WeakMap();
  function allow(socket, ip) {
    const time = now();
    for (const [key, list] of ips)
      if (!list.length || list[list.length - 1] <= time - windowMs) ips.delete(key);
    const prune = (list) => list.filter((t) => t > time - windowMs);
    const own = prune(sockets.get(socket) || []),
      shared = prune(ips.get(ip) || []);
    if (own.length >= socketMax || shared.length >= ipMax || (!ips.has(ip) && ips.size >= 4096))
      return false;
    own.push(time);
    shared.push(time);
    sockets.set(socket, own);
    ips.set(ip, shared);
    return true;
  }
  return { allow };
}
function validateMetered(value, apiKey) {
  if (!Array.isArray(value) || !value.length || value.length > 16)
    throw Error("Invalid provider response");
  const servers = value.map((entry) => {
    if (!entry || typeof entry !== "object") throw Error("Invalid provider response");
    const list = Array.isArray(entry.urls) ? entry.urls : [entry.urls];
    if (
      !list.length ||
      list.length > 16 ||
      list.some(
        (url) =>
          typeof url !== "string" ||
          url.length > 512 ||
          !/^(stun|stuns|turn|turns):[^\s]+$/i.test(url) ||
          url.includes(apiKey),
      )
    )
      throw Error("Invalid provider response");
    const server = { urls: Array.isArray(entry.urls) ? [...list] : list[0] };
    if (list.some((url) => /^turns?:/i.test(url))) {
      if (
        ["username", "credential"].some(
          (key) =>
            typeof entry[key] !== "string" ||
            !entry[key] ||
            entry[key].length > 256 ||
            entry[key].includes(apiKey),
        )
      )
        throw Error("Invalid provider response");
      server.username = entry.username;
      server.credential = entry.credential;
    }
    return server;
  });
  if (
    !servers.some((s) =>
      (Array.isArray(s.urls) ? s.urls : [s.urls]).some((u) => /^turns?:/i.test(u)),
    )
  )
    throw Error("Missing TURN servers");
  return servers;
}
function createProvider(
  config,
  {
    fetch = globalThis.fetch,
    now = Date.now,
    cacheMs = 300000,
    failureMs = 30000,
    onStatus = () => {},
  } = {},
) {
  let cache = null,
    pending = null;
  async function metered() {
    try {
      const url = new URL("/api/v1/turn/credentials", config.meteredDomain);
      url.searchParams.set("apiKey", config.meteredKey);
      const response = await fetch(url, {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(6000),
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw Error();
      let body = "";
      if (response.body?.getReader) {
        const reader = response.body.getReader();
        let size = 0;
        const chunks = [];
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.length;
            if (size > 65536) throw Error();
            chunks.push(Buffer.from(value));
          }
          body = Buffer.concat(chunks).toString("utf8");
        } finally {
          await reader.cancel().catch(() => {});
        }
      } else {
        body = await response.text();
        if (Buffer.byteLength(body) > 65536) throw Error();
      }
      const iceServers = validateMetered(JSON.parse(body), config.meteredKey);
      cache = { iceServers, expiresAt: now() + cacheMs, turn: true };
      onStatus({ provider: "metered", ok: true });
    } catch {
      // Never surface fetch errors: they can contain the authenticated request URL.
      cache = {
        iceServers: config.stun.length ? [{ urls: config.stun }] : [],
        expiresAt: now() + failureMs,
        turn: false,
      };
      onStatus({ provider: "metered", ok: false });
    }
    return cache;
  }
  return {
    getIceConfiguration() {
      if (config.provider !== "metered") return Promise.resolve(issue(config));
      if (cache && cache.expiresAt > now()) return Promise.resolve(cache);
      if (!pending)
        pending = metered().finally(() => {
          pending = null;
        });
      return pending;
    },
  };
}
module.exports = { readConfig, issue, createLimiter, validateMetered, createProvider };
