const assert = require("node:assert/strict");
const { createTranslationClient } = require("../../server/translation.cjs");
const Catalog = require("../../dist/catalog/catalog.js");
global.Catalog = Catalog;
require("../../dist/catalog/catalog-discovery.js");
(async () => {
  let calls = 0;
  const translation = createTranslationClient({
    fetcher: async (url) => {
      calls++;
      const params = new URL(url).searchParams;
      assert.equal(params.get("langpair"), "en|pt-BR");
      assert.ok(Buffer.byteLength(params.get("q")) <= 500);
      return {
        ok: true,
        json: async () => ({
          responseStatus: 200,
          responseData: { translatedText: "Texto traduzido" },
        }),
      };
    },
  });
  assert.equal((await translation.translate("Original description")).text, "Texto traduzido");
  await translation.translate("Original description");
  assert.equal(calls, 1);
  await assert.rejects(translation.translate("é".repeat(251)), (error) => error.status === 400);
  const original = "A complete description with characters and story. ".repeat(25);
  let sent = "";
  const result = await Catalog.translateSummary(original, "en", {
    fetcher: async (url) => {
      const part = new URL(url, "http://localhost").searchParams.get("text");
      sent += part;
      assert.ok(Buffer.byteLength(part) <= 480);
      return { ok: true, json: async () => ({ text: "Trecho traduzido" }) };
    },
  });
  assert.equal(sent, original);
  assert.ok(result.includes("Trecho traduzido"));
  assert.equal(Catalog.portugueseSummary, undefined);
  const quota = createTranslationClient({
    fetcher: async () => ({
      ok: true,
      json: async () => ({ responseStatus: 403, quotaFinished: true }),
    }),
  });
  await assert.rejects(quota.translate("Quota fixture"), /limite/);
  console.log("Translation: original preserved, UTF-8 limits, cache and service limits OK.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
