// Historical entry point; current contracts live in the canonical playback suite.
const { run } = require("./music-playback-browser.cjs");
const selection = process.argv.length > 3 ? process.argv.slice(2).join(" ") : (process.argv[2] || "full");
run(selection).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
