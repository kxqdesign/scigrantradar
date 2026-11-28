import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

if (!fs.existsSync('site/llms.txt')) {
  execFileSync(process.execPath, ['scripts/build-seo.mjs', '--skip-index'], { stdio: 'inherit' });
}

const ORIGIN = 'https://scigrantradar.com';
const records = JSON.parse(fs.readFileSync('site/data/opportunities.json', 'utf8'));
const sources = JSON.parse(fs.readFileSync('site/data/sources.json', 'utf8'));
const indexHtml = fs.readFileSync('site/index.html', 'utf8');

function extractJsonLd(markup) {
  const blocks = [...markup.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.ok(blocks.length >= 1, 'missing JSON-LD block');
  return blocks.map(m => JSON.parse(m[1]));
}

test('homepage serves visible browse content, JSON-LD, pre-rendered cards, and crawlable hub links', () => {
  assert.match(indexHtml, /<section id="preferences-page"[^>]*hidden>/);
  assert.doesNotMatch(indexHtml, /<div id="browse-page"[^>]*hidden>/);
  assert.match(indexHtml, /<h1 id="view-heading">[^<]*科研基金雷达/);
  assert.match(indexHtml, /<link rel="alternate" hreflang="en" href="https:\/\/scigrantradar\.com\/en\/">/);
  assert.match(indexHtml, /<link rel="alternate" type="application\/atom\+xml"[^>]*href="https:\/\/scigrantradar\.com\/feed\.xml">/);
  assert.match(indexHtml, /<link rel="alternate" type="text\/markdown"[^>]*href="https:\/\/scigrantradar\.com\/llms\.txt">/);
  assert.match(indexHtml, /href="grant\/[^"]+\/"/);
  assert.match(indexHtml, /class="seo-directory"/);

  const [ld] = extractJsonLd(indexHtml);
  const types = ld['@graph'].map(n => n['@type']);
  assert.ok(types.includes('WebSite'));
  assert.ok(types.includes('Dataset'));
  assert.ok(types.includes('Organization'));
});

test('every opportunity has an indexable HTML page and Markdown mirror with valid JSON-LD', () => {
  for (const d of records) {
    const htmlPath = path.join('site', 'grant', d.id, 'index.html');
    const mdPath = path.join('site', 'grant', d.id, 'index.md');
    assert.ok(fs.existsSync(htmlPath), 'missing grant HTML: ' + htmlPath);
    assert.ok(fs.existsSync(mdPath), 'missing grant MD: ' + mdPath);

    const page = fs.readFileSync(htmlPath, 'utf8');
    assert.ok(page.includes(`<link rel="canonical" href="${ORIGIN}/grant/${d.id}/">`), d.id + ' canonical');
    assert.ok(page.includes('class="tldr-box"'), d.id + ' tldr');
    assert.ok(page.includes('class="facts-grid"'), d.id + ' facts table');
    assert.ok(page.includes(d.sources[0].url.replace(/&/g, '&amp;')), d.id + ' official source link');

    const [ld] = extractJsonLd(page);
    const types = ld['@graph'].map(n => n['@type']);
    assert.ok(types.includes('MonetaryGrant'), d.id + ' MonetaryGrant JSON-LD');
    assert.ok(types.includes('BreadcrumbList'), d.id + ' BreadcrumbList JSON-LD');
    assert.ok(types.includes('FAQPage'), d.id + ' FAQPage JSON-LD');
  }
});

test('core hub, authority, deadline, and English pages exist with structured data', () => {
  const requiredPaths = [
    'open/index.html',
    'national/index.html',
    'overseas/index.html',
    'hmt/index.html',
    'deadlines/index.html',
    'sources/index.html',
    'about/index.html',
    'en/index.html',
    'category/fund/index.html',
    'category/postdoc/index.html',
    'category/talent/index.html',
    'country/uk/index.html',
    'country/germany/index.html',
    'country/europe/index.html',
    'country/singapore/index.html',
    'region/jiangsu/index.html',
    'audience/phd/index.html',
    'audience/postdoc/index.html',
  ];
  for (const rel of requiredPaths) {
    const full = path.join('site', rel);
    assert.ok(fs.existsSync(full), 'missing hub page: ' + rel);
    extractJsonLd(fs.readFileSync(full, 'utf8'));
  }

  const sourcesPage = fs.readFileSync('site/sources/index.html', 'utf8');
  assert.ok(sourcesPage.includes(`共 ${sources.length} 个核验入口`), 'sources count reflected on /sources/');
  const enPage = fs.readFileSync('site/en/index.html', 'utf8');
  assert.match(enPage, /<html lang="en">/);
  assert.match(enPage, /hreflang="zh-CN"/);
});

test('sitemap.xml maps every URL to an existing HTML page with valid lastmod and no duplicates', () => {
  const xml = fs.readFileSync('site/sitemap.xml', 'utf8');
  const entries = [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)];
  assert.ok(entries.length >= records.length + 25, 'too few sitemap entries: ' + entries.length);
  const seen = new Set();
  for (const [, loc, lastmod] of entries) {
    assert.ok(loc.startsWith(ORIGIN + '/'), 'unexpected origin: ' + loc);
    assert.ok(!seen.has(loc), 'duplicate sitemap loc: ' + loc);
    seen.add(loc);
    assert.match(lastmod, /^\d{4}-\d{2}-\d{2}$/, 'invalid lastmod: ' + lastmod);
    const rel = loc.slice(ORIGIN.length + 1);
    const target = rel === '' ? 'site/index.html' : path.join('site', rel, 'index.html');
    assert.ok(fs.existsSync(target), 'sitemap target missing on disk: ' + target);
  }
});

test('GEO feeds (llms.txt, llms-full.txt, feed.xml, calendar.ics) and HTTP 301 redirects are valid', () => {
  const llms = fs.readFileSync('site/llms.txt', 'utf8');
  assert.match(llms, /SciGrant Radar/);
  assert.match(llms, /CC BY-NC 4\.0/);
  assert.match(llms, /https:\/\/scigrantradar\.com\/llms-full\.txt/);

  const llmsFull = fs.readFileSync('site/llms-full.txt', 'utf8');
  assert.ok(llmsFull.length > 20_000, 'llms-full.txt unexpectedly short');
  assert.match(llmsFull, /https:\/\/scigrantradar\.com\/grant\//);

  const feed = fs.readFileSync('site/feed.xml', 'utf8');
  assert.match(feed, /<feed xmlns="http:\/\/www\.w3\.org\/2005\/Atom"/);
  assert.ok((feed.match(/<entry>/g) || []).length >= 20, 'feed.xml should list active entries');

  const ics = fs.readFileSync('site/calendar.ics', 'utf8');
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /BEGIN:VEVENT\r\n/);
  assert.match(ics, /END:VCALENDAR\r\n$/);

  const redirects = fs.readFileSync('site/_redirects', 'utf8');
  assert.match(redirects, /https:\/\/www\.scigrantradar\.com\/\* https:\/\/scigrantradar\.com\/:splat 301!/);
});
