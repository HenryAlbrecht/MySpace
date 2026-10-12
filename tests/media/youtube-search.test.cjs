const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createYouTubeVideoSearch, parseVideoResults } = require("../../server/media/youtube-search.cjs");

const shell =
  'ytcfg.set({"INNERTUBE_API_KEY":"fixture-key","INNERTUBE_CONTEXT":{"client":{"clientVersion":"fixture-version","visitorData":"visitor"}}});';

test("YouTube InnerTube search parses video metadata and uses the first-party endpoint", async () => {
  const requests = [];
  const client = createYouTubeVideoSearch({
    fetcher: async (url, options = {}) => {
      requests.push({ url: String(url), options });
      if (String(url) === "https://www.youtube.com/")
        return { ok: true, text: async () => shell };
      return {
        ok: true,
        json: async () => ({
          contents: {
            twoColumnSearchResultsRenderer: {
              primaryContents: {
                sectionListRenderer: {
                  contents: [
                    {
                      itemSectionRenderer: {
                        contents: [
                          {
                            videoRenderer: {
                              videoId: "abcdefghijk",
                              title: { runs: [{ text: "Persona 3 Reload Opening" }] },
                              ownerText: { simpleText: "Atlus" },
                              thumbnail: {
                                thumbnails: [
                                  { url: "https://i.ytimg.com/vi/abcdefghijk/mqdefault.jpg", width: 320 },
                                  { url: "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg", width: 480 },
                                ],
                              },
                            },
                          },
                          {
                            videoRenderer: {
                              videoId: "invalid",
                              title: { simpleText: "Invalid id" },
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      };
    },
  });

  const result = await client.search("Persona 3 Reload", 12);

  assert.deepEqual(result.items, [
    {
      id: "abcdefghijk",
      title: "Persona 3 Reload Opening",
      channel: "Atlus",
      url: "https://www.youtube.com/watch?v=abcdefghijk",
      thumbnail: "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg",
    },
  ]);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].url, "https://www.youtube.com/");
  const search = new URL(requests[1].url);
  assert.equal(search.origin, "https://www.youtube.com");
  assert.equal(search.pathname, "/youtubei/v1/search");
  assert.equal(search.searchParams.get("key"), "fixture-key");
  assert.equal(requests[1].options.method, "POST");
  assert.equal(requests[1].options.headers.Origin, "https://www.youtube.com");
  const body = JSON.parse(requests[1].options.body);
  assert.equal(body.context.client.clientName, "WEB");
  assert.equal(body.context.client.clientVersion, "fixture-version");
  assert.equal(body.context.client.visitorData, "visitor");
  assert.equal(body.query, "Persona 3 Reload");
});

test("video result parser ignores malformed ids and duplicate entries", () => {
  const rows = parseVideoResults(
    {
      first: {
        videoRenderer: {
          videoId: "abcdefghijk",
          title: { simpleText: "Opening" },
        },
      },
      second: {
        videoRenderer: {
          videoId: "abcdefghijk",
          title: { simpleText: "Duplicate" },
        },
      },
      third: {
        videoRenderer: {
          videoId: "bad-id",
          title: { simpleText: "Malformed" },
        },
      },
    },
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, "Opening");
});
