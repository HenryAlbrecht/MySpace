"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
module.exports = async function ({ page, np, toggle, mode, artwork, settled, testArtifacts }) {
  await artwork();
  // Same artwork, unchanged tokens, moving spatial field at 0/2 seconds.
  await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 160;
    const x = c.getContext("2d");
    x.fillStyle = "#174b88";
    x.fillRect(0, 0, 160, 160);
    x.fillStyle = "#ca367d";
    x.fillRect(0, 0, 70, 100);
    x.fillStyle = "#7fd8d3";
    x.fillRect(100, 80, 60, 80);
    x.fillStyle = "#e4dcbd";
    x.fillRect(60, 30, 35, 40);
    SPACEAMP.update(
      {
        ...SPACEAMP.getState(),
        title: "Temporal fixture",
        source: "YouTube",
        artwork: c.toDataURL(),
      },
      true,
    );
  });
  await page.waitForFunction(
    () =>
      document.querySelector("#spaceampNowPlaying").dataset.atmosphere === "kawarp" &&
      !__kawarp.isTransitioning,
  );
  assert.equal(await np.getAttribute("data-atmosphere"), "kawarp");
  const temporalTokens = await np.evaluate((n) => n.style.getPropertyValue("--np-accent"));
  // Hide every source of temporal noise before reading the actual GPU buffer.
  if ((await toggle.getAttribute("aria-pressed")) === "true") await toggle.click();
  await mode(0, "off");
  await page.locator(".np-menu summary").last().click();
  await page
    .getByRole("button", {
      name: "Ocultar UI agora",
    })
    .click();
  await page.waitForFunction(() =>
    document.querySelector("#spaceampNowPlaying").classList.contains("np-idle"),
  );
  await settled();
  const instance = await page.evaluate(
    () => __kawarp.canvas === document.querySelector(".np-dynamic-atmosphere"),
  );
  assert.equal(instance, true);
  const sample = () =>
    page.locator(".np-dynamic-atmosphere").evaluate((n) => {
      const gl = n.getContext("webgl");
      const p = new Uint8Array(n.width * n.height * 4);
      gl.readPixels(0, 0, n.width, n.height, gl.RGBA, gl.UNSIGNED_BYTE, p);
      const cells = [];
      for (let by = 0; by < 18; by++)
        for (let bx = 0; bx < 32; bx++) {
          const sum = [0, 0, 0];
          let count = 0;
          for (
            let y = Math.floor((by * n.height) / 18);
            y < Math.floor(((by + 1) * n.height) / 18);
            y += 3
          )
            for (
              let x = Math.floor((bx * n.width) / 32);
              x < Math.floor(((bx + 1) * n.width) / 32);
              x += 3
            ) {
              const at = (y * n.width + x) * 4;
              for (let c = 0; c < 3; c++) sum[c] += p[at + c];
              count++;
            }
          cells.push(...sum.map((v) => v / count));
        }
      const copy = document.createElement("canvas");
      copy.width = n.width;
      copy.height = n.height;
      copy.getContext("2d").drawImage(n, 0, 0);
      return {
        cells,
        png: copy.toDataURL(),
        time: __kawarp.accumulatedTime,
        playing: __kawarp.isPlaying,
      };
    });
  const difference = (a, b) => {
    let sum = 0;
    let changed = 0;
    for (let i = 0; i < a.length; i += 3) {
      const d =
        (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 3;
      sum += d;
      if (d > 3) changed++;
    }
    return {
      mean: sum / (a.length / 3),
      changed: changed / (a.length / 3),
    };
  };
  const snapshots = [];
  let previousSecond = 0;
  for (const second of [0, 2, 5, 10]) {
    // Keep the 0/2/5/10 s GPU sampling windows; these measure actual animation time.
    if (second) await page.waitForTimeout((second - previousSecond) * 1000);
    previousSecond = second;
    const frame = await sample();
    snapshots.push(frame);
    fs.writeFileSync(
      path.join(testArtifacts, "temporal-" + second + "s-raw.png"),
      Buffer.from(frame.png.split(",")[1], "base64"),
    );
    assert.equal(await np.evaluate((n) => n.style.getPropertyValue("--np-accent")), temporalTokens);
    assert.equal(frame.playing, true);
  }
  const deltas = snapshots.slice(1).map((f) => difference(snapshots[0].cells, f.cells));
  for (const delta of deltas) {
    assert.ok(delta.mean > 3, JSON.stringify(delta));
    assert.ok(delta.changed > 0.2, JSON.stringify(delta));
  }
  assert.ok(snapshots[3].time > snapshots[0].time + 9);
  // Freeze and resume the same canvas, measured for three seconds each.
  const pausedTime = await page.evaluate(() => __time.position);
  await page.evaluate(() => SPACEAMP.update(SPACEAMP.getState(), false));
  const pausedDraws = await page.evaluate(() => __dynamicDraws);
  const pausedFrame = await sample();
  await page.waitForTimeout(3000);
  const frozenFrame = await sample();
  assert.equal(await page.evaluate(() => __dynamicDraws), pausedDraws);
  assert.deepEqual(frozenFrame.cells, pausedFrame.cells);
  assert.equal(frozenFrame.playing, false);
  assert.equal(await page.evaluate(() => __time.position), pausedTime);
  await page.evaluate(() => {
    window.__pausedInstance = __kawarp;
    SPACEAMP.update(SPACEAMP.getState(), true);
  });
  await page.waitForTimeout(3000);
  const resumed = await sample();
  const resumeDelta = difference(frozenFrame.cells, resumed.cells);
  assert.ok(resumeDelta.mean > 3 && resumeDelta.changed > 0.2, JSON.stringify(resumeDelta));
  assert.equal(await page.evaluate(() => __pausedInstance === __kawarp), true);
  console.log(
    "Raw Kawarp temporal / resume metrics:",
    JSON.stringify({
      deltas,
      resumeDelta,
    }),
  );
  fs.writeFileSync(
    path.join(testArtifacts, "raw-temporal-metrics.json"),
    JSON.stringify(
      {
        deltas,
        resumeDelta,
        pauseDifference: difference(pausedFrame.cells, frozenFrame.cells),
      },
      null,
      2,
    ),
  );
  await page.mouse.move(500, 300);
  await page.waitForFunction(
    () => !document.querySelector("#spaceampNowPlaying").classList.contains("np-idle"),
  );
};
