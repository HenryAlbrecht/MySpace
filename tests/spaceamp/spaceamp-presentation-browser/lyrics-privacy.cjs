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
  const consoleMessages = [];
  page.on("console", (message) => consoleMessages.push(message.text()));
  const lyricHosts = new Set([
    "lrc.red",
    "lyrics-api.binimum.org",
    "lyricsplus.binimum.org",
    "lyricsplus-seven.vercel.app",
    "lyricsplus.prjktla.workers.dev",
    "lyrics-plus-backend.vercel.app",
    "unison.boidu.dev",
    "lrclib.net",
    "fetch-genius.samidy.workers.dev",
    "translate.googleapis.com",
  ]);
  const lyricsRequests = () =>
    externalRequests.filter((request) => lyricHosts.has(new URL(request.origin).hostname));
  const waitForAuditRequest = async (predicate, timeoutMs = 5000) => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const request = externalRequests.find(predicate);
      if (request) return request;
      await page.waitForTimeout(10);
    }
    throw Error("Timed out waiting for a mocked external lyrics request");
  };
  const waitForLyrics = async (loaded) =>
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
  const setTrack = (title, isrc) =>
    page.evaluate(
      ({ title, isrc }) => {
        const track = {
          title,
          artist: "Fixture Artist",
          albumTitle: "Fixture Album",
          source: "YouTube Music",
          sourceUrl: "ytmusic:video:privacy-audit",
          artwork: "profile-art.png",
        };
        if (isrc) track.isrc = isrc;
        SPACEAMP.update(track, true, { available: true });
      },
      { title, isrc },
    );
  const attemptedFetch = (url) =>
    page.evaluate(
      (url) => window.__lyricsAuditFetches.some((request) => request.url === url),
      url,
    );
  setAuditPhase("boot-idle");
  await page.waitForTimeout(150);
  assert.deepEqual(lyricsRequests(), [], "no lyric provider is queried without a track");

  setAuditPhase("playing-closed");
  await setTrack("Fixture Song", "USFIXTURE0001");
  await page.waitForTimeout(150);
  assert.deepEqual(
    lyricsRequests(),
    [],
    "playback alone does not query lyrics or create a component while Now Playing is closed",
  );
  assert.equal(await page.locator("am-lyrics").count(), 0);

  setAuditPhase("open-no-match");
  await page.evaluate(() => SpaceAmpNowPlaying.open());
  await page.waitForFunction(() => customElements.get("am-lyrics"));
  await waitForLyrics(false);
  const firstSearch = lyricsRequests().filter((request) => request.phase === "open-no-match");
  assert.ok(firstSearch.some((request) => request.origin === "https://lrc.red"));
  assert.ok(firstSearch.some((request) => request.origin === "https://lyrics-api.binimum.org"));
  assert.ok(firstSearch.some((request) => request.origin === "https://unison.boidu.dev"));
  assert.ok(firstSearch.some((request) => request.origin === "https://lrclib.net"));
  assert.ok(
    firstSearch.some((request) => request.origin === "https://fetch-genius.samidy.workers.dev"),
  );
  assert.ok(firstSearch.filter((request) => request.path === "/v2/lyrics/get").length >= 3);
  assert.equal(
    firstSearch.some((request) => request.path.startsWith("/v1/songlist/search")),
    false,
  );
  assert.ok(
    firstSearch.some(
      (request) =>
        request.origin === "https://lrc.red" && request.path === "/s/USFIXTURE0001.ttml",
    ),
  );
  const lrcMatch = firstSearch.find(
    (request) => request.origin === "https://lrc.red" && request.path === "/match.json",
  );
  assert.deepEqual(Object.keys(lrcMatch.query).sort(), ["album", "artist", "duration", "track"]);
  const lyricsPlus = firstSearch.find((request) => request.path === "/v2/lyrics/get");
  assert.deepEqual(Object.keys(lyricsPlus.query).sort(), [
    "album",
    "artist",
    "duration",
    "isrc",
    "title",
  ]);
  assert.deepEqual(
    Object.keys(
      firstSearch.find(
        (request) =>
          request.origin === "https://lyrics-api.binimum.org" && request.query.isrc,
      ).query,
    ).sort(),
    ["isrc"],
  );
  assert.deepEqual(
    Object.keys(
      firstSearch.find(
        (request) =>
          request.origin === "https://lyrics-api.binimum.org" && request.query.track,
      ).query,
    ).sort(),
    ["album", "artist", "duration", "track"],
  );
  assert.deepEqual(
    Object.keys(
      firstSearch.find((request) => request.origin === "https://unison.boidu.dev").query,
    ).sort(),
    ["album", "artist", "duration", "song"],
  );
  assert.deepEqual(
    Object.keys(
      firstSearch.find((request) => request.origin === "https://lrclib.net").query,
    ).sort(),
    ["q"],
  );
  assert.deepEqual(
    Object.keys(
      firstSearch.find(
        (request) => request.origin === "https://fetch-genius.samidy.workers.dev",
      ).query,
    ).sort(),
    ["artist", "title"],
  );
  assert.equal(firstSearch.every((request) => request.method === "GET"), true);
  assert.equal(firstSearch.some((request) => request.hasBody), false);
  assert.equal(firstSearch.some((request) => request.hasCookie), false);
  assert.equal(firstSearch.some((request) => request.hasAuthorization), false);
  assert.equal(firstSearch.every((request) => request.referer === null), true);
  assert.equal(
    firstSearch.every((request) => request.state !== "initiated"),
    true,
    JSON.stringify(firstSearch.map(({ origin, path, state }) => ({ origin, path, state }))),
  );
  const uniqueProviderRequests = new Set(
    firstSearch.map((request) => JSON.stringify([request.origin, request.path, request.query])),
  );
  assert.equal(
    uniqueProviderRequests.size,
    firstSearch.length,
    "a no-match lookup does not repeat a request to the same destination",
  );
  const firstSearchFetchOptions = await page.evaluate(() =>
    window.__lyricsAuditFetches.filter((request) =>
      [
        "lrc.red",
        "lyrics-api.binimum.org",
        "lyricsplus.binimum.org",
        "lyricsplus-seven.vercel.app",
        "lyricsplus.prjktla.workers.dev",
        "lyrics-plus-backend.vercel.app",
        "unison.boidu.dev",
        "lrclib.net",
        "fetch-genius.samidy.workers.dev",
      ].includes(new URL(request.url).hostname),
    ),
  );
  assert.ok(firstSearchFetchOptions.length > 0);
  assert.equal(firstSearchFetchOptions.every((request) => request.credentials === "omit"), true);
  assert.equal(
    firstSearchFetchOptions.every((request) => request.referrerPolicy === "no-referrer"),
    true,
  );
  assert.equal(firstSearchFetchOptions.every((request) => request.redirect === "follow"), true);

  setAuditPhase("pause-resume");
  const beforeTransport = externalRequests.length;
  await page.evaluate(() => {
    SPACEAMP.pause();
    SPACEAMP.play();
  });
  await page.waitForTimeout(100);
  assert.equal(externalRequests.length, beforeTransport, "pause and resume do not refetch lyrics");

  setAuditPhase("disabled-track");
  await toggle.click();
  assert.equal(await toggle.getAttribute("aria-pressed"), "false");
  assert.equal(
    await page.locator("am-lyrics").count(),
    0,
    "Lyrics OFF removes the active component",
  );
  const beforeDisabledTrack = externalRequests.length;
  const fetchesBeforeDisabledTrack = await page.evaluate(() => window.__lyricsAuditFetches.length);
  await setTrack("Fixture Song With Lyrics Disabled", "USFIXTURE0002");
  await page.waitForTimeout(200);
  assert.equal(
    externalRequests.length,
    beforeDisabledTrack,
    "Lyrics OFF does not start provider lookups",
  );
  assert.equal(
    await page.evaluate(() => window.__lyricsAuditFetches.length),
    fetchesBeforeDisabledTrack,
  );
  assert.equal(await page.locator("am-lyrics").count(), 0);

  setLyricsMockMode("no-match");
  setAuditPhase("enabled-again");
  await toggle.click();
  assert.equal(await toggle.getAttribute("aria-pressed"), "true");
  await waitForLyrics(false);
  assert.ok(lyricsRequests().some((request) => request.phase === "enabled-again"));

  const urlCases = [
    { url: "https://untrusted.fixture/remote.ttml", allowed: false },
    { url: "https://lrc.red/secondary.ttml", allowed: true },
    { url: "https://lyrics-api.binimum.org/secondary.ttml", allowed: true },
    { url: "http://lrc.red/secondary.ttml", allowed: false },
    { url: "data:text/plain,lyrics", allowed: false },
    { url: "javascript:alert(1)", allowed: false },
    { url: "file:///C:/lyrics.ttml", allowed: false },
    { url: "blob:https://lrc.red/00000000", allowed: false },
    { url: "//lrc.red/secondary.ttml", allowed: false },
    { url: "https://lrc.red.attacker.fixture/secondary.ttml", allowed: false },
    { url: "https://api.lyrics-api.binimum.org/secondary.ttml", allowed: false },
    { url: "https://user:pass@lrc.red/secondary.ttml", allowed: false },
    { url: "https://lrc.red:8443/secondary.ttml", allowed: false },
    { url: "https://10.0.0.1/secondary.ttml", allowed: false },
    { url: "https://[::1]/secondary.ttml", allowed: false },
    { url: "https://lrc.red:invalid/secondary.ttml", allowed: false },
  ];
  for (let index = 0; index < urlCases.length; index += 1) {
    const candidate = urlCases[index];
    const phase = `lyrics-url-${index}`;
    setLyricsMockMode("lyrics-url:" + candidate.url);
    setAuditPhase(phase);
    await setTrack("Lyrics URL Probe " + index, "USURL" + String(index).padStart(6, "0"));
    await waitForLyrics(candidate.allowed);
    const fetchedCandidate = await attemptedFetch(candidate.url);
    assert.equal(
      fetchedCandidate,
      candidate.allowed,
      `${candidate.url} ${candidate.allowed ? "is fetched" : "is rejected before fetch"}`,
    );
    const browserRequest = externalRequests.find((request) => {
      try {
        const target = new URL(candidate.url);
        return (
          request.phase === phase &&
          request.origin === target.origin &&
          request.path === target.pathname
        );
      } catch {
        return false;
      }
    });
    assert.equal(
      Boolean(browserRequest),
      candidate.allowed,
      `${candidate.url} ${
        candidate.allowed ? "reaches the mocked host" : "does not start a network request"
      }`,
    );
    if (candidate.allowed) {
      assert.equal(browserRequest.state, "completed");
      assert.equal(browserRequest.hasCookie, false);
      assert.equal(browserRequest.hasAuthorization, false);
      const fetchOptions = await page.evaluate((url) => {
        const canonical = new URL(url).href;
        return window.__lyricsAuditFetches.find((request) => request.url === canonical);
      }, candidate.url);
      assert.equal(fetchOptions.credentials, "omit");
      assert.equal(fetchOptions.referrerPolicy, "no-referrer");
      assert.equal(fetchOptions.redirect, "error");
    }
  }

  setLyricsMockMode("lyrics-url:https://lrc.red/redirect.ttml");
  setAuditPhase("lyrics-url-redirect");
  await setTrack("Lyrics Redirect Probe", "USURLREDIRECT");
  await waitForLyrics(false);
  assert.ok(
    externalRequests.some(
      (request) =>
        request.phase === "lyrics-url-redirect" &&
        request.origin === "https://lrc.red" &&
        request.path === "/redirect.ttml",
    ),
  );
  assert.equal(
    externalRequests.some((request) => request.origin === "https://untrusted.fixture"),
    false,
    "redirect:error prevents the allowlisted host redirect from reaching an arbitrary destination",
  );
  assert.equal(
    await attemptedFetch("https://untrusted.fixture/redirected.ttml"),
    false,
  );

  setLyricsMockMode("matched");
  setAuditPhase("translation-romanization");
  await setTrack("Japanese Fixture Song", "USMATCH0002");
  await waitForLyrics(true);
  assert.equal(
    lyricsRequests().some(
      (request) =>
        request.phase === "translation-romanization" &&
        request.origin === "https://translate.googleapis.com",
    ),
    false,
    "translation and romanization do not run until enabled",
  );
  await page.locator("am-lyrics").evaluate(async (component) => {
    component.showRomanization = true;
    await Promise.all([component.applyRomanization(), component.applyRomanization()]);
  });
  await page.waitForFunction(() =>
    document
      .querySelector("am-lyrics")
      ?.lyrics?.every(
        (line) => line.romanizedText || line.text?.some((part) => part.romanizedText),
      ),
  );
  const beforeTranslation = lyricsRequests().filter(
    (request) =>
      request.phase === "translation-romanization" &&
      request.origin === "https://translate.googleapis.com",
  ).length;
  await page.locator("am-lyrics").evaluate(async (component) => {
    component.showTranslation = true;
    await Promise.all([component.applyTranslation(), component.applyTranslation()]);
  });
  await page.waitForFunction(() =>
    document.querySelector("am-lyrics")?.lyrics?.every((line) => line.translation),
  );
  const alternates = lyricsRequests().filter(
    (request) =>
      request.phase === "translation-romanization" &&
      request.origin === "https://translate.googleapis.com",
  );
  assert.ok(alternates.filter((request) => request.query.dt === "rm").length >= 2);
  assert.ok(alternates.some((request) => request.query.dt === "t"));
  assert.equal(alternates.filter((request) => request.query.dt === "t").length, 1);
  assert.equal(
    alternates.length,
    beforeTranslation + 1,
    "parallel translation calls share one request",
  );
  assert.equal(alternates.every((request) => request.method === "GET" && !request.hasBody), true);
  assert.equal(
    alternates.some((request) => request.hasCookie || request.hasAuthorization),
    false,
  );

  setAuditPhase("close-reopen-cached");
  const requestsBeforeCachedReopen = externalRequests.length;
  await page.evaluate(() => SpaceAmpNowPlaying.close());
  await page.evaluate(() => SpaceAmpNowPlaying.open());
  await waitForLyrics(true);
  assert.equal(
    externalRequests.length,
    requestsBeforeCachedReopen,
    "a completed in-memory result is reused when Now Playing reopens",
  );

  setLyricsMockMode("pending-bini");
  setAuditPhase("close-pending");
  await setTrack("Pending During Close", "USFIXTURE0003");
  const closingRequest = await waitForAuditRequest(
    (request) =>
      request.phase === "close-pending" &&
      request.origin === "https://lyrics-api.binimum.org" &&
      request.query.isrc === "USFIXTURE0003",
  );
  const requestsBeforeClose = externalRequests.length;
  const fetchAttemptsBeforeClose = await page.evaluate(() => window.__lyricsAuditFetches.length);
  await page.evaluate(() => SpaceAmpNowPlaying.close());
  await page.waitForTimeout(500);
  assert.equal(
    closingRequest.state,
    "cancelled",
    "closing Now Playing aborts pending provider fetches",
  );
  assert.equal(
    externalRequests.length,
    requestsBeforeClose,
    "no later provider fetch starts after close",
  );
  assert.equal(
    await page.evaluate(() => window.__lyricsAuditFetches.length),
    fetchAttemptsBeforeClose,
    "an already-aborted lifecycle does not call fetch for later fallback providers",
  );
  assert.equal(
    externalRequestCompletions.some((request) => request.id === closingRequest.id),
    false,
  );
  assert.equal(errors.length, 0, "an aborted lookup does not become a page error");

  setLyricsMockMode("matched");
  setAuditPhase("reopen-after-abort");
  const beforeAbortRetry = externalRequests.length;
  await page.evaluate(() => SpaceAmpNowPlaying.open());
  await waitForLyrics(true);
  assert.ok(externalRequests.length > beforeAbortRetry, "reopening retries an interrupted lookup");

  setAuditPhase("closed-track-change");
  await page.evaluate(() => SpaceAmpNowPlaying.close());
  const beforeClosedTrackChange = externalRequests.length;
  const fetchesBeforeClosedTrackChange = await page.evaluate(
    () => window.__lyricsAuditFetches.length,
  );
  await setTrack("Changed While Closed", "USFIXTURECLOSED");
  await page.waitForTimeout(150);
  assert.equal(externalRequests.length, beforeClosedTrackChange);
  assert.equal(
    await page.evaluate(() => window.__lyricsAuditFetches.length),
    fetchesBeforeClosedTrackChange,
  );
  assert.equal(await page.locator("am-lyrics").count(), 0);

  setLyricsMockMode("pending");
  setAuditPhase("rapid-switch-old");
  await page.evaluate(() => SpaceAmpNowPlaying.open());
  const oldRequest = await waitForAuditRequest(
    (request) =>
      request.phase === "rapid-switch-old" &&
      request.origin === "https://lrc.red" &&
      request.path === "/match.json",
  );
  const hasOldComponent = await page.evaluate(() => {
    window.__privacyOldLyrics = document.querySelector("am-lyrics");
    return Boolean(window.__privacyOldLyrics);
  });
  assert.equal(hasOldComponent, true);
  setLyricsMockMode("matched");
  setAuditPhase("rapid-switch-new");
  await setTrack("Rapid Switch Current", "USMATCH0002");
  await waitForLyrics(true);
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => __privacyOldLyrics.isConnected), false);
  assert.equal(await page.locator("am-lyrics").getAttribute("song-title"), "Rapid Switch Current");
  assert.equal(oldRequest.state, "cancelled", "a track change aborts the previous provider fetch");
  assert.equal(
    externalRequestCompletions.some(
      (request) => request.id === oldRequest.id,
    ),
    false,
  );
  assert.equal(await page.evaluate(() => window.__privacyOldLyrics.lyrics?.length || 0), 0);

  setLyricsMockMode("matched");
  setAuditPhase("romanization-log-redaction");
  await setTrack("Japanese Error Probe", "USMATCH0002");
  await waitForLyrics(true);
  setLyricsMockMode("google-error");
  await page.locator("am-lyrics").evaluate(async (component) => {
    component.showRomanization = true;
    await component.applyRomanization();
  });
  assert.equal(
    consoleMessages.some((message) => message.includes("恋人へ") || message.includes("青い空")),
    false,
  );

  setLyricsMockMode("provider-error");
  setAuditPhase("provider-fallback");
  await setTrack("Provider Failure Probe", "USFIXTUREERROR");
  await waitForLyrics(false);
  assert.equal(await page.locator("am-lyrics").count(), 1);
  assert.equal(
    await page.locator("am-lyrics").evaluate((component) => component.hasFetchedAllProviders),
    true,
    "a provider failure settles through the existing no-lyrics fallback",
  );

  setLyricsMockMode("matched");
  setAuditPhase("google-cancel");
  await setTrack("Google Cancel Probe", "USMATCH0002");
  await waitForLyrics(true);
  setLyricsMockMode("google-pending");
  await page.locator("am-lyrics").evaluate((component) => {
    component.showRomanization = true;
    window.__pendingRomanization = component.applyRomanization();
  });
  const googleRequest = await waitForAuditRequest(
    (request) =>
      request.phase === "google-cancel" &&
      request.origin === "https://translate.googleapis.com" &&
      request.query.dt === "rm",
  );
  await page.evaluate(() => SpaceAmpNowPlaying.close());
  await page.waitForTimeout(450);
  await page.evaluate(() => window.__pendingRomanization);
  assert.equal(
    googleRequest.state,
    "cancelled",
    "disconnect aborts pending alternate lyric requests",
  );
  assert.equal(
    externalRequestCompletions.some(
      (request) => request.id === googleRequest.id,
    ),
    false,
  );
  assert.equal(errors.length, 0);
  assert.equal(
    lyricsRequests().some((request) => request.hasCookie || request.hasAuthorization),
    false,
  );
  assert.equal(
    externalRequestFailures.some((request) => /ABORT|CANCEL/i.test(request.failure)),
    true,
    "the request audit distinguishes cancelled requests from completed ones",
  );
  console.log(
    "Lyrics privacy mock: " +
      JSON.stringify({
        destinations: [...new Set(lyricsRequests().map((request) => request.origin))].sort(),
        callsByPhase: Object.fromEntries(
          [...new Set(lyricsRequests().map((request) => request.phase))].map((phase) => [
            phase,
            lyricsRequests().filter((request) => request.phase === phase).length,
          ]),
        ),
        arbitraryLyricsUrlsStarted: externalRequests.some(
          (request) => request.origin === "https://untrusted.fixture",
        ),
        cancelledRequests: lyricsRequests().filter((request) => request.state === "cancelled")
          .length,
        completedRequests: lyricsRequests().filter((request) => request.state === "completed")
          .length,
        providerCallsAreGET: lyricsRequests().every((request) => request.method === "GET"),
        cookieOrAuthorizationObserved: lyricsRequests().some(
          (request) => request.hasCookie || request.hasAuthorization,
        ),
      }),
  );
};
