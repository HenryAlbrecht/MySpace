"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  createServer
} = require("../../server.cjs");
const {
  chromium
} = require(path.join(os.homedir(), ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"));
async function startRuntime() {
  const web = createServer({
    music: {
      search: async () => ({
        items: []
      }),
      details: async () => ({}),
      summary: async () => ({}),
      recommendations: async () => ({
        items: []
      })
    }
  });
  const testArtifacts = fs.mkdtempSync(path.join(os.tmpdir(), "myspace-presentation-browser-"));
  let browser;
  async function close() {
    try {
      await browser?.close();
    } finally {
      web.closeAllConnections();
      if (web.listening) await new Promise(resolve => web.close(resolve));
      // Remove only the exact temporary directory allocated for this execution.
      const target = path.resolve(testArtifacts);
      if (path.dirname(target) !== path.resolve(os.tmpdir()) || !path.basename(target).startsWith("myspace-presentation-browser-")) throw Error("Unexpected cleanup path");
      fs.rmSync(target, {
        recursive: true,
        force: true
      });
    }
  }
  try {
    await new Promise(resolve => web.listen(0, "127.0.0.1", resolve));
    browser = await chromium.launch({
      executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      headless: true
    });
    return {
      web,
      browser,
      testArtifacts,
      close
    };
  } catch (error) {
    await close();
    throw error;
  }
}
module.exports = {
  startRuntime
};
