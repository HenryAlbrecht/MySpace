"use strict";

const assert = require("node:assert/strict");

module.exports = async function ({ page, externalRequests, setAuditPhase, setLyricsMockMode }) {
  const capacityBytes = 8 * 1024;
  const storedAt = 1_700_000_000_000;
  const recordingId = (index) => `GBPRS${String(index).padStart(7, "0")}`;
  const track = (index) => ({
    identity: `ytmusic:video:press${String(index).padStart(6, "0")}`,
    isrc: recordingId(index),
    title: `Pressure ${String.fromCharCode(64 + index)}`,
    artist: "Retention Fixture",
    album: "Pressure Test",
    durationMs: 180000,
  });
  const tracks = [track(1), track(2), track(3), track(4)];
  const requestsFor = (phase) =>
    externalRequests.filter(
      (request) => request.phase === phase && new URL(request.origin).hostname === "lrc.red",
    );
  const storageState = () =>
    page.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const request = indexedDB.open("myspace-lyrics");
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const database = request.result;
            const transaction = database.transaction(["documents", "metadata"], "readonly");
            const recordsRequest = transaction.objectStore("documents").getAll();
            const usageRequest = transaction.objectStore("metadata").get("usage");
            let records = [];
            let usage = null;
            recordsRequest.onsuccess = () => (records = recordsRequest.result || []);
            usageRequest.onsuccess = () => (usage = usageRequest.result || null);
            transaction.oncomplete = () => {
              database.close();
              resolve({ records, usage });
            };
            transaction.onerror = () => reject(transaction.error);
          };
        }),
    );
  const assertLedger = async () => {
    const state = await storageState();
    assert.ok(state.usage, "the aggregate usage ledger exists");
    assert.equal(
      state.usage.bytes,
      state.records.reduce(
        (sum, record) => sum + new TextEncoder().encode(JSON.stringify(record)).length,
        0,
      ),
      "the usage ledger matches the serialized stored records",
    );
    return state;
  };
  const recordsById = (state) =>
    state.records.slice().sort((a, b) => a.recordingId.localeCompare(b.recordingId));
  const clearStorage = () =>
    page.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const request = indexedDB.open("myspace-lyrics");
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const database = request.result;
            const transaction = database.transaction(["documents", "metadata"], "readwrite");
            transaction.objectStore("documents").clear();
            transaction.objectStore("metadata").put({ key: "usage", bytes: 0 });
            transaction.oncomplete = () => {
              database.close();
              resolve();
            };
            transaction.onerror = () => reject(transaction.error);
          };
        }),
    );
  const insert = (input, failLedgerWrite = false) =>
    page.evaluate(
      async ({ input: value, failLedgerWrite: shouldFail, storedAt: timestamp }) => {
        const originalNow = Date.now;
        const prototype = IDBObjectStore.prototype;
        const descriptor = shouldFail ? Object.getOwnPropertyDescriptor(prototype, "put") : null;
        Date.now = () => timestamp;
        if (descriptor)
          Object.defineProperty(prototype, "put", {
            ...descriptor,
            value(record, ...args) {
              if (this.name === "metadata" && record?.key === "usage")
                throw new DOMException("Falha de ledger simulada", "UnknownError");
              return descriptor.value.call(this, record, ...args);
            },
          });
        try {
          return await LyricsRepository.resolve(value);
        } finally {
          Date.now = originalNow;
          if (descriptor) Object.defineProperty(prototype, "put", descriptor);
        }
      },
      { input, failLedgerWrite, storedAt },
    );

  await page.waitForFunction(() => Boolean(window.LyricsRepository));
  setAuditPhase("retention-prepare");
  setLyricsMockMode("network-error");
  assert.equal((await page.evaluate(() => LyricsRepository.resolve({
    isrc: "GBPRS0000098",
    title: "Retention Database Bootstrap",
  }))).status, "error");
  await clearStorage();
  assert.deepEqual((await assertLedger()).records, []);

  setLyricsMockMode("retention-document:2600");
  setAuditPhase("retention-near-capacity");
  for (const input of tracks.slice(0, 2)) assert.equal((await insert(input)).status, "found");
  const nearCapacity = await assertLedger();
  assert.ok(nearCapacity.usage.bytes > capacityBytes * 0.65);
  assert.ok(nearCapacity.usage.bytes < capacityBytes);
  assert.deepEqual(
    nearCapacity.records.map((record) => record.recordingId).sort(),
    tracks.slice(0, 2).map((item) => item.isrc).sort(),
    "records fit before the pressure threshold is crossed",
  );

  setAuditPhase("retention-transaction-abort");
  assert.equal((await insert(tracks[2], true)).status, "found");
  const afterAbort = await assertLedger();
  assert.equal(afterAbort.usage.bytes, nearCapacity.usage.bytes);
  assert.deepEqual(
    recordsById(afterAbort),
    recordsById(nearCapacity),
    "a failed transaction leaves all previous record contents untouched",
  );
  assert.deepEqual(
    afterAbort.records.map((record) => record.recordingId).sort(),
    tracks.slice(0, 2).map((item) => item.isrc).sort(),
    "a failed ledger write rolls back both eviction and insertion",
  );

  setAuditPhase("retention-retry-after-abort");
  await page.reload();
  await page.waitForFunction(() => Boolean(window.LyricsRepository));
  setAuditPhase("retention-first-eviction");
  assert.equal((await insert(tracks[2])).status, "found");
  const afterFirstEviction = await assertLedger();
  assert.ok(afterFirstEviction.usage.bytes <= capacityBytes);
  assert.deepEqual(
    afterFirstEviction.records.map((record) => record.recordingId).sort(),
    tracks.slice(1, 3).map((item) => item.isrc).sort(),
    "equal timestamps evict by recording ID and retain the new record",
  );

  setAuditPhase("retention-second-eviction");
  assert.equal((await insert(tracks[3])).status, "found");
  const afterSecondEviction = await assertLedger();
  assert.ok(afterSecondEviction.usage.bytes <= capacityBytes);
  assert.deepEqual(
    afterSecondEviction.records.map((record) => record.recordingId).sort(),
    tracks.slice(2, 4).map((item) => item.isrc).sort(),
    "repeated pressure evicts the next oldest record deterministically",
  );

  setAuditPhase("retention-reopen");
  setLyricsMockMode("network-error");
  await page.reload();
  await page.waitForFunction(() => Boolean(window.LyricsRepository));
  const reloaded = await assertLedger();
  assert.equal(reloaded.usage.bytes, afterSecondEviction.usage.bytes);
  for (const input of tracks.slice(2, 4))
    assert.equal(
      (await page.evaluate((value) => LyricsRepository.resolve(value), input)).status,
      "found",
      "retained records remain available after reopening IndexedDB",
    );
  assert.deepEqual(requestsFor("retention-reopen"), [], "reloaded retained lyrics stay offline");

  setAuditPhase("retention-indexed-reads");
  const indexedReads = await page.evaluate(async (inputs) => {
    const prototype = IDBObjectStore.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "getAll");
    let fullScans = 0;
    Object.defineProperty(prototype, "getAll", {
      ...descriptor,
      value(...args) {
        fullScans += 1;
        return descriptor.value.apply(this, args);
      },
    });
    try {
      const results = await Promise.all(inputs.map((input) => LyricsRepository.resolve(input)));
      return { statuses: results.map((result) => result.status), fullScans };
    } finally {
      Object.defineProperty(prototype, "getAll", descriptor);
    }
  }, tracks.slice(2, 4));
  assert.deepEqual(indexedReads, { statuses: ["found", "found"], fullScans: 0 });

  setAuditPhase("retention-refetch-evicted");
  setLyricsMockMode("matched");
  const refetched = await page.evaluate((input) => LyricsRepository.resolve(input), tracks[0]);
  assert.equal(refetched.status, "found", "an evicted lyric can be fetched again online");
  assert.deepEqual(
    requestsFor("retention-refetch-evicted").map((request) => request.path),
    [`/s/${tracks[0].isrc}.ttml`],
  );
  await assertLedger();

  setAuditPhase("retention-single-oversize");
  setLyricsMockMode("retention-document:9000");
  const beforeOversize = await assertLedger();
  const oversize = await page.evaluate((input) => LyricsRepository.resolve(input), {
    ...track(99),
    title: "Oversized Lyric Document",
  });
  assert.equal(oversize.status, "found", "a valid online lyric works even when too large to store");
  const afterOversize = await assertLedger();
  assert.deepEqual(
    afterOversize.records.map((record) => record.recordingId).sort(),
    beforeOversize.records.map((record) => record.recordingId).sort(),
    "a single document above the test capacity is not stored and does not evict other lyrics",
  );
  assert.equal(afterOversize.usage.bytes, beforeOversize.usage.bytes);
};
