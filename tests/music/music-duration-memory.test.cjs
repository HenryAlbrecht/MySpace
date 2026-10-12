const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { durationFromText, parseSearch } = require("../../server/music/youtube-music-parser.cjs");
const Collection = require("../../dist/collection/collection.js");
test("duration reads only explicit renderer text, including simpleText and hour clocks", () => {
  for (const [value, seconds] of [
    [{ simpleText: "3:59" }, 239],
    [{ runs: [{ text: "4:30" }] }, 270],
    [{ simpleText: "1:02:15" }, 3735],
  ])
    assert.equal(durationFromText(value), seconds);
  for (const value of ["2026", "327K", "12,004,240"])
    assert.equal(durationFromText({ simpleText: value }), undefined);
  assert.equal(durationFromText({ nested: { simpleText: "4:30" } }), undefined);
  const row = {
    navigationEndpoint: {
      watchEndpoint: {
        videoId: "abcdefghijk",
        watchEndpointMusicSupportedConfigs: {
          watchEndpointMusicConfig: { musicVideoType: "MUSIC_VIDEO_TYPE_ATV" },
        },
      },
    },
    flexColumns: [
      {
        musicResponsiveListItemFlexColumnRenderer: {
          text: { simpleText: "Song" },
        },
      },
      {
        musicResponsiveListItemFlexColumnRenderer: {
          text: {
            runs: [
              {
                text: "Artist",
                navigationEndpoint: {
                  browseEndpoint: {
                    browseId: "UCtestartist123",
                    browseEndpointContextSupportedConfigs: {
                      browseEndpointContextMusicConfig: {
                        pageType: "MUSIC_PAGE_TYPE_ARTIST",
                      },
                    },
                  },
                },
              },
            ],
          },
        },
      },
    ],
    fixedColumns: [
      {
        musicResponsiveListItemFixedColumnRenderer: {
          text: { simpleText: "3:59" },
        },
      },
    ],
  };
  assert.equal(
    parseSearch("music", { musicResponsiveListItemRenderer: row })[0].trackDuration,
    239,
  );
  delete row.fixedColumns;
  row.flexColumns.push({
    musicResponsiveListItemFlexColumnRenderer: {
      text: { simpleText: "1:02:15" },
    },
  });
  assert.equal(
    parseSearch("music", { musicResponsiveListItemRenderer: row })[0].trackDuration,
    3735,
  );
  row.flexColumns.pop();
  row.flexColumns[0].musicResponsiveListItemFlexColumnRenderer.text.simpleText = "4:30";
  assert.equal(
    parseSearch("music", { musicResponsiveListItemRenderer: row })[0].trackDuration,
    undefined,
    "a clock-like title is not duration",
  );
});
test("legacy discoveryOrigin is discarded without breaking validation", () => {
  const item = Collection.validateItem({
    kind: "album",
    title: "Saved album",
    status: "planned",
    discoveryOrigin: { kind: "music", title: "Legacy" },
  });
  assert.equal(Object.hasOwn(item, "discoveryOrigin"), false);
  assert.equal(item.title, "Saved album");
});
