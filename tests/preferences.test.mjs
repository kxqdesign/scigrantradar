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
  assert(visible(national).every(d => ['national', 'hmt'].includes(d.scope)));
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
  assert.deepEqual(normalize({ scopeVersion: 1, province: '江苏', city: '南京', level: ['national'] }).level, ['national', 'hmt', 'province', 'city', 'joint']);
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
    assert.deepEqual(p.level, ['national', 'hmt', 'province', 'city', 'joint']);
  }
  assert.equal(normalize({ ...base, province: '陕西', city: '南京' }).city, '');
});

test('Hong Kong, Macao and Taiwan programmes are listed with the national ones', () => {
  const hmt = rows.filter(d => d.scope === 'hmt');
  assert(hmt.length > 0);
  assert(hmt.every(d => d.region === '国内' && context.inView(d, 'national', null, {}) && !context.inView(d, 'overseas', null, {})));
  const ids = p => visible(normalize(p)).map(d => d.id);
  assert(hmt.every(d => ids({ ...base, discipline: [] }).includes(d.id)));
  assert(!hmt.some(d => ids({ ...base, discipline: [], coverage: ['overseas'] }).includes(d.id)));
  assert.equal(context.scopeLabel({ scope: 'hmt', jurisdiction: { province: '香港' } }), '港澳台 · 香港');
  assert.equal(context.viewForRecord?.(hmt[0]) ?? 'national', 'national');
});

test('the overseas page offers a fixed row of country tabs, and 其他 for the rest', () => {
  const at = country => ({ jurisdiction: { country } });
  const sample = [at('新加坡'), at('英国'), at('英国'), at('英国'), at('日本'), at('日本'), at('瑞士'), at('多国'), at('多国'), { jurisdiction: {} }];
  // A European country without its own tab is listed under 欧洲.
  assert.equal(context.countryTab(at('瑞士')), '欧洲');
  assert.equal(context.countryTab(at('日本')), '其他');
  assert.equal(context.scopeLabel({ scope: 'overseas', jurisdiction: { country: '瑞士' } }), '境外 · 瑞士');
  assert.equal(context.scopeLabel({ scope: 'overseas', jurisdiction: { country: '多国' } }), '境外');
  const tabs = JSON.parse(JSON.stringify(context.countryTabs(sample)));
  // Fixed order, only tabs that have records; 德国 is absent from this sample.
  assert.deepEqual(tabs, ['英国', '欧洲', '新加坡']);
  const count = tab => sample.filter(d => context.inCountry(d, tab, tabs)).length;
  assert.deepEqual([count(''), count('英国'), count('欧洲'), count('新加坡'), count('其他')], [10, 3, 1, 1, 5]);
  assert.deepEqual(JSON.parse(JSON.stringify(context.countryTabs(rows))), ['英国', '德国', '欧洲', '新加坡']);
  const overseas = rows.filter(d => d.scope === 'overseas');
  assert(overseas.every(d => d.jurisdiction.country));
  const live = context.countryTabs(overseas);
  assert.equal(['', ...live, '其他'].slice(1).reduce((n, tab) => n + overseas.filter(d => context.inCountry(d, tab, live)).length, 0), overseas.length);
});
