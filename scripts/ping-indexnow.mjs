// Notifies IndexNow-compatible search engines after a publish.
// Requires INDEXNOW_KEY in the environment and a matching site/<key>.txt file.
// Usage: INDEXNOW_KEY=<your-key> node scripts/ping-indexnow.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOST = 'scigrantradar.com';
const ORIGIN = `https://${HOST}`;
const key = process.env.INDEXNOW_KEY?.trim();

if (!key) {
  console.log('INDEXNOW_KEY not set; skipping IndexNow notification.');
  process.exit(0);
}

const keyFile = path.join(ROOT, 'site', `${key}.txt`);
if (!fs.existsSync(keyFile)) {
  console.error(`Missing verification file: ${keyFile}`);
  process.exit(1);
}

const sitemap = fs.readFileSync(path.join(ROOT, 'site', 'sitemap.xml'), 'utf8');
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);

const response = await fetch('https://api.indexnow.org/IndexNow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({
    host: HOST,
    key,
    keyLocation: `${ORIGIN}/${key}.txt`,
    urlList,
  }),
});

if (!response.ok) {
  console.error(`IndexNow returned HTTP ${response.status}: ${await response.text()}`);
  process.exit(1);
}

console.log(`IndexNow accepted ${urlList.length} URLs (HTTP ${response.status}).`);
