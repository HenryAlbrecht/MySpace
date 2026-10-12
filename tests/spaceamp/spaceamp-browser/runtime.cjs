"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createServer } = require("../../../server.cjs");
const { chromium } = require(
  path.join(
    os.homedir(),
    ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
  ),
);
async function startRuntime() {
  assert.doesNotMatch(
    fs.readFileSync(path.join(__dirname, "../../../dist/xmb-quick-menu.css"), "utf8"),
    /box-shadow:\s*8px\s+12px\s+0/,
  );
  const web = createServer({
    music: {
      search: async () => ({
        items: [],
      }),
      details: async () => ({}),
      summary: async () => ({}),
      recommendations: async () => ({
        items: [],
      }),
    },
  });
  const testArtifacts = fs.mkdtempSync(path.join(os.tmpdir(), "myspace-spaceamp-browser-"));
  let browser;
  async function close() {
    try {
      await browser?.close();
    } finally {
      web.closeAllConnections();
      if (web.listening) await new Promise((resolve) => web.close(resolve));
      // This exact directory was allocated above, outside the repository.
      fs.rmSync(testArtifacts, {
        recursive: true,
        force: true,
      });
    }
  }
  try {
    await new Promise((resolve) => web.listen(0, "127.0.0.1", resolve));
    browser = await chromium.launch({
      executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      headless: true,
    });
    return {
      web,
      browser,
      testArtifacts,
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
}
module.exports = {
  startRuntime,
};
