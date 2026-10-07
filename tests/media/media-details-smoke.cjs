const assert = require("node:assert/strict");
const Catalog = require("../../dist/catalog.js");
const { parseStorePage } = require("../../server/media/steam-page.cjs");
(async () => {
  assert.equal(parseStorePage("<p>No notice available</p>", 1).drm_notice, "");
  let query;
  const item = await Catalog.details(
    { kind: "manga", catalogId: "anilist:900" },
    {
      fetcher: async (url, options) => {
        query = JSON.parse(options.body).query;
        return {
          ok: true,
          json: async () => ({
            data: {
              Media: {
                id: 900,
                type: "MANGA",
                title: { romaji: "Fixture manga" },
                description: "<p>Full synopsis</p>",
                bannerImage: "https://example.com/banner.jpg",
                characters: {
                  edges: [
                    {
                      role: "MAIN",
                      node: {
                        name: { full: "Character fixture" },
                        image: { large: "https://example.com/person.jpg" },
                        siteUrl: "https://anilist.co/character/1",
                      },
                    },
                  ],
                },
                recommendations: {
                  nodes: [
                    {
                      mediaRecommendation: {
                        id: 999,
                        type: "ANIME",
                        title: { romaji: "New anime" },
                        coverImage: { large: "https://example.com/new.jpg" },
                      },
                    },
                  ],
                },
                chapters: 100,
                volumes: 12,
                status: "FINISHED",
                averageScore: 82,
                startDate: { year: 2001, month: 3 },
                synonyms: ["Alternative title"],
                relations: {
                  edges: [
                    {
                      relationType: "ADAPTATION",
                      node: {
                        id: 901,
                        type: "ANIME",
                        title: { english: "Fixture anime" },
                        coverImage: { large: "https://example.com/image.jpg" },
                      },
                    },
                  ],
                },
              },
            },
          }),
        };
      },
    },
  );
  assert.ok(query.includes("relations"));
  assert.equal(item.volumes, 12);
  assert.equal(item.catalogRating, 82);
  assert.equal(item.bannerImage, "https://example.com/banner.jpg");
  assert.deepEqual(item.characterNames, ["Character fixture"]);
  assert.deepEqual(item.recommendationIds, ["anilist:999"]);
  assert.deepEqual(item.relationKinds, ["anime"]);
  assert.deepEqual(item.relationIds, ["anilist:901"]);
  const series = await Catalog.details(
    { kind: "series", catalogId: "tvmaze:902" },
    {
      fetcher: async () => ({
        ok: true,
        json: async () => ({
          id: 902,
          name: "Fixture series",
          summary: "Full series synopsis",
          rating: { average: 8.1 },
          language: "English",
          status: "Ended",
          premiered: "2020-01-01",
          network: { name: "Fixture network" },
        }),
      }),
    },
  );
  assert.equal(series.catalogRating, 8.1);
  assert.equal(series.network, "Fixture network");
  console.log(
    "Media details: manga rating, volumes, anime relations, series facts and unknown DRM OK.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
