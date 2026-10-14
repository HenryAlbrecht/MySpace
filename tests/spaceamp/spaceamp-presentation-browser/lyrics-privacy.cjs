"use strict";

const assert = require("node:assert/strict");

module.exports = async function ({
  page,
  toggle,
  errors,
  externalRequests,
  externalRequestCompletions,
  externalRequestFailures,
  setAuditPhase,
  setLyricsMockMode,
}) {
  const allowedHosts = new Set(["lrc.red", "translate.googleapis.com"]);
  const lyricsRequests = () =>
    externalRequests.filter((request) => allowedHosts.has(new URL(request.origin).hostname));
  const waitForAuditRequest = async (predicate, timeoutMs = 5000) => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const request = externalRequests.find(predicate);
      if (request) return request;
      await page.waitForTimeout(10);
    }
    throw Error("Timed out waiting for a mocked lrc.red request");
  };
  const waitForLyrics = (loaded) =>
    page.waitForFunction(
      (loaded) => {
        const component = document.querySelector("am-lyrics");
        if (!component || component.isLoading) return false;
        return loaded
          ? Array.isArray(component.lyrics) && component.lyrics.length > 0
          : component.hasFetchedAllProviders === true;
      },
      loaded,
      { timeout: 10000 },
    );
  const setTrack = (title, isrc = "") =>
    page.evaluate(
      ({ title, isrc }) => {
        const track = {
          kind: "music",
          catalogId: `ytmusic:video:privacy-${title}`,
          title,
          artist: "Fixture Artist",
          albumTitle: "Fixture Album",
          source: "YouTube Music",
          sourceUrl: `ytmusic:video:privacy-${title}`,
          artwork: "profile-art.png",
        };
        if (isrc) track.isrc = isrc;
        SPACEAMP.update(track, true, { available: true });
      },
      { title, isrc },
    );
  const open = () => page.evaluate(() => SpaceAmpNowPlaying.open());
  const close = () => page.evaluate(() => SpaceAmpNowPlaying.close());
  const countRequests = () => lyricsRequests().length;

  setAuditPhase("boot-idle");
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => Boolean(window.LyricsRepository)), true);
  assert.deepEqual(lyricsRequests(), [], "no lyrics lookup runs before Now Playing opens");

  setLyricsMockMode("matched");
  setAuditPhase("closed-track");
  await setTrack("Direct ISRC Song", "USABC0000001");
  assert.equal(countRequests(), 0, "playback alone does not query lyrics");
  await open();
  await waitForLyrics(true);
  let phaseRequests = lyricsRequests().filter((request) => request.phase === "closed-track");
  assert.deepEqual(
    phaseRequests.map((request) => request.path),
    ["/s/USABC0000001.ttml"],
    "a known ISRC is fetched directly before any metadata matching",
  );
  assert.equal(await page.locator("am-lyrics").getAttribute("provided-content-only"), "");
  assert.equal(await page.locator("am-lyrics").getAttribute("provided-source"), "lrc.red");
  assert.equal(await page.locator("am-lyrics").getAttribute("isrc"), null);
  assert.equal(await page.locator("am-lyrics").getAttribute("query"), null);
  assert.equal(
    await page.locator("am-lyrics").evaluate((component) => component.lyricsSource),
    "lrc.red",
  );
  assert.equal(
    await page.locator("am-lyrics").evaluate((component) => component.lyrics.length),
    2,
    "the original validated TTML reaches the renderer",
  );

  setAuditPhase("pause-resume");
  const beforeTransport = countRequests();
  await page.evaluate(() => {
    SPACEAMP.pause();
    SPACEAMP.play();
  });
  await page.waitForTimeout(100);
  assert.equal(countRequests(), beforeTransport, "pause and resume do not refetch lyrics");

  setAuditPhase("isrc-mismatch");
  setLyricsMockMode("fallback");
  await setTrack("Fallback Song", "JPK652300130");
  await waitForLyrics(false);
  phaseRequests = lyricsRequests().filter((request) => request.phase === "isrc-mismatch");
  assert.deepEqual(
    phaseRequests.map((request) => request.path),
    ["/s/JPK652300130.ttml", "/match.json"],
    "metadata matching is attempted after a direct miss, but a different ISRC is rejected",
  );
  const matchRequest = phaseRequests.find((request) => request.path === "/match.json");
  assert.deepEqual(Object.keys(matchRequest.query).sort(), ["album", "artist", "duration", "track"]);
  assert.deepEqual(matchRequest.query, {
    track: "Fallback Song",
    artist: "Fixture Artist",
    album: "Fixture Album",
    duration: "180",
  });

  setAuditPhase("deduplicated-lookup");
  setLyricsMockMode("matched");
  const beforeDeduplicatedLookup = countRequests();
  const sharedResults = await page.evaluate(async () => {
    const track = {
      identity: "local-only-dedup-key",
      title: "Shared Repository Lookup",
      artist: "Fixture Artist",
      album: "Fixture Album",
      durationMs: 180000,
    };
    return Promise.all([
      LyricsRepository.resolve(track),
      LyricsRepository.resolve(track),
    ]);
  });
  assert.deepEqual(sharedResults.map((result) => result.status), ["found", "found"]);
  phaseRequests = lyricsRequests().filter((request) => request.phase === "deduplicated-lookup");
  assert.deepEqual(
    phaseRequests.map((request) => request.path),
    ["/match.json", "/s/USABC0000002.ttml"],
    "identical concurrent repository lookups share one request chain",
  );
  await page.evaluate(() =>
    LyricsRepository.resolve({
      identity: "local-only-dedup-key",
      title: "Shared Repository Lookup",
      artist: "Fixture Artist",
      album: "Fixture Album",
      durationMs: 200000,
    }),
  );
  assert.equal(countRequests(), beforeDeduplicatedLookup + 2, "TTML cache ignores duration-only changes");

  setAuditPhase("metadata-only-hit");
  setLyricsMockMode("metadata-only");
  await setTrack("Metadata Only Song");
  await waitForLyrics(true);
  phaseRequests = lyricsRequests().filter((request) => request.phase === "metadata-only-hit");
  assert.deepEqual(
    phaseRequests.map((request) => request.path),
    ["/match.json", "/s/USABC0000002.json", "/s/USABC0000002.ttml"],
    "a unique identifier-only hit is checked against recording metadata before downloading lyrics",
  );

  setAuditPhase("ambiguous-hit");
  setLyricsMockMode("ambiguous");
  await setTrack("Ambiguous Song");
  await waitForLyrics(false);
  phaseRequests = lyricsRequests().filter((request) => request.phase === "ambiguous-hit");
  assert.deepEqual(phaseRequests.map((request) => request.path), ["/match.json"]);
  assert.match(await page.locator(".np-status").textContent(), /indisponíveis/i);

  setAuditPhase("no-match");
  setLyricsMockMode("no-match");
  await setTrack("Missing Song");
  await waitForLyrics(false);
  assert.deepEqual(
    lyricsRequests()
      .filter((request) => request.phase === "no-match")
      .map((request) => request.path),
    ["/match.json"],
  );

  setAuditPhase("invalid-ttml");
  setLyricsMockMode("invalid-ttml");
  await setTrack("Invalid TTML Song", "USABC0000004");
  await waitForLyrics(false);
  phaseRequests = lyricsRequests().filter((request) => request.phase === "invalid-ttml");
  assert.deepEqual(phaseRequests.map((request) => request.path), ["/s/USABC0000004.ttml", "/match.json"]);

  setAuditPhase("provider-error");
  setLyricsMockMode("provider-error");
  await setTrack("Unavailable Service Song");
  await waitForLyrics(false);
  assert.match(await page.locator(".np-status").textContent(), /não foi possível consultar/i);

  setAuditPhase("network-error");
  setLyricsMockMode("network-error");
  await setTrack("Network Failure Song");
  await waitForLyrics(false);
  assert.match(await page.locator(".np-status").textContent(), /não foi possível consultar/i);

  setAuditPhase("timeout");
  setLyricsMockMode("timeout");
  await setTrack("Timed Out Song");
  const timedOutRequest = await waitForAuditRequest(
    (request) => request.phase === "timeout" && request.path === "/match.json",
  );
  await waitForLyrics(false);
  await page.waitForTimeout(600);
  assert.equal(timedOutRequest.state, "cancelled", "the Repository enforces its request timeout");

  setAuditPhase("pending-close");
  setLyricsMockMode("pending");
  await setTrack("Pending Close Song");
  const pendingRequest = await waitForAuditRequest(
    (request) => request.phase === "pending-close" && request.path === "/match.json",
  );
  assert.equal(await page.locator("am-lyrics").getAttribute("provided-content-only"), "");
  assert.equal(await page.locator("am-lyrics").getAttribute("isrc"), null);
  assert.equal(
    lyricsRequests().filter((request) => request.phase === "pending-close").length,
    1,
    "while Repository lookup is pending, the renderer starts no provider requests",
  );
  await close();
  await page.waitForFunction(() => !document.querySelector("#spaceampNowPlaying[open]"));
  await page.waitForTimeout(50);
  assert.equal(pendingRequest.state, "cancelled", "closing Now Playing aborts the lookup");

  setAuditPhase("reopen-retry");
  setLyricsMockMode("matched");
  await open();
  await waitForLyrics(true);
  assert.ok(lyricsRequests().some((request) => request.phase === "reopen-retry"));

  setAuditPhase("cached-reopen");
  const beforeCachedReopen = countRequests();
  await close();
  await open();
  await waitForLyrics(true);
  assert.equal(countRequests(), beforeCachedReopen, "successful TTML is reused from memory");

  setAuditPhase("lyrics-disabled");
  const beforeDisabled = countRequests();
  await toggle.click();
  await setTrack("Changed With Lyrics Off");
  await page.waitForTimeout(100);
  assert.equal(await page.locator("am-lyrics").count(), 0);
  assert.equal(countRequests(), beforeDisabled, "Lyrics OFF suppresses Repository lookups");

  setAuditPhase("enabled-again");
  setLyricsMockMode("matched");
  await toggle.click();
  await waitForLyrics(true);
  assert.ok(lyricsRequests().some((request) => request.phase === "enabled-again"));

  setAuditPhase("stale-track");
  setLyricsMockMode("pending");
  await setTrack("Stale Previous Song");
  const staleRequest = await waitForAuditRequest(
    (request) => request.phase === "stale-track" && request.path === "/match.json",
  );
  setLyricsMockMode("matched");
  await setTrack("Current Song");
  await page.waitForFunction(
    () => document.querySelector("am-lyrics")?.getAttribute("song-title") === "Current Song",
  );
  await waitForLyrics(true);
  assert.equal(staleRequest.state, "cancelled", "track changes abort stale lookups");
  assert.equal(await page.locator("am-lyrics").getAttribute("song-title"), "Current Song");

  setAuditPhase("optional-translation");
  setLyricsMockMode("matched");
  await setTrack("Japanese Fixture Song", "USABC0000005");
  await waitForLyrics(true);
  assert.equal(
    lyricsRequests().some(
      (request) => request.phase === "optional-translation" && request.origin.includes("google"),
    ),
    false,
    "Google Translate is unused until romanization or translation is requested",
  );
  await page.locator("am-lyrics").evaluate(async (component) => {
    component.showRomanization = true;
    component.showTranslation = true;
    await Promise.all([component.applyRomanization(), component.applyTranslation()]);
  });
  await page.waitForFunction(
    () =>
      window.__lyricsAuditFetches.some(
        (request) => new URL(request.url).hostname === "translate.googleapis.com",
      ),
  );

  assert.equal(
    lyricsRequests().every((request) => allowedHosts.has(new URL(request.origin).hostname)),
    true,
    "the MySpace flow contacts only lrc.red and optional Google Translate",
  );
  const retiredProviderHosts = new Set([
    "lyrics-api.binimum.org",
    "lyricsplus.binimum.org",
    "lyricsplus-seven.vercel.app",
    "lyricsplus.prjktla.workers.dev",
    "lyrics-plus-backend.vercel.app",
    "unison.boidu.dev",
    "lrclib.net",
    "fetch-genius.samidy.workers.dev",
  ]);
  assert.equal(
    externalRequests.some((request) => retiredProviderHosts.has(new URL(request.origin).hostname)),
    false,
    "providers owned by am-lyrics are not queried by the MySpace flow",
  );
  assert.equal(
    externalRequests.some((request) => request.origin === "https://untrusted.fixture"),
    false,
    "a lyricsUrl returned by lrc.red is never followed",
  );
  assert.equal(lyricsRequests().every((request) => request.method === "GET" && !request.hasBody), true);
  assert.equal(lyricsRequests().some((request) => request.hasCookie || request.hasAuthorization), false);
  assert.equal(lyricsRequests().every((request) => request.referer === null), true);
  const fetchOptions = await page.evaluate(() => window.__lyricsAuditFetches);
  assert.ok(fetchOptions.length > 0);
  assert.equal(fetchOptions.every((request) => request.credentials === "omit"), true);
  assert.equal(fetchOptions.every((request) => request.referrerPolicy === "no-referrer"), true);
  assert.equal(
    fetchOptions
      .filter((request) => new URL(request.url).hostname === "lrc.red")
      .every((request) => request.redirect === "error"),
    true,
  );
  assert.equal(
    externalRequestFailures.some((request) => /ABORT|CANCEL/i.test(request.failure)),
    true,
    "the request audit observes cancellation rather than completing stale requests",
  );
  assert.ok(externalRequestCompletions.length > 0);
  assert.deepEqual(errors, []);
  console.log(
    "Lyrics Repository privacy mock: " +
      JSON.stringify({
        destinations: [...new Set(lyricsRequests().map((request) => request.origin))].sort(),
        cancelledRequests: lyricsRequests().filter((request) => request.state === "cancelled")
          .length,
        completedRequests: lyricsRequests().filter((request) => request.state === "completed")
          .length,
        credentialsOmitted: fetchOptions.every((request) => request.credentials === "omit"),
        arbitraryLyricsUrlsStarted: externalRequests.some(
          (request) => request.origin === "https://untrusted.fixture",
        ),
      }),
  );
};
