const assert = require("node:assert/strict");
module.exports = async function ({ page, action }) {
  const errors = [];
  page.on("response", (response) => {
    if (response.url().includes("/xmb-sounds/") && response.status() !== 200) errors.push(response.status());
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => {
    window.__sounds = [];
    const play = SPACEAMP.systemSound.bind(SPACEAMP);
    SPACEAMP.systemSound = (name) => { __sounds.push(name); return play(name); };
    __rows.push({ id: "sound-game", kind: "game", title: "Sound game", xmbVitaOrder: 0 });
    __xmb.enter();
  });
  const state = await page.evaluate(() => SPACEAMP.getPlaybackState());
  await page.keyboard.press("ArrowRight");
  await action("tertiary");
  const open = await page.evaluate(() => __sounds.filter((name) => name !== "peelStop"));
  assert.deepEqual(open, ["cursor", "vitaOpen"]);
  await action("primary");
  await page.locator(".xmb-vita-plate").last().waitFor({ state: "visible" });
  const bubble = await page.evaluate(() => __sounds.filter((name) => name !== "peelStop"));
  assert.deepEqual(bubble, ["cursor", "vitaOpen", "bubble"], "bubble replaces generic confirmation");
  await action("back");
  await action("back");
  assert.deepEqual(await page.evaluate(() => SPACEAMP.getPlaybackState()), state);
  assert.deepEqual(await page.evaluate(() => __sounds.filter((name) => name !== "peelStop").slice(-2)), ["back", "vitaClose"]);
  const response = await page.request.get(new URL("/xmb-sounds/vita_open.wav", page.url()).href);
  assert.equal(response.status(), 200);
  assert.match(response.headers()["content-type"], /audio\/wav/);
  assert.deepEqual(errors, []);
};
