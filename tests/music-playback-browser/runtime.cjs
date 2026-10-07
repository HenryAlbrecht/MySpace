const path = require("node:path");
const os = require("node:os");
const { createServer } = require("../../server.cjs");
const { chromium } = require(
  path.join(
    os.homedir(),
    ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
  ),
);

async function startRuntime() {
  const web = createServer({
    music: {
      search: async () => ({ items: [] }),
      details: async () => ({}),
      summary: async () => ({}),
      recommendations: async () => ({ items: [] }),
    },
  });
  let browser;
  async function close() {
    try {
      await browser?.close();
    } finally {
      web.closeAllConnections();
      if (web.listening) await new Promise((resolve) => web.close(resolve));
    }
  }
  try {
    await new Promise((resolve, reject) => {
      web.once("error", reject);
      web.listen(0, "127.0.0.1", resolve);
    });
    browser = await chromium.launch({
      executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      headless: true,
      args: ["--autoplay-policy=no-user-gesture-required"],
    });
    return { web, browser, close };
  } catch (error) {
    await close();
    throw error;
  }
}

module.exports = { startRuntime };
