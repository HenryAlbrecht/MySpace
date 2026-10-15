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
  const storageState = () =>
    page.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const request = indexedDB.open("myspace-lyrics");
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains("documents")) {
              database.close();
              resolve({ records: [], usage: null });
              return;
            }
            const transaction = database.transaction(["documents", "metadata"], "readonly");
            const query = transaction.objectStore("documents").getAll();
            let rows = [];
            let usage = null;
            query.onsuccess = () => (rows = query.result || []);
            query.onerror = () => reject(query.error);
            const usageQuery = transaction.objectStore("metadata").get("usage");
            usageQuery.onsuccess = () => (usage = usageQuery.result || null);
            usageQuery.onerror = () => reject(usageQuery.error);
            transaction.oncomplete = () => {
              database.close();
              resolve({ records: rows, usage });
            };
            transaction.onerror = () => reject(transaction.error);
          };
        }),
    );
  const records = async () => (await storageState()).records;

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

  setAuditPhase("offline-migrate-v1");
  setLyricsMockMode("network-error");
  const legacyTrack = track("ytmusic:video:legacy00001", "Migrated Song");
  await page.evaluate(() =>
    new Promise((resolve, reject) => {
      const request = indexedDB.open("myspace-lyrics", 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        const store = database.createObjectStore("documents", { keyPath: "recordingId" });
        const document =
          '<tt xmlns="http://www.w3.org/ns/ttml"><body><div><p begin="0s" end="3s">恋人へ</p></div></body></tt>';
        store.put({
          schemaVersion: 1,
          recordingId: "USABC0000007",
          provider: "lrc.red",
          document,
          snapshots: [
            {
              identity: "ytmusic:video:legacy00001",
              isrc: "",
              title: "Migrated Song",
              artist: "Offline Artist",
              album: "Offline Album",
              durationSeconds: 180,
              variants: "",
            },
          ],
          createdAt: 1,
          storedAt: 1,
          byteLength: document.length * 2,
        });
      };
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
      request.onerror = () => reject(request.error);
    }),
  );
  const migrated = await resolve(legacyTrack);
  assert.equal(migrated.status, "found", "schema v1 lyrics survive the index migration");
  assert.deepEqual(requestsFor("offline-migrate-v1"), []);
  const migratedRecord = (await records()).find((record) => record.recordingId === "USABC0000007");
  assert.equal(migratedRecord.schemaVersion, 2);

  setAuditPhase("offline-save");
  setLyricsMockMode("matched");
  const saved = await resolve(canonicalTrack);
  assert.equal(saved.status, "found");
  const state = await storageState();
  const stored = state.records;
  assert.equal(stored.length, 2, "the existing and newly matched recordings are both retained");
  const savedRecord = stored.find((record) => record.recordingId === "USABC0000002");
  assert.equal(savedRecord.schemaVersion, 2);
  assert.equal(savedRecord.provider, "lrc.red");
  assert.equal(savedRecord.recordingId, "USABC0000002");
  assert.equal(savedRecord.document, saved.document);
  assert.deepEqual(Object.keys(savedRecord).sort(), [
    "byteLength",
    "createdAt",
    "document",
    "identities",
    "matchKeys",
    "provider",
    "recordingId",
    "schemaVersion",
    "snapshots",
    "storedAt",
  ]);
  assert.deepEqual(savedRecord.snapshots[0], {
    identity: "ytmusic:video:offlin00001",
    isrc: "",
    title: "Persisted Song",
    artist: "Offline Artist",
    album: "Offline Album",
    durationSeconds: 180,
    variants: "",
  });
  assert.equal("sourceUrl" in savedRecord.snapshots[0], false);
  assert.deepEqual(savedRecord.identities, ["ytmusic:video:offlin00001"]);
  assert.equal(savedRecord.matchKeys.length, 1);
  assert.equal(
    state.usage.bytes,
    stored.reduce((sum, record) => sum + new TextEncoder().encode(JSON.stringify(record)).length, 0),
    "the storage ledger counts document and metadata bytes",
  );

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

  setAuditPhase("offline-retention-over-96");
  setLyricsMockMode("matched");
  const retention = await page.evaluate(async () => {
    const store = IDBObjectStore.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(store, "getAll");
    let scans = 0;
    Object.defineProperty(store, "getAll", {
      ...descriptor,
      value(...args) {
        scans += 1;
        return descriptor.value.apply(this, args);
      },
    });
    try {
      for (let index = 0; index < 110; index += 1) {
        const number = String(index).padStart(5, "0");
        const result = await LyricsRepository.resolve({
          identity: `ytmusic:video:retain${number}`,
          isrc: `GBRET${String(index).padStart(7, "0")}`,
          title: `Retention ${index}`,
          artist: "Retention Fixture",
          album: "Retention Fixture Album",
          durationMs: 180000,
        });
        if (result.status !== "found") return { failure: index, scans };
      }
      return { scans };
    } finally {
      Object.defineProperty(store, "getAll", descriptor);
    }
  });
  assert.deepEqual(retention, { scans: 0 }, "ordinary reads and writes do not scan the store");
  const retained = await records();
  assert.equal(
    Array.from({ length: 110 }, (_, index) =>
      retained.some((record) => record.recordingId === `GBRET${String(index).padStart(7, "0")}`),
    ).every(Boolean),
    true,
    "more than 96 valid recordings remain retained under the byte capacity",
  );
  const retentionState = await storageState();
  assert.equal(
    retentionState.usage.bytes,
    retentionState.records.reduce(
      (sum, record) => sum + new TextEncoder().encode(JSON.stringify(record)).length,
      0,
    ),
  );

  setAuditPhase("offline-retention-reload");
  setLyricsMockMode("network-error");
  await page.reload();
  await page.waitForFunction(() => Boolean(window.LyricsRepository));
  const firstRetained = await resolve({
    identity: "ytmusic:video:retain00000",
    isrc: "GBRET0000000",
    title: "Retention 0",
    artist: "Retention Fixture",
    album: "Retention Fixture Album",
    durationMs: 180000,
  });
  assert.equal(firstRetained.status, "found", "the oldest retained lyric remains available offline");
  assert.deepEqual(requestsFor("offline-retention-reload"), []);

  setAuditPhase("offline-read-failure");
  setLyricsMockMode("matched");
  const readFailure = await page.evaluate(async (input) => {
    const prototype = IDBIndex.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(IDBIndex.prototype, "getAll");
    Object.defineProperty(prototype, "getAll", {
      ...descriptor,
      value() {
        throw new Error("Falha de leitura simulada");
      },
    });
    try {
      return await LyricsRepository.resolve(input);
    } finally {
      Object.defineProperty(IDBIndex.prototype, "getAll", descriptor);
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
