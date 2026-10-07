const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { spawn } = require("node:child_process");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}
async function waitFor(predicate) {
  for (let i = 0; i < 100; i++) {
    if (await predicate()) return;
    await delay(50);
  }
  assert.fail("Timed out waiting for test process");
}
async function freePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

test("launcher can close the selected listener and continue", async () => {
  const port = await freePort();
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "myspace-port-"));
  const serverDir = path.join(fixture, "server", "node_modules", "ws");
  fs.mkdirSync(serverDir, { recursive: true });
  fs.writeFileSync(path.join(serverDir, "package.json"), "{}");
  fs.writeFileSync(
    path.join(fixture, "launcher.bat"),
    fs
      .readFileSync(path.join(__dirname, "..", "launcher.bat"), "utf8")
      .replaceAll("8787", String(port))
      .replace(":~-5", `:~-${String(port).length + 1}`),
  );
  fs.writeFileSync(path.join(fixture, "launcher.cjs"), "console.log('LAUNCHER_CONTINUED')");
  fs.writeFileSync(
    path.join(fixture, "listener.cjs"),
    `require('node:net').createServer().listen(${port}, '127.0.0.1')`,
  );
  const listener = spawn(process.execPath, [path.join(fixture, "listener.cjs")], {
    stdio: "ignore",
    windowsHide: true,
  });
  try {
    await waitFor(() => portOpen(port));
    const cmd = spawn("cmd.exe", ["/d", "/c", "call launcher.bat"], {
      cwd: fixture,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    let output = "";
    cmd.stdout.on("data", (data) => {
      output += data;
    });
    cmd.stderr.on("data", (data) => {
      output += data;
    });
    cmd.stdin.end("S\r\n");
    const code = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cmd.kill();
        reject(new Error(`Launcher timeout: ${output}`));
      }, 12000);
      cmd.once("close", (value) => {
        clearTimeout(timer);
        resolve(value);
      });
    });
    assert.equal(code, 0, output);
    assert.match(output, /LAUNCHER_CONTINUED/);
    await waitFor(async () => !(await portOpen(port)));
  } finally {
    if (listener.exitCode === null) listener.kill();
    assert.ok(path.resolve(fixture).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
