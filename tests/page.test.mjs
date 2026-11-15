import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// Loads every script the page loads, in page order, against a stand-in for the browser,
// then draws each view with the published data. A change that reaches one script but not
// the script it depends on (a function called in app.js and defined in geography.js, say)
// fails here instead of on the live site.

const html = fs.readFileSync('site/index.html', 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
const records = JSON.parse(fs.readFileSync('site/data/opportunities.json', 'utf8'));

// An element that accepts whatever the page does to it and remembers what was written.
function element() {
  const state = {
    value: '', textContent: '', innerHTML: '', title: '', id: '',
    hidden: false, checked: false, disabled: false, open: false,
    dataset: {}, style: {}, options: [], children: [],
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  };
  return new Proxy(state, {
    get(target, key) {
      if (key in target) return target[key];
      if (typeof key === 'symbol') return undefined;
      if (key === 'querySelectorAll') return () => [];
      if (['querySelector', 'closest', 'appendChild', 'cloneNode'].includes(key)) return () => element();
      return () => undefined;
    },
    set(target, key, value) { target[key] = value; return true; },
  });
}

function loadPage({ hash = '' } = {}) {
  const found = new Map();
  const lookup = selector => { if (!found.has(selector)) found.set(selector, element()); return found.get(selector); };
  // The failure notice starts hidden in index.html; the page reveals it when loading goes wrong.
  lookup('#load-error').hidden = true;
  const body = element();
  const document = {
    title: '科研基金雷达', body, activeElement: null,
    querySelector: lookup,
    getElementById: id => lookup('#' + id),
    querySelectorAll: () => [],
    createElement: () => element(),
    addEventListener() {},
  };
  const files = { 'data/opportunities.json': 'site/data/opportunities.json', 'data/update-log.json': 'site/data/update-log.json' };
  const sandbox = {
    document, console, URL, Intl, Date, JSON, Promise, Map, Set, Math,
    location: { hostname: 'scigrantradar.com', origin: 'https://scigrantradar.com', pathname: '/', search: '', hash, replace() {} },
    history: { replaceState() {} },
    navigator: {},
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    CSS: { escape: value => String(value) },
    setTimeout: () => 0, clearTimeout() {},
    scrollY: 0, scrollTo() {}, addEventListener() {},
    fetch: async url => {
      if (!files[url]) throw new Error('unexpected request: ' + url);
      return { ok: true, json: async () => JSON.parse(fs.readFileSync(files[url], 'utf8')) };
    },
  };
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  for (const file of scripts) vm.runInContext(fs.readFileSync('site/' + file, 'utf8'), context, { filename: file });
  const run = code => vm.runInContext(code, context);
  return { run, lookup };
}

const cardsIn = markup => (markup.match(/<article class="card/g) || []).length;

test('the page lists the scripts this test expects to load', () => {
  for (const file of ['geography.js', 'schedule.js', 'timeline.js', 'filter-logic.js', 'share-logic.js', 'app.js']) {
    assert.ok(scripts.includes(file), 'index.html no longer loads ' + file);
  }
});

test('every script loads and the published data is drawn without an error', async () => {
  const { run, lookup } = loadPage();
  await run('recordsLoaded');
  assert.equal(lookup('#load-error').hidden, true, 'the page reported a load failure');
  assert.doesNotMatch(lookup('#result-count').textContent, /加载失败/);
  assert.equal(run('data.length'), records.length);
  assert.ok(cardsIn(lookup('#cards').innerHTML) > 0, 'the first view drew no cards');
});

test('each view draws in each layout', async () => {
  const { run, lookup } = loadPage();
  await run('recordsLoaded');
  const expected = {
    national: records.filter(d => ['national', 'hmt'].includes(d.scope)).length,
    overseas: records.filter(d => d.scope === 'overseas').length,
    explore: records.filter(d => ['province', 'city', 'joint'].includes(d.scope)).length,
  };
  for (const [view, count] of Object.entries(expected)) {
    for (const layout of ['timeline', 'list', 'cards']) {
      run(`view=${JSON.stringify(view)};layout=${JSON.stringify(layout)};country='';render()`);
      assert.match(lookup('#result-count').textContent, new RegExp('· ' + count + ' 项$'), view + ' / ' + layout);
      // The timeline repeats a card at each of its dates, so it can only be checked for not being empty.
      const drawn = cardsIn(lookup('#cards').innerHTML);
      if (layout === 'timeline') assert.ok(drawn >= count, view + ' / timeline drew ' + drawn);
      else assert.equal(drawn, count, view + ' / ' + layout);
    }
  }
  run("view='saved';render()");
  assert.match(lookup('#result-count').textContent, /· 0 项$/);
});

test('the overseas country tabs cover every overseas record exactly once', async () => {
  const { run, lookup } = loadPage();
  await run('recordsLoaded');
  run("view='overseas';layout='list';country='';render()");
  const tabs = [...lookup('#country-row').innerHTML.matchAll(/data-country="([^"]*)"[^>]*>[^<]*<span>(\d+)<\/span>/g)].map(m => [m[1], Number(m[2])]);
  assert.equal(tabs[0][0], '');
  assert.equal(tabs[0][1], records.filter(d => d.scope === 'overseas').length);
  assert.equal(tabs.slice(1).reduce((sum, [, n]) => sum + n, 0), tabs[0][1]);
  for (const [tab, n] of tabs.slice(1)) {
    run(`country=${JSON.stringify(tab)};render()`);
    assert.equal(cardsIn(lookup('#cards').innerHTML), n, tab);
  }
});

test('a shared link opens its record', async () => {
  const shared = records.find(d => d.scope === 'overseas');
  const { run, lookup } = loadPage({ hash: '#o=' + encodeURIComponent(shared.id) });
  await run('recordsLoaded');
  assert.equal(run('view'), 'overseas');
  assert.ok(lookup('#cards').innerHTML.includes('data-opportunity="' + shared.id + '"'));
});
