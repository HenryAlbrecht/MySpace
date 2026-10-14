"use strict";

const assert = require("node:assert/strict");

module.exports = async function ({
  page,
  errors,
  externalRequests,
  setAuditPhase,
  setLyricsMockMode,
}) {
  const track = (
    identity,
    title,
    artist = "Offline Artist",
    album = "Offline Album",
    durationMs = 180000,
  ) => ({ identity, title, artist, album, durationMs });
  const canonicalTrack = track("ytmusic:video:offlin00001", "Persisted Song");
  const requestsFor = (phase) =>
    externalRequests.filter(
      (request) => request.phase === phase && new URL(request.origin).hostname === "lrc.red",
    );
  const resolve = (value) => page.evaluate((input) => LyricsRepository.resolve(input), value);
  const records = () =>
    page.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const request = indexedDB.open("myspace-lyrics");
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains("documents")) {
              database.close();
              resolve([]);
              return;
            }
            const transaction = database.transaction("documents", "readonly");
            const query = transaction.objectStore("documents").getAll();
            query.onsuccess = () => resolve(query.result || []);
            query.onerror = () => reject(query.error);
            transaction.oncomplete = () => database.close();
            transaction.onerror = () => reject(transaction.error);
          };
        }),
    );

  await page.waitForFunction(() => Boolean(window.LyricsRepository));
  setAuditPhase("offline-storage-unavailable");
  setLyricsMockMode("matched");
  const storageDescriptor = await page.evaluate(() => {
    const prototype = IDBFactory.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "open");
    window.__nativeLyricsIDBOpenDescriptor = descriptor;
    Object.defineProperty(prototype, "open", {
      ...descriptor,
      value() {
        throw new Error("IndexedDB indisponível para o teste");
      },
    });
    return { configurable: descriptor.configurable, writable: descriptor.writable };
  });
  assert.ok(storageDescriptor.configurable || storageDescriptor.writable);
  const onlineWithoutStorage = await resolve(
    track("ytmusic:video:offline00001", "Online Without Storage"),
  );
  await page.evaluate(() => {
    Object.defineProperty(IDBFactory.prototype, "open", window.__nativeLyricsIDBOpenDescriptor);
    delete window.__nativeLyricsIDBOpenDescriptor;
  });
  assert.equal(
    onlineWithoutStorage.status,
    "found",
    "an unavailable database does not block online lyrics",
  );
  assert.deepEqual(
    requestsFor("offline-storage-unavailable").map((request) => request.path),
    ["/match.json", "/s/USABC0000002.ttml"],
  );

  setAuditPhase("offline-save");
  const saved = await resolve(canonicalTrack);
  assert.equal(saved.status, "found");
  const stored = await records();
  assert.equal(stored.length, 1, "one recording is stored once by the matched ISRC");
  assert.equal(stored[0].schemaVersion, 1);
  assert.equal(stored[0].provider, "lrc.red");
  assert.equal(stored[0].recordingId, "USABC0000002");
  assert.equal(stored[0].document, saved.document);
  assert.deepEqual(Object.keys(stored[0]).sort(), [
    "byteLength",
    "createdAt",
    "document",
    "provider",
    "recordingId",
    "schemaVersion",
    "snapshots",
    "storedAt",
  ]);
  assert.deepEqual(stored[0].snapshots[0], {
    identity: "ytmusic:video:offlin00001",
    isrc: "",
    title: "Persisted Song",
    artist: "Offline Artist",
    album: "Offline Album",
    durationSeconds: 180,
    variants: "",
  });
  assert.equal("sourceUrl" in stored[0].snapshots[0], false);

  setAuditPhase("offline-invalid");
  setLyricsMockMode("invalid-ttml");
  const invalid = await resolve({
    ...canonicalTrack,
    identity: "ytmusic:video:invalid0001",
    isrc: "USABC0000004",
    title: "Invalid Lyrics",
  });
  assert.notEqual(invalid.status, "found");
  assert.equal(
    (await records()).some((record) => record.recordingId === "USABC0000004"),
    false,
    "invalid TTML is never persisted",
  );

  setAuditPhase("offline-reload");
  setLyricsMockMode("network-error");
  await page.reload();
  await page.waitForFunction(() => Boolean(window.LyricsRepository));
  await page.evaluate((input) => {
    SPACEAMP.update(
      {
        kind: "music",
        catalogId: input.identity,
        title: input.title,
        artist: input.artist,
        albumTitle: input.album,
        trackDuration: input.durationMs / 1000,
        source: "YouTube Music",
        sourceUrl: input.identity,
        artwork: "offline-fixture.png",
      },
      true,
      { available: true },
    );
    SpaceAmpNowPlaying.open();
  }, canonicalTrack);
  await page.waitForFunction(
    () => document.querySelector("am-lyrics")?.getAttribute("ttml")?.includes("恋人へ"),
  );
  assert.equal(
    await page.locator("am-lyrics").evaluate((component) => component.lyrics.length > 0),
    true,
  );
  assert.match(await page.locator(".np-status").textContent(), /Letras sincronizadas/i);
  assert.deepEqual(
    requestsFor("offline-reload"),
    [],
    "a valid local copy prevents an lrc.red lookup",
  );

  setAuditPhase("offline-enriched-identity");
  const enrichedIdentity = await resolve({
    ...canonicalTrack,
    title: "Corrected Persisted Song",
  });
  assert.equal(
    enrichedIdentity.status,
    "found",
    "the canonical identity survives metadata enrichment",
  );
  assert.deepEqual(requestsFor("offline-enriched-identity"), []);

  setAuditPhase("offline-identity-collision");
  const otherArtist = await resolve(
    track("ytmusic:video:offlin00002", "Persisted Song", "Other Artist"),
  );
  assert.equal(otherArtist.status, "error");
  assert.deepEqual(
    requestsFor("offline-identity-collision").map((request) => request.path),
    ["/match.json"],
    "a matching title with another artist cannot reuse the saved TTML",
  );

  setAuditPhase("offline-metadata-conflict");
  const otherRelease = await resolve(
    track("ytmusic:video:offlin00003", "Persisted Song", "Offline Artist", "Other Album", 211000),
  );
  assert.equal(otherRelease.status, "error");
  assert.deepEqual(
    requestsFor("offline-metadata-conflict").map((request) => request.path),
    ["/match.json"],
    "a different album and duration cannot reuse a title/artist match",
  );

  setAuditPhase("offline-read-failure");
  setLyricsMockMode("matched");
  const readFailure = await page.evaluate(async (input) => {
    const prototype = IDBObjectStore.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "getAll");
    Object.defineProperty(prototype, "getAll", {
      ...descriptor,
      value() {
        throw new Error("Falha de leitura simulada");
      },
    });
    try {
      return await LyricsRepository.resolve(input);
    } finally {
      Object.defineProperty(prototype, "getAll", descriptor);
    }
  }, track("ytmusic:video:offlin00004", "Read Failure Song"));
  assert.equal(readFailure.status, "found", "a read failure falls through to the online provider");

  setAuditPhase("offline-quota");
  const quotaFailure = await page.evaluate(async (input) => {
    const prototype = IDBObjectStore.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "put");
    Object.defineProperty(prototype, "put", {
      ...descriptor,
      value() {
        throw new DOMException("Quota cheia", "QuotaExceededError");
      },
    });
    try {
      return await LyricsRepository.resolve(input);
    } finally {
      Object.defineProperty(prototype, "put", descriptor);
    }
  }, track("ytmusic:video:offlin00005", "Quota Failure Song"));
  assert.equal(quotaFailure.status, "found", "a quota failure does not discard online lyrics");

  setAuditPhase("offline-cancelled-write");
  setLyricsMockMode("pending-ttml");
  const pendingTrack = {
    ...track("ytmusic:video:offlin00006", "Cancelled Lyrics"),
    isrc: "USABC0000008",
  };
  await page.evaluate((input) => {
    const controller = new AbortController();
    window.__pendingLyricsResolution = LyricsRepository.resolve(input, controller.signal);
    window.__cancelPendingLyrics = () => controller.abort();
  }, pendingTrack);
  await page.waitForFunction(() =>
    window.__lyricsAuditFetches.some((request) => request.url.endsWith("/s/USABC0000008.ttml")),
  );
  await page.evaluate(() => window.__cancelPendingLyrics());
  const cancelled = await page.evaluate(() => window.__pendingLyricsResolution);
  assert.equal(cancelled.status, "cancelled");
  assert.equal(
    (await records()).some((record) => record.recordingId === "USABC0000008"),
    false,
    "an aborted lookup cannot persist a late TTML response",
  );

  await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("myspace-lyrics");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction("documents", "readwrite");
          const store = transaction.objectStore("documents");
          const query = store.get("USABC0000002");
          query.onsuccess = () => {
            const record = query.result;
            record.document = "<not-ttml>";
            store.put(record);
          };
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
      }),
  );
  setAuditPhase("offline-corrupt-record");
  setLyricsMockMode("network-error");
  await page.reload();
  await page.waitForFunction(() => Boolean(window.LyricsRepository));
  const corrupt = await resolve(canonicalTrack);
  assert.equal(
    corrupt.status,
    "error",
    "corrupt TTML is ignored and falls through to the provider",
  );
  assert.deepEqual(
    requestsFor("offline-corrupt-record").map((request) => request.path),
    ["/match.json"],
  );
  assert.deepEqual(errors, []);
};
