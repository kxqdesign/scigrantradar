import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validate, validateRecord, validateRun, todayInShanghai } from '../scripts/validate.mjs';

const TODAY = '2026-11-15';
const realRecords = JSON.parse(fs.readFileSync('site/data/opportunities.json', 'utf8'));
const realLog = JSON.parse(fs.readFileSync('site/data/update-log.json', 'utf8'));
const clone = value => structuredClone(value);

// A small, fixed starting point so these tests do not depend on the live data.
const baseRecords = clone(realRecords.slice(0, 3)).map(d => ({ ...d, verified: '2026-11-09' }));
const baseLog = { runs: [{ id: 'initialization', kind: 'initialize', date: '2026-11-10', at: '2026-11-09T21:43:52.576Z', outcome: 'success', summary: '初始收录', added: 0, updated: 0, checkedIds: [], checkedSources: [], issues: [] }] };

function researchRun(record, overrides = {}) {
  return {
    id: 'weekly-' + (overrides.date || TODAY), kind: 'research', date: TODAY, at: (overrides.date || TODAY) + 'T12:00:00.000Z',
    outcome: 'success', summary: '例行检查', added: 0, updated: 1, checkedIds: [record.id],
    checkedSources: [{ url: record.sources[0].url, label: '官方通知', result: 'checked' }], issues: [], ...overrides,
  };
}

/** One record edited and one matching research run added on top of the base. */
function update(edit = () => {}, runOverrides = {}) {
  const records = clone(baseRecords);
  records[0].sourceNote = '已按官方通知更正';
  records[0].verified = TODAY;
  const log = { runs: [researchRun(records[0], runOverrides), ...clone(baseLog.runs)] };
  edit(records, log);
  return { records, log, baseRecords, baseLog, today: TODAY };
}

const codes = errors => errors.map(e => e.match(/^\[([^\]]+)\]/)?.[1]);
const rejects = (input, code) => assert.ok(codes(validate(input)).includes(code), `expected ${code}, got: ${JSON.stringify(validate(input))}`);
const accepts = input => assert.deepEqual(validate(input), []);

test('the published data passes on its own and against itself', () => {
  const today = todayInShanghai();
  accepts({ records: realRecords, log: realLog, today });
  accepts({ records: realRecords, log: realLog, baseRecords: realRecords, baseLog: realLog, today });
});

test('todayInShanghai uses the Beijing calendar day', () => {
  assert.equal(todayInShanghai(new Date('2026-11-09T21:43:52Z')), '2026-11-10');
  assert.equal(todayInShanghai(new Date('2026-11-09T15:59:59Z')), '2026-11-09');
});

test('record rules', async t => {
  const good = baseRecords[0];
  const bad = (name, code, edit) => t.test(name, () => {
    const d = clone(good); edit(d);
    assert.ok(codes(validateRecord(d, TODAY)).includes('record:' + code), JSON.stringify(validateRecord(d, TODAY)));
  });
  await t.test('a good record has no errors', () => assert.deepEqual(validateRecord(good, TODAY), []));
  await t.test('a record that is not an object', () => assert.deepEqual(codes(validateRecord(['x'], TODAY)), ['record:shape']));
  await bad('upper-case ID', 'id', d => { d.id = 'NSFC-2026'; });
  await bad('missing summary', 'text', d => { delete d.summary; });
  await bad('blank name', 'text', d => { d.name = '   '; });
  await bad('unknown status', 'status', d => { d.status = 'maybe'; });
  await bad('unknown scope', 'scope', d => { d.scope = 'planet'; });
  await bad('unknown region', 'region', d => { d.region = '海外'; });
  await bad('overseas scope with domestic region', 'region-scope', d => { d.scope = 'overseas'; d.region = '国内'; });
  await bad('empty disciplines', 'disciplines', d => { d.disciplines = []; });
  await bad('unknown discipline', 'disciplines', d => { d.disciplines = ['arts']; });
  await bad('empty audience', 'audience', d => { d.audience = []; });
  await bad('no sources', 'sources', d => { d.sources = []; });
  await bad('source without a label', 'source-label', d => { d.sources[0].label = ''; });
  await bad('javascript: link', 'source-url', d => { d.sources[0].url = 'javascript:alert(1)'; });
  await bad('link with credentials', 'source-url', d => { d.sources[0].url = 'https://user:pass@example.org/'; });
  await bad('a date that does not exist', 'date', d => { d.deadline = '2026-02-30'; });
  await bad('a date in another format', 'date', d => { d.opensOn = '2026/03/01'; });
  await bad('missing verification date', 'verified', d => { d.verified = null; });
  await bad('verification date in the future', 'verified-future', d => { d.verified = '2026-11-16'; });
  await bad('opening after deadline', 'interval', d => { d.opensOn = '2026-05-02'; d.deadline = '2026-05-01'; });
  await bad('province programme without a province', 'province', d => { d.scope = 'province'; d.region = '国内'; d.jurisdiction = {}; });
  await bad('city programme without a city', 'city', d => { d.scope = 'city'; d.region = '国内'; d.jurisdiction = { province: '江苏' }; });
  await bad('joint programme without eligible areas', 'eligible-areas', d => { d.scope = 'joint'; d.region = '国内'; d.eligibleAreas = []; });
  await bad('oversized record', 'size', d => { d.geographyNote = 'x'.repeat(40000); });
  await t.test('unknown dates may be null or empty', () => {
    const d = clone(good); d.date = null; d.deadline = ''; d.opensOn = null;
    assert.deepEqual(validateRecord(d, TODAY), []);
  });
});

test('run rules', async t => {
  const good = researchRun(baseRecords[0]);
  const bad = (name, code, edit) => t.test(name, () => {
    const run = clone(good); edit(run);
    assert.ok(codes(validateRun(run, TODAY)).includes('run:' + code), JSON.stringify(validateRun(run, TODAY)));
  });
  await t.test('a good run has no errors', () => assert.deepEqual(validateRun(good, TODAY), []));
  await bad('ID with spaces', 'id', r => { r.id = 'weekly run'; });
  await bad('unknown kind', 'kind', r => { r.kind = 'deploy'; });
  await bad('impossible date', 'date', r => { r.date = '2026-13-01'; });
  await bad('date in the future', 'date-future', r => { r.date = '2026-11-16'; });
  await bad('unparseable timestamp', 'at', r => { r.at = 'yesterday'; });
  await bad('no summary', 'summary', r => { r.summary = ''; });
  await bad('unknown outcome', 'outcome', r => { r.outcome = 'fine'; });
  await bad('negative count', 'counts', r => { r.added = -1; });
  await bad('missing list', 'lists', r => { delete r.issues; });
  await bad('checked source with a bad result', 'checked-source', r => { r.checkedSources[0].result = 'ok'; });
  await bad('issue without a message', 'issue', r => { r.issues = [{ url: 'https://example.org/' }]; r.outcome = 'partial'; });
  await bad('research run with no sources', 'no-sources', r => { r.checkedSources = []; });
  await bad('success despite an unavailable source', 'outcome-success', r => { r.checkedSources.push({ url: 'https://example.org/', label: 'x', result: 'unavailable' }); });
  await bad('success despite an open issue', 'outcome-success', r => { r.issues = [{ url: 'https://example.org/', message: '超时' }]; });
  await bad('correction without listed records', 'corrected-ids', r => { r.kind = 'correction'; });
  await t.test('partial outcome with an unavailable source is fine', () => {
    const run = clone(good); run.outcome = 'partial';
    run.checkedSources.push({ url: 'https://example.org/', label: 'x', result: 'unavailable' });
    run.issues = [{ url: 'https://example.org/', message: '超时' }];
    assert.deepEqual(validateRun(run, TODAY), []);
  });
});

test('whole-file rules', async t => {
  await t.test('records must be an array', () => rejects({ records: {}, log: baseLog, today: TODAY }, 'records:shape'));
  await t.test('log must hold a runs array', () => rejects({ records: baseRecords, log: [], today: TODAY }, 'log:shape'));
  await t.test('duplicate record ID', () => rejects({ records: [...baseRecords, clone(baseRecords[0])], log: baseLog, today: TODAY }, 'records:duplicate-id'));
  await t.test('duplicate run ID', () => rejects({ records: baseRecords, log: { runs: [...baseLog.runs, ...baseLog.runs] }, today: TODAY }, 'log:duplicate-run'));
  await t.test('checked ID that is not a record', () => rejects(update((_, log) => { log.runs[0].checkedIds.push('no-such-record'); }), 'log:unknown-id'));
  await t.test('runs out of order', () => rejects({ records: baseRecords, log: { runs: [...baseLog.runs, researchRun(baseRecords[0], { updated: 0 })] }, today: TODAY }, 'log:order'));
  await t.test('more than 104 runs', () => {
    const runs = Array.from({ length: 105 }, (_, i) => ({ ...baseLog.runs[0], id: 'run-' + i }));
    rejects({ records: baseRecords, log: { runs }, today: TODAY }, 'log:too-long');
  });
});

test('accepted changes', async t => {
  await t.test('a change that touches no data needs no run entry', () => accepts({ records: baseRecords, log: baseLog, baseRecords, baseLog, today: TODAY }));
  await t.test('one corrected record with a matching research run', () => accepts(update()));
  await t.test('reordering the keys of a record is not a change', () => {
    const records = clone(baseRecords);
    records[1] = Object.fromEntries(Object.entries(records[1]).reverse());
    accepts({ records, log: baseLog, baseRecords, baseLog, today: TODAY });
  });
  await t.test('a new record with a matching research run', () => accepts(update((records, log) => {
    records[0] = clone(baseRecords[0]);
    records.push({ ...clone(baseRecords[0]), id: 'brand-new-2027', verified: TODAY });
    Object.assign(log.runs[0], { added: 1, updated: 0, checkedIds: ['brand-new-2027'] });
  })));
  await t.test('a run that found nothing to change', () => accepts(update((records, log) => {
    records[0] = clone(baseRecords[0]);
    log.runs[0].updated = 0;
  })));
  await t.test('two weekly runs stacked in one request', () => {
    const input = update();
    input.records[1].sourceNote = '上周已更正';
    input.records[1].verified = '2026-11-12';
    input.log.runs.splice(1, 0, { ...researchRun(input.records[1]), id: 'weekly-2026-11-12', date: '2026-11-12', at: '2026-11-12T12:00:00.000Z' });
    accepts(input);
  });
  await t.test('a hand correction that leaves the verification date alone', () => accepts(update((records, log) => {
    records[0] = clone(baseRecords[0]);
    records[0].name += '（更正错别字）';
    log.runs[0] = { id: 'fix-typo', kind: 'correction', date: TODAY, at: TODAY + 'T09:00:00.000Z', outcome: 'success', summary: '更正名称中的错别字', added: 0, updated: 1, checkedIds: [], checkedSources: [], issues: [], correctedIds: [records[0].id] };
  })));
  await t.test('the oldest runs may be trimmed', () => {
    const longBase = { runs: [{ ...baseLog.runs[0], id: 'newer', at: '2026-11-12T00:00:00.000Z' }, ...baseLog.runs] };
    accepts({ records: baseRecords, log: { runs: [longBase.runs[0]] }, baseRecords, baseLog: longBase, today: TODAY });
  });
  await t.test('files that did not exist at the base are treated as new', () => accepts({ records: baseRecords, log: baseLog, baseRecords: null, baseLog: null, today: TODAY }));
});

test('rejected changes', async t => {
  await t.test('an existing ID disappears', () => rejects(update(records => { records.pop(); }), 'base:removed-id'));
  await t.test('an existing ID is renamed', () => rejects(update(records => { records[2].id += '-renamed'; }), 'base:removed-id'));
  await t.test('a record changes with no new run', () => rejects(update((_, log) => { log.runs.shift(); }), 'base:no-run'));
  await t.test('verification date differs from the run date', () => rejects(update(records => { records[0].verified = '2026-11-14'; }), 'base:unverified-change'));
  await t.test('the cited source was not read in this run', () => rejects(update((_, log) => { log.runs[0].checkedSources[0].url = 'https://example.org/other'; }), 'base:unverified-change'));
  await t.test('the cited source was unavailable in this run', () => rejects(update((_, log) => { log.runs[0].checkedSources[0].result = 'unavailable'; log.runs[0].outcome = 'partial'; }), 'base:unverified-change'));
  await t.test('a second record changes without being covered', () => rejects(update(records => { records[1].summary += ' 改动'; }), 'base:unverified-change'));
  await t.test('a correction run that does not list the edited record', () => rejects(update((records, log) => {
    log.runs[0] = { id: 'fix', kind: 'correction', date: TODAY, at: TODAY + 'T09:00:00.000Z', outcome: 'success', summary: '更正', added: 0, updated: 1, checkedIds: [], checkedSources: [], issues: [], correctedIds: [records[1].id] };
  }), 'base:unverified-change'));
  await t.test('an earlier run is rewritten', () => rejects(update((_, log) => { log.runs[1].summary = '改写历史'; }), 'base:history'));
  await t.test('a new run is inserted below an earlier one', () => rejects(update((_, log) => { log.runs.reverse(); }), 'base:history'));
  await t.test('counts in the run do not match what changed', () => rejects(update((_, log) => { log.runs[0].updated = 5; }), 'base:counts'));
  await t.test('verification date in the future', () => rejects(update((records, log) => { records[0].verified = '2026-11-16'; log.runs[0].date = '2026-11-16'; }), 'record:verified-future'));
});
