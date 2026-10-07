const assert = require("node:assert/strict");

async function queue({ page, context, playLocal, playing }) {
  await playLocal();
  const bytes = await page.evaluate(async () => Array.from(new Uint8Array(await (await MediaStorage.get("audio-test")).arrayBuffer())));
  await context.route("**/fixture-preview.wav", route => route.fulfill({ contentType: "audio/wav", body: Buffer.from(bytes) }));
  const persisted = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem("myspace-extras-v1")).tracks));
  const current = await page.evaluate(() => JSON.stringify(SPACEAMP.getState().queue));
  await page.evaluate(() => SPACEAMP.preview({ title: "Prévia · Test", artist: "Artist", url: location.origin + "/fixture-preview.wav" }));
  await page.waitForFunction(() => SPACEAMP.getState().playing && SPACEAMP.getState().preview);
  assert.equal(await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem("myspace-extras-v1")).tracks)), persisted);
  assert.equal(await page.evaluate(() => JSON.stringify(SPACEAMP.getState().queue)), current);
  assert.equal(await page.evaluate(() => SPACEAMP.getState().queue.some(track => track.title === "Prévia · Test")), false);
  await page.evaluate(() => document.querySelector("#audio").dispatchEvent(new Event("ended")));
  await playing(false);
  assert.equal(await page.evaluate(() => SPACEAMP.getState().title), "Prévia · Test");
  assert.equal(await page.evaluate(() => SPACEAMP.getNowPlaying()), null);
}

module.exports = { queue };
