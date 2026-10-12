"use strict";

const { performance } = require("node:perf_hooks");
const { startRuntime } = require("./spaceamp-presentation-browser/runtime.cjs");
const { createFixture } = require("./spaceamp-presentation-browser/fixture.cjs");
const scenarios = [
  { name: "shell:idle", file: "shell-idle" },
  { name: "shell:xmb", file: "shell-xmb" },
  { name: "lyrics:vendor", file: "lyrics-vendor" },
  { name: "lyrics:visibility", file: "lyrics-visibility" },
  { name: "visualizer:modes", file: "visualizer" },
  { name: "palette:artwork", file: "palette" },
  { name: "atmosphere:decode", file: "atmosphere-decode" },
  { name: "atmosphere:temporal", file: "atmosphere-temporal" },
  { name: "atmosphere:lifecycle", file: "atmosphere-lifecycle" },
  { name: "timeline:transport", file: "timeline" },
  { name: "responsive:layout", file: "responsive" },
  { name: "failure:lyrics", file: "failure-lyrics" },
  { name: "preferences:reload", file: "preferences" },
  { name: "failure:atmosphere", file: "failure-atmosphere" },
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
    throw Error(
      "Cenário inválido: " +
        selection +
        "\nOpções: full, " +
        groups.join(", ") +
        ", " +
        scenarios.map((scenario) => scenario.name).join(", "),
    );
  }
  const started = performance.now();
  const runtime = await startRuntime();
  try {
    for (const scenario of selected) {
      const caseStarted = performance.now();
      const fixture = await createFixture(runtime);
      try {
        await require("./spaceamp-presentation-browser/" + scenario.file + ".cjs")(fixture);
        console.log(
          "PASS " +
            scenario.name +
            " " +
            ((performance.now() - caseStarted) / 1000).toFixed(1) +
            "s",
        );
      } catch (error) {
        console.error("FAIL " + scenario.name);
        throw error;
      } finally {
        await fixture.close();
      }
    }
    console.log(
      "Presentation: " +
        selected.length +
        " scenarios, " +
        ((performance.now() - started) / 1000).toFixed(1) +
        "s",
    );
  } finally {
    await runtime.close();
  }
}

if (require.main === module) {
  run(process.argv[2] || "full").catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
module.exports = { run };
