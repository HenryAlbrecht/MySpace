const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');

const children = new Set();
let stopping = false;

function portOpen(port) {
  return new Promise(resolve => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
    socket.setTimeout(500, () => { socket.destroy(); resolve(false); });
  });
}

function stopChildren() {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
}

for (const signal of ['SIGINT', 'SIGBREAK', 'SIGTERM']) {
  process.on(signal, () => { stopChildren(); process.exitCode = 130; });
}
process.on('exit', stopChildren);

function start(script, args = [], stdio = 'inherit') {
  const child = spawn(process.execPath, ['--use-system-ca', path.join(__dirname, script), ...args], {
    cwd: script.startsWith('server/') ? path.join(__dirname, 'server') : __dirname,
    stdio,
    windowsHide: true,
  });
  children.add(child);
  child.once('close', () => children.delete(child));
  return child;
}

function waitForParty(child) {
  return new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => finish(new Error('PARTY nao abriu a porta 8787 em 30 segundos.')), 30000);
    async function onData(data) {
      process.stdout.write(data);
      output += data.toString();
      if (!output.includes('PARTY signaling na porta 8787')) return;
      output = '';
      if (await portOpen(8787)) finish();
      else finish(new Error('PARTY informou inicio, mas a porta 8787 nao respondeu.'));
    }
    function onClose(code) { finish(new Error(`PARTY encerrou antes de abrir a porta 8787 (codigo ${code}).`)); }
    function finish(error) {
      clearTimeout(timer);
      child.stdout.off('data', onData);
      child.off('close', onClose);
      child.off('error', finish);
      if (error) reject(error); else resolve();
    }
    child.stdout.on('data', onData);
    child.once('close', onClose);
    child.once('error', finish);
  });
}

async function main() {
  if (await portOpen(8787)) throw new Error('A porta 8787 ja esta em uso. Feche a instancia anterior do PARTY signaling.');
  if (await portOpen(3000)) throw new Error('A porta 3000 ja esta em uso. Feche a instancia anterior do frontend.');
  console.log('Iniciando PARTY signaling...');
  const party = start('server/signaling-server.cjs', [], ['ignore', 'pipe', 'inherit']);
  await waitForParty(party);
  if (stopping) return;
  console.log('PARTY disponivel na porta 8787. Iniciando frontend na porta 3000...');
  const frontend = start('server.cjs', ['--open']);
  const code = await new Promise(resolve => {
    frontend.once('close', resolve);
    frontend.once('error', error => { console.error(error.message); resolve(1); });
  });
  if (!stopping && code !== 0) throw new Error(`Frontend encerrou com codigo ${code}.`);
}

main().catch(error => { console.error(`Erro: ${error.message}`); process.exitCode = 1; })
  .finally(() => {
    stopChildren();
    const pending = [...children];
    if (pending.length) {
      const timer = setTimeout(() => { console.error('Erro: servidor nao encerrou apos Ctrl+C.'); process.exitCode = 1; }, 5000);
      Promise.all(pending.map(child => new Promise(resolve => child.once('close', resolve))))
        .finally(() => clearTimeout(timer));
    }
  });
