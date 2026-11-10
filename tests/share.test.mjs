import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({});
vm.runInContext(['geography.js', 'filter-logic.js', 'share-logic.js'].map(f => fs.readFileSync('site/' + f, 'utf8')).join('\n'), context);
const { sharedId, shareHash, viewForRecord, inView } = context;
const records = JSON.parse(fs.readFileSync('site/data/opportunities.json', 'utf8'));

test('a share link round-trips a record ID', () => {
  for (const id of ['nsfc-annual', 'a_b-2027']) assert.equal(sharedId(shareHash(id)), id);
  assert.equal(shareHash('nsfc-annual'), '#o=nsfc-annual');
});

test('other hashes are not share links', () => {
  for (const hash of ['', '#', '#method', '#top', '#o=', '#nsfc-annual', null, undefined]) assert.equal(sharedId(hash), null, String(hash));
  assert.equal(sharedId('#o=%E0%A4%A'), null);
});

test('every record is listed in the view a share link opens, with no preferences set', () => {
  for (const d of records) {
    const view = viewForRecord(d);
    assert.ok(inView(d, view, null, { province: '', city: '' }), d.id + ' not shown in ' + view);
  }
});
