const assert = require("node:assert/strict");
const { performance } = require("node:perf_hooks");
const { startRuntime } = require("./spaceamp-browser/runtime.cjs");
const { createFixture } = require("./spaceamp-browser/fixture.cjs");
const prepare = require("./spaceamp-browser/prepare.cjs");

// Every case owns a fresh context, while the server and Edge process are shared.
const scenarios = [
  { name: "handoff:entry", file: "entry", prepare: async () => {} },
  { name: "controller:topology", file: "controller", prepare: prepare.player },
  { name: "quick-menu:commands", file: "quick-menu", prepare: prepare.volume },
  {
    name: "video:presentation",
    file: "video-presentation",
    prepare: prepare.menu,
  },
  {
    name: "video:track-change",
    file: "video-track-change",
    prepare: prepare.video,
  },
  { name: "lyrics:navigation", file: "lyrics", prepare: prepare.volume },
  {
    name: "quick-menu:xmb-origin",
    file: "quick-menu-xmb",
    prepare: prepare.xmb,
  },
  {
    name: "handoff:entry-artwork",
    file: "handoff-entry-artwork",
    prepare: prepare.xmb,
  },
  {
    name: "controller:gamepad-entry",
    file: "controller-gamepad",
    prepare: prepare.gamepad,
  },
  {
    name: "handoff:decode",
    file: "handoff-decode",
    prepare: prepare.firstItem,
  },
  {
    name: "handoff:reverse",
    file: "handoff-reverse",
    prepare: prepare.firstItem,
  },
  {
    name: "controller:axes-repeat",
    file: "controller-axes",
    prepare: prepare.firstItem,
  },
  {
    name: "presentation:responsive",
    file: "presentation-responsive",
    prepare: prepare.xmb,
  },
  { name: "quick-menu:system", file: "system", prepare: prepare.system },
  {
    name: "presentation:return-preferences",
    file: "return-preferences",
    prepare: prepare.xmb,
  },
];
const groups = [...new Set(scenarios.map((scenario) => scenario.name.split(":")[0]))];

async function run(selection = "full") {
  const selected = scenarios.filter(
    (scenario) =>
      selection === "full" ||
      scenario.name === selection ||
      scenario.name.split(":")[0] === selection,
  );
  if (!selected.length) {
    throw new Error(
      `Cenário inválido: ${selection}\nOpções: full, ${groups.join(", ")}, ${scenarios.map((scenario) => scenario.name).join(", ")}`,
    );
  }
  const started = performance.now();
  const runtime = await startRuntime();
  try {
    for (const scenario of selected) {
      const caseStarted = performance.now();
      const fixture = await createFixture(runtime.browser, runtime.web);
      fixture.testArtifacts = runtime.testArtifacts;
      try {
        await scenario.prepare(fixture);
        await require(`./spaceamp-browser/${scenario.file}.cjs`)(fixture);
        await fixture.page.evaluate(() => {
          if (XmbQuickMenu.isOpen()) XmbQuickMenu.close();
          if (SpaceAmpNowPlaying.isOpen()) SpaceAmpNowPlaying.close();
        });
        assert.equal(
          await fixture.page.evaluate(() => __quickTimers.size),
          0,
          "Quick Menu timer must stop",
        );
        assert.deepEqual(fixture.errors, [], "No page errors");
        console.log(
          `PASS ${scenario.name} (${((performance.now() - caseStarted) / 1000).toFixed(1)}s)`,
        );
      } catch (error) {
        console.error(
          await fixture.page.evaluate(() => ({
            menu: XmbQuickMenu.isOpen(),
            status: document.querySelector(".xqm-track .xqm-status")?.textContent,
            focus: document.activeElement?.outerHTML.slice(0, 300),
            clock: window.__clock,
            playback: SPACEAMP.getPlaybackState(),
          })),
        );
        error.message = `${scenario.name}: ${error.message}`;
        throw error;
      } finally {
        await fixture.context.close();
      }
    }
  } finally {
    await runtime.close();
  }
  console.log(
    `PASS ${selection}: ${selected.length} cenário(s), ${((performance.now() - started) / 1000).toFixed(1)}s total`,
  );
}

module.exports = { run };
if (require.main === module) {
  const selection = process.argv.length > 3 ? process.argv.slice(2).join(" ") : process.argv[2];
  run(selection).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
