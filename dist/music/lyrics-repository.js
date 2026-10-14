/* Resolves lyrics for SPACEAMP without delegating search to the renderer. */
(function (root) {
  const ORIGIN = "https://lrc.red";
  const TTML_NAMESPACE = "http://www.w3.org/ns/ttml";
  const REQUEST_TIMEOUT_MS = 8000;
  const MAX_TTML_LENGTH = 2 * 1024 * 1024;
  const MAX_CACHE_ENTRIES = 24;
  const MAX_CACHE_BYTES = 4 * 1024 * 1024;
  const VARIANT_MARKERS = [
    "live",
    "remix",
    "acoustic",
    "unplugged",
    "demo",
    "instrumental",
    "karaoke",
    "sped up",
    "slowed",
    "nightcore",
    "radio edit",
    "edit",
    "extended",
    "alternative",
    "alternate",
    "cover",
    "remaster",
    "version",
  ];
  const cache = new Map();
  const pending = new Map();
  let cacheBytes = 0;

  function result(status, fields = {}) {
    return Object.freeze({
      status,
      document: null,
      format: null,
      provider: "lrc.red",
      recordingId: null,
      reason: "",
      ...fields,
    });
  }

  function validIsrc(value) {
    return typeof value === "string" && /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(value);
  }

  function cleanText(value, maxLength = 300) {
    if (typeof value !== "string") return "";
    return value.normalize("NFC").trim().replace(/\s+/g, " ").slice(0, maxLength);
  }

  function comparisonKey(value) {
    return String(value || "")
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  }

  function normalizeTrack(input) {
    const value = input && typeof input === "object" ? input : {};
    const rawIsrc = cleanText(value.isrc, 32).toUpperCase();
    const durationMs = Number(value.durationMs);
    const durationSeconds = Number.isFinite(durationMs) && durationMs > 0 && durationMs <= 86400000
      ? Math.round(durationMs / 1000)
      : 0;
    const track = {
      identity: cleanText(value.identity, 256),
      title: cleanText(value.title),
      artist: cleanText(value.artist),
      album: cleanText(value.album),
      durationSeconds,
      isrc: validIsrc(rawIsrc) ? rawIsrc : "",
    };
    track.key = JSON.stringify([
      track.identity,
      track.isrc,
      comparisonKey(track.title),
      comparisonKey(track.artist),
      comparisonKey(track.album),
    ]);
    return track;
  }

  function makeAbortError(message, name) {
    if (typeof DOMException === "function") return new DOMException(message, name);
    const error = new Error(message);
    error.name = name;
    return error;
  }

  async function requestText(url, accept, parentSignal) {
    if (parentSignal?.aborted) return { status: "cancelled" };
    const controller = new AbortController();
    let timedOut = false;
    const abortFromParent = () => controller.abort(parentSignal.reason);
    parentSignal?.addEventListener("abort", abortFromParent, { once: true });
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort(makeAbortError("Lyrics request timed out", "TimeoutError"));
    }, REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: "GET",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        redirect: "error",
        headers: { Accept: accept },
        signal: controller.signal,
      });
      if (parentSignal?.aborted) return { status: "cancelled" };
      if (response.url && new URL(response.url).origin !== ORIGIN)
        return { status: "error", reason: "untrusted-response" };
      if (response.status === 404 || response.status === 204)
        return { status: "not-found" };
      if (!response.ok) return { status: "error", reason: `http-${response.status}` };

      const text = await response.text();
      if (parentSignal?.aborted) return { status: "cancelled" };
      if (text.length > MAX_TTML_LENGTH)
        return { status: "error", reason: "response-too-large" };
      return { status: "ok", text };
    } catch {
      if (parentSignal?.aborted) return { status: "cancelled" };
      return { status: "error", reason: timedOut ? "timeout" : "network" };
    } finally {
      clearTimeout(timeout);
      parentSignal?.removeEventListener("abort", abortFromParent);
    }
  }

  function validTTML(documentText) {
    if (
      typeof documentText !== "string" ||
      !documentText.trim() ||
      documentText.length > MAX_TTML_LENGTH ||
      typeof DOMParser !== "function"
    )
      return false;
    try {
      const xml = new DOMParser().parseFromString(documentText, "application/xml");
      const rootElement = xml.documentElement;
      if (
        !rootElement ||
        rootElement.localName.toLowerCase() !== "tt" ||
        (rootElement.namespaceURI && rootElement.namespaceURI !== TTML_NAMESPACE) ||
        xml.querySelector("parsererror")
      )
        return false;
      return xml.getElementsByTagNameNS("*", "p").length > 0;
    } catch {
      return false;
    }
  }

  function fromTTML(documentText, recordingId) {
    if (!validTTML(documentText))
      return result("error", { reason: "invalid-ttml" });
    return result("found", {
      document: documentText,
      format: "ttml",
      recordingId,
    });
  }

  function hitText(value) {
    if (typeof value === "string") return cleanText(value);
    if (Array.isArray(value))
      return cleanText(
        value
          .map((item) => (typeof item === "string" ? item : item?.name || ""))
          .filter(Boolean)
          .join(", "),
      );
    return "";
  }

  function normalizeHit(hit) {
    if (!hit || typeof hit !== "object") return null;
    const rawIsrc = cleanText(hit.isrc, 32).toUpperCase();
    const durationValue = Number(
      hit.duration_ms != null
        ? Number(hit.duration_ms) / 1000
        : (hit.duration ?? hit.durationSeconds),
    );
    const durationSeconds = Number.isFinite(durationValue) && durationValue > 0 ? durationValue : 0;
    if (!validIsrc(rawIsrc)) return null;
    return {
      isrc: rawIsrc,
      title: hitText(hit.title ?? hit.track),
      artist: hitText(hit.artist ?? hit.artists),
      album: hitText(hit.album ?? hit.albumTitle),
      durationSeconds,
    };
  }

  function hasHitMetadata(hit) {
    return !!(hit.title && hit.artist);
  }

  function variantMarkers(recording) {
    const text = comparisonKey(`${recording.title} ${recording.album}`);
    return VARIANT_MARKERS.filter((marker) =>
      new RegExp(`(?:^| )${marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?: |$)`).test(text),
    ).join("|");
  }

  function hitMatches(track, hit) {
    const model = root.MusicModel;
    if (!model?.sameWork || !model?.recordingMatch) return false;
    const current = {
      kind: "music",
      title: track.title,
      artist: track.artist,
      albumTitle: track.album,
      trackDuration: track.durationSeconds || undefined,
      isrc: track.isrc,
    };
    const candidate = {
      kind: "music",
      title: hit.title,
      artist: hit.artist,
      albumTitle: hit.album,
      trackDuration: hit.durationSeconds || undefined,
      isrc: hit.isrc,
    };
    if (
      !model.sameWork(current, candidate) ||
      variantMarkers(current) !== variantMarkers(candidate) ||
      (track.isrc && hit.isrc && track.isrc !== hit.isrc)
    )
      return false;
    if (track.album && comparisonKey(track.album) !== comparisonKey(hit.album)) return false;
    if (track.durationSeconds && hit.durationSeconds) {
      if (Math.abs(track.durationSeconds - hit.durationSeconds) > 3) return false;
      if (track.album && model.recordingMatch(current, candidate) <= 0) return false;
    } else if (track.durationSeconds || hit.durationSeconds) {
      return false;
    }
    return true;
  }

  async function fetchDocument(isrc, signal) {
    const url = `${ORIGIN}/s/${encodeURIComponent(isrc)}.ttml`;
    const response = await requestText(url, "application/ttml+xml, application/xml;q=0.9, text/xml;q=0.8", signal);
    if (response.status !== "ok") return response;
    return fromTTML(response.text, isrc);
  }

  async function fetchRecordingMetadata(isrc, signal) {
    const url = `${ORIGIN}/s/${encodeURIComponent(isrc)}.json`;
    const response = await requestText(url, "application/json", signal);
    if (response.status !== "ok") return response;
    try {
      const payload = JSON.parse(response.text);
      const hit = normalizeHit({
        ...payload,
        isrc: payload?.isrc || isrc,
        title: payload?.title || payload?.trackName || payload?.name,
        artist: payload?.artist || payload?.artistName,
        album: payload?.album || payload?.albumName,
        duration: payload?.duration ?? payload?.durationSeconds,
      });
      return hit && hasHitMetadata(hit)
        ? { status: "ok", hit }
        : { status: "error", reason: "invalid-recording-metadata" };
    } catch {
      return { status: "error", reason: "invalid-recording-metadata" };
    }
  }

  async function findMatch(track, signal) {
    if (!track.title || !track.artist) return { status: "not-found" };
    const url = new URL("/match.json", ORIGIN);
    url.searchParams.set("track", track.title);
    url.searchParams.set("artist", track.artist);
    if (track.album) url.searchParams.set("album", track.album);
    if (track.durationSeconds) url.searchParams.set("duration", String(track.durationSeconds));

    const response = await requestText(url.href, "application/json", signal);
    if (response.status !== "ok") return response;
    let payload;
    try {
      payload = JSON.parse(response.text);
    } catch {
      return { status: "error", reason: "invalid-json" };
    }
    if (!Array.isArray(payload?.hits)) return { status: "error", reason: "invalid-match-response" };

    const matched = new Map();
    const incomplete = new Map();
    for (const rawHit of payload.hits.slice(0, 100)) {
      const hit = normalizeHit(rawHit);
      if (!hit) continue;
      if (!hasHitMetadata(hit)) incomplete.set(hit.isrc, hit);
      else if (hitMatches(track, hit) && !matched.has(hit.isrc)) matched.set(hit.isrc, hit);
    }
    for (const isrc of matched.keys()) incomplete.delete(isrc);
    if (matched.size > 1 || (matched.size > 0 && incomplete.size > 0))
      return { status: "ambiguous" };
    if (matched.size === 1) return { status: "matched", hit: matched.values().next().value };
    if (incomplete.size === 0) return { status: "not-found" };
    if (incomplete.size > 1) return { status: "ambiguous" };
    const candidate = incomplete.values().next().value;
    const metadata = await fetchRecordingMetadata(candidate.isrc, signal);
    if (signal.aborted || metadata.status === "cancelled") return { status: "cancelled" };
    if (metadata.status !== "ok") return metadata;
    return hitMatches(track, metadata.hit)
      ? { status: "matched", hit: metadata.hit }
      : { status: "not-found" };
  }

  async function lookup(track, signal) {
    if (signal.aborted) return result("cancelled");
    if (!track.isrc && (!track.title || !track.artist)) return result("not-found");

    let hadError = false;
    if (track.isrc) {
      const direct = await fetchDocument(track.isrc, signal);
      if (signal.aborted || direct.status === "cancelled") return result("cancelled");
      if (direct.status === "found") return direct;
      hadError = direct.status === "error";
    }

    const match = await findMatch(track, signal);
    if (signal.aborted || match.status === "cancelled") return result("cancelled");
    if (match.status === "error") return result("error", { reason: match.reason });
    if (match.status === "ambiguous") return result("not-found", { reason: "ambiguous-match" });
    if (match.status !== "matched")
      return hadError ? result("error", { reason: "provider-unavailable" }) : result("not-found");
    if (match.hit.isrc === track.isrc)
      return hadError ? result("error", { reason: "provider-unavailable" }) : result("not-found");

    const lyrics = await fetchDocument(match.hit.isrc, signal);
    if (signal.aborted || lyrics.status === "cancelled") return result("cancelled");
    if (lyrics.status === "found") return lyrics;
    if (lyrics.status === "error") return result("error", { reason: lyrics.reason });
    return result("not-found");
  }

  function cached(key) {
    const entry = cache.get(key);
    if (!entry) return null;
    cache.delete(key);
    cache.set(key, entry);
    return entry.value;
  }

  function remember(key, value) {
    const bytes = value.document.length * 2;
    if (bytes > MAX_CACHE_BYTES) return;
    const previous = cache.get(key);
    if (previous) {
      cacheBytes -= previous.bytes;
      cache.delete(key);
    }
    cache.set(key, { value, bytes });
    cacheBytes += bytes;
    while (cache.size > MAX_CACHE_ENTRIES || cacheBytes > MAX_CACHE_BYTES) {
      const oldestKey = cache.keys().next().value;
      const oldest = cache.get(oldestKey);
      cache.delete(oldestKey);
      cacheBytes -= oldest.bytes;
    }
  }

  function cancelledResult() {
    return result("cancelled");
  }

  function subscribe(entry, signal) {
    if (signal?.aborted) return Promise.resolve(cancelledResult());
    entry.consumers += 1;
    return new Promise((resolve) => {
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        signal?.removeEventListener("abort", onAbort);
        entry.consumers -= 1;
        if (entry.consumers === 0 && !entry.settled) entry.controller.abort();
      };
      const onAbort = () => {
        release();
        resolve(cancelledResult());
      };
      signal?.addEventListener("abort", onAbort, { once: true });
      entry.promise.then((value) => {
        if (signal?.aborted) {
          onAbort();
          return;
        }
        release();
        resolve(value);
      });
    });
  }

  function resolve(input, signal) {
    const track = normalizeTrack(input);
    if (signal?.aborted) return Promise.resolve(cancelledResult());
    if (!track.isrc && (!track.title || !track.artist))
      return Promise.resolve(result("not-found"));
    const fromCache = cached(track.key);
    if (fromCache) return Promise.resolve(fromCache);

    let entry = pending.get(track.key);
    if (!entry || entry.controller.signal.aborted) {
      const controller = new AbortController();
      entry = { controller, consumers: 0, settled: false, promise: null };
      pending.set(track.key, entry);
      entry.promise = Promise.resolve()
        .then(() => lookup(track, controller.signal))
        .catch(() => result("error", { reason: "unexpected" }))
        .then((value) => {
          entry.settled = true;
          if (value.status === "found" && !controller.signal.aborted) remember(track.key, value);
          return value;
        })
        .finally(() => {
          if (pending.get(track.key) === entry) pending.delete(track.key);
        });
    }
    return subscribe(entry, signal);
  }

  const api = Object.freeze({ resolve });
  root.LyricsRepository = api;
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);
