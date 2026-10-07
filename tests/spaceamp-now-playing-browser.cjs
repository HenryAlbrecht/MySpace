"use strict";

// Compatibility entry point; presentation owns selection and execution.
const { run } = require("./spaceamp-presentation-browser.cjs");
run(process.argv[2] || "full").catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
