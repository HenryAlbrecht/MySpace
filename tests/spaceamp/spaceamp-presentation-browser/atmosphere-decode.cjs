"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
module.exports = async function ({ page, context, artwork }) {
  await artwork();
  await page.evaluate(() =>
    SPACEAMP.update(
      {
        ...SPACEAMP.getState(),
        artwork: __atmosphereFixtures[0] + "#delayed-palette",
      },
      true,
    ),
  );
  await page.waitForFunction(
    () => document.querySelector("#spaceampNowPlaying").dataset.atmosphere === "kawarp",
  );
  await page.waitForFunction(() => !__kawarp.isTransitioning);
  // A slow front-cover decode must not hold up the safe Kawarp texture.
  await page.waitForFunction(() => !__kawarp.isTransitioning);
  await page.evaluate(() => {
    window.__switchRenderer = __kawarp;
    window.__switchLoads = 0;
    const load = __kawarp.loadImageElement.bind(__kawarp);
    __kawarp.loadImageElement = (...args) => {
      __switchLoads++;
      window.__switchApplied = performance.now();
      return load(...args);
    };
    const decode = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = function () {
      if (this.crossOrigin !== "anonymous" && this.src.endsWith("#slow-front"))
        return decode.call(this).then(
          () =>
            new Promise((resolve) => {
              window.__releaseFront = resolve;
            }),
        );
      return decode.call(this);
    };
    window.__restoreFront = () => {
      HTMLImageElement.prototype.decode = decode;
    };
    window.__switchStart = performance.now();
    SPACEAMP.update(
      {
        ...SPACEAMP.getState(),
        artwork: __atmosphereFixtures[1] + "#slow-front",
      },
      true,
    );
  });
  await page.waitForFunction(() => typeof __releaseFront === "function" && __switchLoads === 1);
  assert.equal(await page.evaluate(() => __switchRenderer === __kawarp), true);
  assert.equal(
    await page.locator(".np-cover").getAttribute("src"),
    await page.evaluate(() => __atmosphereFixtures[0] + "#delayed-palette"),
  );
  assert.ok(
    await page.evaluate(() => __switchApplied - __switchStart < 1000),
    "safe texture should load without waiting for front decode",
  );
  assert.equal(await page.evaluate(() => __kawarp.transitionDuration), 1400);
  // Sample inside the native 1400 ms crossfade before releasing front decode.
  await page.waitForTimeout(350);
  assert.equal(await page.evaluate(() => __kawarp.isTransitioning), true);
  await page.evaluate(() => {
    __releaseFront();
    __restoreFront();
  });
  await page.waitForFunction(() => document.querySelector(".np-cover").src.endsWith("#slow-front"));
  assert.equal(
    await page.evaluate(() => __switchLoads),
    1,
    "front cover readiness must not restart the GPU crossfade",
  );
  await page.waitForFunction(() => !__kawarp.isTransitioning);
  assert.equal(await page.evaluate(() => __kawarp.isTransitioning), false);
  console.log(
    "Kawarp artwork switch: safe image applied before held front decode; one texture upload; same instance; native 1400ms blend.",
  );
  // Cross-origin display images are tainted even when the server offers ACAO.
  // The presentation must reuse its anonymous palette image for WebGL.
  await context.route("https://artwork.fixture/cors.png", (r) =>
    r.fulfill({
      contentType: "image/png",
      headers: {
        "access-control-allow-origin": "*",
      },
      body: fs.readFileSync("dist/profile-art.png"),
    }),
  );
  await page.evaluate(() =>
    SPACEAMP.update(
      {
        ...SPACEAMP.getState(),
        artwork: "https://artwork.fixture/cors.png",
      },
      true,
    ),
  );
  await page.waitForFunction(
    () =>
      document.querySelector("#spaceampNowPlaying").dataset.atmosphere === "kawarp" &&
      document.querySelector(".np-cover").src === "https://artwork.fixture/cors.png",
  );
  await page.waitForFunction(() => !__kawarp.isTransitioning && __dynamicDraws > 0);
  const remoteFrame = () =>
    page.locator(".np-dynamic-atmosphere").evaluate((n) => {
      const gl = n.getContext("webgl");
      const p = new Uint8Array(n.width * n.height * 4);
      gl.readPixels(0, 0, n.width, n.height, gl.RGBA, gl.UNSIGNED_BYTE, p);
      return p.reduce((sum, v) => sum + v, 0);
    });
  const remoteA = await remoteFrame();
  // Real GPU evolution window; frame identity must change with the same CORS-safe texture.
  await page.waitForTimeout(3000);
  assert.notEqual(await remoteFrame(), remoteA);
};
