const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { matchPlayback, scoreCandidate } = require("../server/music-playback-matcher.cjs");
const target = {
  title: "Heaven Knows I'm Miserable Now",
  artist: "The Smiths",
  albumTitle: "Hatful of Hollow",
  trackDuration: 216,
};
const song = {
  title: target.title,
  artist: target.artist,
  album: target.albumTitle,
  duration: 216,
  videoId: "10z6-vQm23w",
  url: "https://www.youtube.com/watch?v=10z6-vQm23w",
  resultType: "song",
};
test("remaster designation may be on the album while original and live versions stay rejected", () => {
  const album = "(What's The Story) Morning Glory? (Remastered)";
  const track = {
    title: "Wonderwall (Remastered)",
    artist: "Oasis",
    albumTitle: album,
    trackDuration: 259,
  };
  const candidate = {
    ...song,
    title: "Wonderwall",
    artist: "Oasis",
    album,
    duration: 259,
  };
  const deluxe = {
    ...candidate,
    album: "(What's The Story) Morning Glory? (Deluxe Remastered Edition)",
    videoId: "FVdjZYfDuLE",
    url: "https://www.youtube.com/watch?v=FVdjZYfDuLE",
  };
  assert.equal(matchPlayback(track, [deluxe, candidate]).source.videoId, candidate.videoId);
  assert.equal(matchPlayback({ ...track, albumTitle: "" }, [deluxe, candidate]).status, "choose");
  assert.equal(
    scoreCandidate(track, {
      ...candidate,
      album: "(What's The Story) Morning Glory?",
    }).hardReject,
    true,
  );
  assert.equal(
    scoreCandidate(track, { ...candidate, title: "Wonderwall (Live)" }).hardReject,
    true,
  );
  assert.equal(scoreCandidate(track, { ...candidate, artist: "Ryan Adams" }).hardReject, true);
  assert.equal(scoreCandidate(track, { ...candidate, duration: 290 }).hardReject, true);
  assert.equal(
    scoreCandidate(
      { ...track, title: "Wonderwall (2014 Remastered)" },
      { ...candidate, title: "Wonderwall (2025 Remastered)" },
    ).hardReject,
    true,
  );
  assert.equal(
    scoreCandidate({ ...track, title: "Wonderwall", albumTitle: "" }, candidate).hardReject,
    true,
  );
});
test("Japanese character/CV credits tolerate internal spacing without accepting another singer", () => {
  const track = {
    title: "God knows...",
    artist: "涼宮ハルヒ(CV.平野綾)",
    trackDuration: 279,
  };
  const candidate = {
    ...song,
    title: track.title,
    artist: "涼宮ハルヒ (CV.平野 綾)",
    album: "AYA MUSEUM",
    duration: 281,
  };
  assert.equal(matchPlayback(track, [candidate]).status, "matched");
  for (const artist of ["涼宮ハルヒ(CV.別人)", "別人(CV.平野綾)", "TOKINOSORA"])
    assert.equal(scoreCandidate(track, { ...candidate, artist }).hardReject, true);
  assert.equal(
    scoreCandidate(track, { ...candidate, title: "God knows... (Live)" }).hardReject,
    true,
  );
  assert.equal(scoreCandidate(track, { ...candidate, duration: 310 }).hardReject, true);
  assert.equal(
    scoreCandidate({ ...target, artist: "Ann A" }, { ...song, artist: "Anna" }).hardReject,
    true,
  );
});
test("exact title/artist/duration creates a validated source, independent of result order", () => {
  const result = matchPlayback(target, [
    {
      ...song,
      artist: "Cover Artist",
      videoId: "dQw4w9WgXcQ",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    },
    song,
  ]);
  assert.equal(result.status, "matched");
  assert.equal(result.source.videoId, song.videoId);
  assert.equal(
    matchPlayback({ ...target, title: "Héaven Knows I’m Miserable Now" }, [song]).status,
    "matched",
  );
});
test("version mismatches are directional hard conflicts; live target picks live", () => {
  for (const version of [
    "Live",
    "Remix",
    "Acoustic",
    "Demo",
    "Instrumental",
    "Karaoke",
    "Sped Up",
    "Slowed",
    "Nightcore",
    "Remastered",
    "Radio Edit",
    "Extended",
    "Cover",
  ]) {
    const other = {
      ...song,
      title: song.title + " (" + version + ")",
      videoId: "dQw4w9WgXcQ",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    };
    assert.equal(scoreCandidate(target, other).hardReject, true, version);
    assert.equal(scoreCandidate({ ...target, title: other.title }, song).hardReject, true, version);
    assert.equal(
      matchPlayback({ ...target, title: other.title }, [song, other]).source.videoId,
      other.videoId,
    );
  }
});
test("cover artist and unofficial generic video cannot auto-match", () => {
  assert.equal(matchPlayback(target, [{ ...song, artist: "Other Singer" }]).status, "not-found");
  assert.equal(matchPlayback(target, [{ ...song, resultType: "video" }]).status, "not-found");
});
test("duration thresholds, album tie-break and ambiguity have explicit confidence", () => {
  assert.equal(
    matchPlayback(target, [
      {
        ...song,
        duration: 251,
        videoId: "dQw4w9WgXcQ",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      },
      { ...song, duration: 217 },
    ]).source.videoId,
    song.videoId,
  );
  assert.equal(
    matchPlayback(target, [
      {
        ...song,
        album: "Compilation",
        videoId: "dQw4w9WgXcQ",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      },
      song,
    ]).source.videoId,
    song.videoId,
  );
  assert.equal(
    matchPlayback(target, [
      song,
      {
        ...song,
        videoId: "dQw4w9WgXcQ",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      },
    ]).status,
    "choose",
  );
  assert.equal(
    matchPlayback({ ...target, albumTitle: "", trackDuration: undefined }, [song]).status,
    "choose",
  );
  for (const delta of [3, 6, 10])
    assert.equal(
      matchPlayback({ ...target, albumTitle: "" }, [{ ...song, duration: 216 + delta }]).status,
      "matched",
    );
  assert.notEqual(
    matchPlayback({ ...target, albumTitle: "" }, [{ ...song, duration: 231 }]).status,
    "matched",
  );
  assert.notEqual(
    matchPlayback(target, [{ ...song, duration: 235 }]).status,
    "matched",
    "album cannot override a weak duration match",
  );
});
test("feat packaging and Unicode artists preserve strong artist identity", () => {
  assert.equal(
    matchPlayback(
      {
        ...target,
        title: target.title + " (feat. Guest)",
        artist: "The Smiths / Guest",
      },
      [song],
    ).status,
    "matched",
  );
  assert.equal(
    matchPlayback({ ...target, artist: "The Smiths & Guest" }, [song]).status,
    "matched",
  );
});
test("manual ambiguity includes related version labels without auto-selecting them", () => {
  const result = matchPlayback({ ...target, albumTitle: "", trackDuration: undefined }, [
    song,
    {
      ...song,
      title: song.title + " (Remastered)",
      videoId: "dQw4w9WgXcQ",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    },
  ]);
  assert.equal(result.status, "choose");
  assert.equal(result.items.length, 2);
  assert.equal(result.source, null);
});
test("invalid IDs, foreign hosts and mismatched URL IDs never produce a source", () => {
  for (const patch of [
    { videoId: "bad" },
    { url: "https://evil.test/watch?v=10z6-vQm23w" },
    { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
  ])
    assert.equal(matchPlayback(target, [{ ...song, ...patch }]).source, null);
  assert.equal(matchPlayback(target, [song, { ...song }]).status, "matched");
});
