import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const html = fs.readFileSync('site/index.html', 'utf8');
const TEXT = new Set(['.html', '.js', '.mjs', '.css', '.json', '.md', '.yml', '.yaml', '.svg', '.txt', '']);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out); else out.push(full);
  }
  return out;
}

test('every local file the page refers to exists', () => {
  const refs = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(m => m[1]);
  for (const css of fs.readdirSync('site').filter(f => f.endsWith('.css'))) {
    refs.push(...[...fs.readFileSync(path.join('site', css), 'utf8').matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(m => m[1]));
  }
  const local = refs.filter(ref => !/^(https?:|data:|mailto:)/.test(ref));
  assert.ok(local.length > 10);
  for (const ref of local) assert.ok(fs.existsSync(path.join('site', ref)), 'missing: ' + ref);
});

test('no file under site/ is left unreferenced by accident', () => {
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
  for (const file of fs.readdirSync('site').filter(f => f.endsWith('.js'))) assert.ok(scripts.includes(file), 'unused script: ' + file);
});

test('the page talks to static files only', () => {
  for (const file of walk('site').filter(f => /\.(js|html)$/.test(f))) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /\/api\/|\/mcp\b/, file);
  }
  const app = fs.readFileSync('site/app.js', 'utf8');
  assert.match(app, /fetch\('data\/opportunities\.json'\)/);
  assert.match(app, /fetch\('data\/update-log\.json'\)/);
});

test('nothing refers to the previous host, payment code or any vendor-specific tooling', () => {
  // The words are assembled so that this file does not match itself.
  const words = ['open' + 'ai', 'chat' + 'gpt', 'oai' + '-', 'ali' + 'pay', 'co' + 'dex', 'appg' + 'prj_', 'anth' + 'ropic', 'clau' + 'de'];
  const pattern = new RegExp(words.join('|'), 'i');
  for (const file of walk('.')) {
    if (path.basename(file) === 'OFL.txt' || !TEXT.has(path.extname(file))) continue;
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), pattern, file);
    assert.doesNotMatch(file, pattern, 'file name: ' + file);
  }
});

test('the site carries its new name', () => {
  assert.match(html, /<title>科研基金雷达<\/title>/);
  assert.match(html, /<strong>科研基金雷达<\/strong><small>SCIGRANT RADAR<\/small>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/scigrantradar\.com\/">/);
  for (const file of walk('site').filter(f => /\.(js|html|css)$/.test(f))) {
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /研究机会雷达|RESEARCH RADAR/, file);
  }
});

test('the 63 original records were carried over unchanged', () => {
  const records = JSON.parse(fs.readFileSync('site/data/opportunities.json', 'utf8'));
  const log = JSON.parse(fs.readFileSync('site/data/update-log.json', 'utf8'));
  // Until the first data update lands, the file must be byte-identical to the migrated original.
  if (log.runs.length === 1) {
    assert.equal(records.length, 63);
    const hash = crypto.createHash('sha256').update(fs.readFileSync('site/data/opportunities.json')).digest('hex');
    assert.equal(hash, '2d56d0a4a6b25bce69dadc8cafd8742f7d9428dade388244d84d674f3444b891');
  }
  assert.ok(records.length >= 63);
});

test('local favourites and preferences keep their storage key and shape', () => {
  const app = fs.readFileSync('site/app.js', 'utf8');
  assert.ok(app.includes("KEY='china-research-radar-v1'") || app.includes("KEY = 'china-research-radar-v1'"));
  assert.ok(app.includes('JSON.stringify({saved,checks,preferences,preferencesVersion:4})'));
});

test('the logo is small enough to load quickly', () => {
  assert.ok(fs.statSync('site/assets/radar-star.png').size < 100 * 1024);
});

test('links shared elsewhere get a preview card', () => {
  assert.match(html, /<meta property="og:title" content="[^"]+">/);
  assert.match(html, /<meta property="og:image" content="https:\/\/scigrantradar\.com\/assets\/share-card\.png">/);
  assert.ok(fs.existsSync('site/assets/share-card.png'));
});

test('unknown addresses get a not-found page that leads home', () => {
  const page = fs.readFileSync('site/404.html', 'utf8');
  assert.match(page, /<a href="\/">/);
  // It can be served from any path, so everything it loads must be root-relative.
  for (const [, ref] of page.matchAll(/(?:src|href)="([^"]+)"/g)) assert.ok(ref.startsWith('/'), ref);
});

test('first-time visitors land on a list, not on the settings form', () => {
  const app = fs.readFileSync('site/app.js', 'utf8');
  assert.match(app, /view='national'/);
  assert.doesNotMatch(app, /timer,view='settings'/);
  assert.match(html, /id="setup-hint"/);
});

test('browsers are told to check for new versions of every file', () => {
  const lines = fs.readFileSync('site/_headers', 'utf8').split(/\r?\n/).filter(line => line && !line.startsWith('#'));
  assert.equal(lines[0], '/*');
  assert.ok(lines.slice(1).includes('  Cache-Control: no-cache'));
});
