import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// These counts describe the 63 records the site was migrated with. Once the data
// changes, the behaviour is still checked but the exact counts no longer apply.
const rows = JSON.parse(fs.readFileSync('site/data/opportunities.json', 'utf8'));
const log = JSON.parse(fs.readFileSync('site/data/update-log.json', 'utf8'));
const original = log.runs.length === 1;

const context = vm.createContext({});
vm.runInContext(fs.readFileSync('site/geography.js', 'utf8') + '\n' + fs.readFileSync('site/filter-logic.js', 'utf8'), context);
const normalize = p => JSON.parse(JSON.stringify(context.normalizePreferences(p)));
const base = { scopeVersion: 2, coverage: ['national'], province: '江苏', city: '南京', discipline: ['natural'] };
const visible = p => rows.filter(d => context.inView(d, 'home', p, {}) && context.matches(d, p));
const count = (actual, expected) => { if (original) assert.equal(actual, expected); };

test('national, selected regions and overseas combine as a union', () => {
  const defaults = normalize(base);
  count(visible(defaults).length, 20);
  assert(!visible(defaults).some(d => d.scope === 'overseas'));
  assert(visible(defaults).some(d => d.scope === 'province'));
  const both = normalize({ ...base, coverage: ['national', 'overseas'] });
  count(visible(both).length, 30);
  assert(visible(both).every(d => d.disciplines.includes('natural')));
  const foreign = normalize({ ...base, coverage: ['overseas'], province: '', city: '' });
  count(visible(foreign).length, 10);
  assert(visible(foreign).every(d => d.scope === 'overseas'));
  const national = normalize({ ...base, province: '', city: '' });
  count(visible(national).length, 17);
  assert(visible(national).every(d => d.scope === 'national'));
});

test('local programmes stay local and empty selections show nothing', () => {
  const defaults = normalize(base);
  const local = normalize({ ...base, coverage: [] });
  count(visible(local).length, 3);
  assert(!visible(local).some(d => d.scope === 'national' || d.scope === 'overseas'));
  assert(!visible(defaults).some(d => d.id === 'suzhou-medical-2026'));
  assert(visible(normalize({ ...base, discipline: [] })).some(d => d.id === 'nanjing-softscience-2026'));
  assert.equal(visible(normalize({ ...base, coverage: [], province: '', city: '' })).length, 0);
});

test('preferences saved by earlier versions still load', () => {
  const defaults = normalize(base);
  const oldDomestic = normalize({ province: '江苏', city: '南京', discipline: ['natural'], source: ['国内'], level: [] });
  assert.deepEqual(visible(oldDomestic).map(d => d.id), visible(defaults).map(d => d.id));
  assert.deepEqual(normalize(oldDomestic), oldDomestic);
  assert.deepEqual(normalize({ scopeVersion: 1, province: '江苏', city: '南京', level: ['national'] }).level, ['national', 'province', 'city', 'joint']);
  assert.deepEqual(normalize({ source: ['国际'], level: [] }).coverage, ['overseas']);
  assert(!Object.hasOwn(oldDomestic, 'source'));
  for (const layout of ['timeline', 'list', 'cards']) assert.equal(normalize({ ...base, layout }).layout, layout);
});

test('newly added provinces and their capitals can be chosen as a home region', () => {
  const added = { 陕西: '西安', 湖北: '武汉', 四川: '成都', 黑龙江: '哈尔滨', 湖南: '长沙', 辽宁: '沈阳' };
  for (const [province, city] of Object.entries(added)) {
    const p = normalize({ ...base, province, city });
    assert.equal(p.province, province);
    assert.equal(p.city, city);
    assert.deepEqual(p.level, ['national', 'province', 'city', 'joint']);
  }
  assert.equal(normalize({ ...base, province: '陕西', city: '南京' }).city, '');
});
