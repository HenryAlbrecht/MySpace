const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { spawn } = require("node:child_process");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function open(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}
async function waitFor(predicate, timeout = 5000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await delay(50);
  }
  assert.fail("Timed out waiting for launcher state");
}
async function freePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

test("interrupting launcher closes both owned server ports", async () => {
  const [partyPort, frontendPort] = await Promise.all([freePort(), freePort()]);
  assert.notEqual(partyPort, frontendPort);
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "myspace-launcher-"));
  fs.mkdirSync(path.join(fixture, "server", "party"), { recursive: true });
  const source = fs.readFileSync(path.join(__dirname, "..", "..", "launcher.cjs"), "utf8");
  fs.writeFileSync(
    path.join(fixture, "launcher.cjs"),
    source.replaceAll("8787", String(partyPort)).replaceAll("3000", String(frontendPort)),
  );
  const stub = (port, message) =>
    `const net=require('node:net');const server=net.createServer();server.listen(${port},'127.0.0.1',()=>console.log(${JSON.stringify(message)}));process.on('SIGTERM',()=>server.close());process.on('SIGINT',()=>server.close());`;
  fs.writeFileSync(
    path.join(fixture, "server", "party", "signaling-server.cjs"),
    stub(partyPort, `PARTY signaling na porta ${partyPort}`),
  );
  fs.writeFileSync(path.join(fixture, "server.cjs"), stub(frontendPort, "Frontend ready"));
  const child = spawn(process.execPath, [path.join(fixture, "launcher.cjs")], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let output = "";
  child.stdout.on("data", (data) => {
    output += data;
  });
  child.stderr.on("data", (data) => {
    output += data;
  });
  try {
    await waitFor(async () => (await open(partyPort)) && (await open(frontendPort)));
    assert.match(output, /PARTY disponivel/);
    child.kill("SIGINT");
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Launcher did not exit: ${output}`)), 7000);
      child.once("close", () => {
        clearTimeout(timer);
        resolve();
      });
    });
    await waitFor(async () => !(await open(partyPort)) && !(await open(frontendPort)));
  } finally {
    if (child.exitCode === null) child.kill();
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
