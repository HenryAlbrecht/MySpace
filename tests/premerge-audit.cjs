// Local paths and boot declarations only; never reads .env or contacts providers.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
function walk(folder) {
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === 'node_modules') return [];
    const file = path.join(folder, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}
const html = fs.readFileSync('dist/index.html', 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(scripts).size, scripts.length);
const assets = [...html.matchAll(/(?:src|href)="([^"?#]+\.(?:js|css))"/g)].map(match => match[1]);
for (const file of assets) assert.ok(fs.existsSync(path.join('dist', file)), file);
let links = 0, imports = 0;
const files = ['README.md', ...walk('docs'), ...walk('tests'), ...walk('dist'), ...walk('server')];
for (const file of files) {
  if (/\.md$/.test(file)) {
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
      if (/^(?:https?:|codex:|#)/.test(match[1])) continue;
      const target = match[1].split('#')[0];
      assert.ok(fs.existsSync(path.resolve(path.dirname(file), target)), `${file}: ${target}`);
      links++;
    }
  }
  if (/\.(?:js|cjs)$/.test(file)) {
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(/require\(['"](\.[^'"]+)['"]\)/g)) {
      const target = path.resolve(path.dirname(file), match[1]);
      assert.ok(['', '.js', '.cjs', '/index.js'].some(suffix => fs.existsSync(target + suffix)), `${file}: ${match[1]}`);
      imports++;
    }
  }
  if (/\.css$/.test(file)) {
    for (const match of fs.readFileSync(file, 'utf8').matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)) {
      if (/^(?:https?:|data:|#|\/)/.test(match[1])) continue;
      assert.ok(fs.existsSync(path.resolve(path.dirname(file), match[1])), `${file}: ${match[1]}`);
    }
  }
}
assert.match(fs.readFileSync('.gitignore', 'utf8'), /^\/artifacts\/$/m);
assert.match(fs.readFileSync('.gitignore', 'utf8'), /^\.env$/m);
console.log(JSON.stringify({ htmlAssets: assets.length, scripts: scripts.length, markdownLinks: links, localRequires: imports }));
