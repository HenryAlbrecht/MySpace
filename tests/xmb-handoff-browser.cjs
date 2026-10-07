// Compatibility command; implementation and selection live in the domain suite.
const { run } = require("./spaceamp-browser.cjs");
run(process.argv[2] || "full").catch(error => {
  console.error(error);
  process.exitCode = 1;
});
