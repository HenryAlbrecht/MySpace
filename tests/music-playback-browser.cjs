const assert = require("node:assert/strict");
const { performance } = require("node:perf_hooks");
const { startRuntime } = require("./music-playback-browser/runtime.cjs");
const { createFixture, localSong, legacySong, sourceItems } = require("./music-playback-browser/fixture.cjs");

const scenarios = [
  { name: "playback:local", file: "playback", method: "local", items: [localSong] },
  { name: "playback:youtube", file: "playback", method: "youtube", items: [localSong, legacySong] },
  { name: "routes:continuity", file: "routes", method: "continuity", items: [localSong, legacySong] },
  { name: "compact:local", file: "compact", method: "local", items: [localSong] },
  { name: "compact:youtube", file: "compact", method: "youtube", items: [localSong, legacySong] },
  { name: "preferences:visibility", file: "preferences", method: "visibility", items: [localSong] },
  { name: "preview:queue", file: "preview", method: "queue", items: [localSong] },
  { name: "source:auto", file: "source", method: "auto", items: sourceItems },
  { name: "source:manual", file: "source", method: "manual", items: sourceItems },
  { name: "source:not-found", file: "source", method: "notFound", items: sourceItems },
  { name: "source:choose", file: "source", method: "choose", items: sourceItems },
  { name: "controls:profile", file: "controls", method: "profile", items: [localSong, legacySong] },
];
const groups = [...new Set(scenarios.map(scenario => scenario.name.split(":")[0]))];

async function run(selection = "full") {
  const selected = scenarios.filter(scenario => selection === "full" || selection === scenario.name || selection === scenario.name.split(":")[0]);
  if (!selected.length) throw new Error(`Cenário inválido: ${selection}\nOpções: full, ${groups.join(", ")}, ${scenarios.map(scenario => scenario.name).join(", ")}`);
  const started = performance.now();
  const runtime = await startRuntime();
  try {
    for (const scenario of selected) {
      const caseStarted = performance.now();
      const fixture = await createFixture(runtime, scenario.items);
      try {
        await require(`./music-playback-browser/${scenario.file}.cjs`)[scenario.method](fixture);
        assert.deepEqual(fixture.errors, [], "No page errors");
        console.log(`PASS ${scenario.name} (${((performance.now() - caseStarted) / 1000).toFixed(1)}s)`);
      } catch (error) {
        console.error(`FAIL ${scenario.name}`);
        console.error(await fixture.page.evaluate(() => ({ hash: location.hash, playback: SPACEAMP.getPlaybackState(), dialog: document.querySelector(".music-link-dialog")?.textContent, errors: window.__ytTest?.destroyed })));
        throw error;
      } finally {
        await fixture.context.close();
      }
    }
  } finally {
    await runtime.close();
  }
  console.log(`PASS ${selection}: ${selected.length} cenário(s), ${((performance.now() - started) / 1000).toFixed(1)}s total; server/Edge boots: 1/1`);
}

module.exports = { run };
if (require.main === module) {
  const selection = process.argv.length > 3 ? process.argv.slice(2).join(" ") : process.argv[2];
  run(selection).catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
