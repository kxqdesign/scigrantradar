import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({});
// Top-level const is not exposed on the vm global, so hand the functions out explicitly.
vm.runInContext(['schedule.js', 'timeline.js', 'share-logic.js'].map(f => fs.readFileSync('site/' + f, 'utf8')).join('\n')
  + '\nglobalThis.api={withSchedule,statusLine,datesText,timelineEvents,nextDates,nodeLine,shareSummary,PHASE};', context);
const { withSchedule, statusLine, datesText, timelineEvents, nextDates, nodeLine, shareSummary, PHASE } = context.api;

const TODAY = '2026-11-10';
const local = value => JSON.parse(JSON.stringify(value));
const plain = html => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const at = (d, today = TODAY) => withSchedule({ name: 'x', dateLabel: '存档文字', ...d }, today);
const line = (d, today = TODAY) => plain(statusLine(at(d, today), today));
const window = { status: 'upcoming', opensOn: '2026-11-26', date: '2026-11-26', deadline: '2026-12-07', deadlineTime: '17:00' };

test('the phase follows the dates and only moves forward', () => {
  assert.equal(at(window).phase, 'upcoming');
  assert.equal(at(window, '2026-11-25').phase, 'upcoming');
  assert.equal(at(window, '2026-11-26').status, 'open');
  assert.equal(at(window, '2026-12-07').phase, 'soon');
  assert.equal(at(window, '2026-12-08').phase, 'closed');
  assert.equal(at(window, '2026-12-08').status, 'closed');
  assert.equal(at({ status: 'closed', date: '2026-12-20', deadline: '2026-12-20' }).phase, 'closed');
  assert.equal(at({ status: 'verify', deadline: '2026-01-01' }).phase, 'verify');
  assert.equal(at({ status: 'upcoming', deadline: '2027-04-23' }).phase, 'upcoming');
  assert.deepEqual(Object.keys(PHASE), ['upcoming', 'open', 'soon', 'closed', 'verify']);
});

test('an open call becomes "soon" within 14 days of its deadline', () => {
  assert.equal(at({ status: 'open', date: '2026-11-25', deadline: '2026-11-25' }).phase, 'open');
  assert.equal(at({ status: 'open', date: '2026-11-24', deadline: '2026-11-24' }).phase, 'soon');
  assert.equal(at({ status: 'open', date: '2026-11-24', deadline: '2026-11-24' }).status, 'open');
});

test('an upcoming record keeps its opening date when date holds the deadline', () => {
  const d = at({ status: 'upcoming', opensOn: '2026-11-13', date: '2026-12-08', deadline: '2026-12-08' });
  assert.deepEqual([d.opening, d.closing, d.nextDate], ['2026-11-13', '2026-12-08', '2026-11-13']);
});

test('scheduling twice changes nothing', () => {
  const once = at(window, '2026-12-01');
  assert.equal(withSchedule(once, '2026-12-01'), once);
});

test('status rows read opening → closing', () => {
  assert.equal(line(window), '11/26 开放 → 12/7 17:00 截止 · 16 天后');
  assert.equal(line(window, '2026-11-26'), '11/26 已开放 → 12/7 17:00 截止 · 还剩 11 天');
  assert.equal(line(window, '2026-12-07'), '11/26 已开放 → 12/7 17:00 截止 · 今天');
  assert.equal(line(window, '2026-12-08'), '11/26 – 12/7 · 窗口 11 天');
  assert.equal(line({ status: 'open', date: '2026-12-20', deadline: '2026-12-20' }), '12/20 截止 · 还剩 40 天');
  assert.equal(line({ status: 'closed', date: '2026-03-20', deadline: '2026-03-20' }), '3/20');
  assert.equal(line({ status: 'closed', opensOn: '2025-09-15', date: '2025-09-30', deadline: '2025-09-30' }), '2025/9/15 – 9/30 · 窗口 15 天');
});

test('status rows cover calls without a fixed date at one end', () => {
  assert.equal(line({ status: 'upcoming', date: '2026-11-15', closesWhenFull: true }), '11/15 开放 → 满额即止 · 5 天后');
  assert.equal(line({ status: 'upcoming', date: '2026-11-15', closesWhenFull: true }, '2026-11-20'), '11/15 已开放 → 满额即止 · 尽快');
  assert.equal(line({ status: 'upcoming', date: '2026-11-15', dateLabel: '11月15日下一轮开放 · 满额即关闭' }, '2026-11-20'), '11/15 已开放 → 满额即止 · 尽快');
  assert.equal(line({ status: 'upcoming', date: '2026-11-15' }, '2026-11-20'), '11/15 已开放 → 无固定截止');
  assert.equal(line({ status: 'upcoming', deadline: '2027-04-23', dateLabel: '2027年4月23日 17:00 JST 截止' }), '开放日待公布 → 2027/4/23 17:00 JST 截止 · 约 5 个月后');
});

test('records without confirmed dates keep their stored wording, escaped', () => {
  assert.equal(line({ status: 'open', dateLabel: '滚动开放 · 无固定截止' }), '滚动开放 · 无固定截止');
  assert.equal(line({ status: 'closed', dateLabel: '2027年度已截止 · 最终截止日待核' }), '2027年度已截止 · 最终截止日待核');
  assert.equal(line({ status: 'verify', deadline: '2026-12-01', dateLabel: '指南已发布，截止时间须登录核实' }), '指南已发布，截止时间须登录核实');
  assert.match(statusLine(at({ status: 'open', dateLabel: '<b>x</b>' }), TODAY), /&lt;b&gt;/);
});

test('the closing time comes from deadlineTime, or from the label only when it names one time', () => {
  const close = { status: 'open', date: '2027-01-10', deadline: '2027-01-10' };
  assert.equal(at({ ...close, dateLabel: '2027年1月10日 16:00 截止' }).closeTime, '16:00');
  assert.equal(at({ ...close, dateLabel: '2027年1月10日 23:00 CET 截止（北京时间1月11日06:00）' }).closeTime, '');
  assert.equal(at({ ...close, dateLabel: '11月13日 8:00 开放 · 12月8日 16:00 截止', deadlineTime: '16:00' }).closeTime, '16:00');
});

test('the timeline gives each opportunity one full card, at its next date', () => {
  const rows = [
    at({ id: 'a', name: '甲', ...window }),
    at({ id: 'b', name: '乙', status: 'open', opensOn: '2026-10-30', date: '2026-11-26', deadline: '2026-11-26' }),
    at({ id: 'c', name: '丙', status: 'closed', opensOn: '2026-08-05', date: '2026-08-24', deadline: '2026-08-24' }),
    at({ id: 'd', name: '丁', status: 'open', dateLabel: '滚动开放' }),
    at({ id: 'e', name: '戊', status: 'upcoming', date: '2026-11-15', closesWhenFull: true }),
  ];
  const { events, undated } = timelineEvents(rows);
  // On a shared day the deadline comes before the opening.
  assert.deepEqual(local(events.map(e => [e.d.id, e.kind, e.date, e.primary])), [
    ['c', 'closing', '2026-08-24', true],
    ['e', 'opening', '2026-11-15', true],
    ['b', 'closing', '2026-11-26', true],
    ['a', 'opening', '2026-11-26', true],
    ['a', 'closing', '2026-12-07', false],
  ]);
  assert.deepEqual(local(undated.map(d => d.id)), ['d']);
  assert.deepEqual(local(nextDates(rows, TODAY).map(e => e.d.id)), ['e', 'b', 'a']);
  assert.equal(plain(nodeLine(events[3], TODAY)), '16 天后开放 · 12/7 17:00 截止 · 窗口 11 天');
  assert.equal(plain(nodeLine(events[2], TODAY)), '还剩 16 天 · 10/30 已开放');
  assert.equal(plain(nodeLine(events[0], TODAY)), '8/5 – 8/24 · 窗口 19 天');
  assert.equal(plain(nodeLine(events[1], TODAY)), '5 天后开放 · 满额即止');
});

test('shared text carries full dates and nothing that goes stale', () => {
  assert.equal(shareSummary(at({ ...window, name: '甲' })), '甲｜2026/11/26 开放 → 2026/12/7 17:00 截止');
  assert.equal(shareSummary(at({ ...window, name: '甲' }, '2026-12-01')), '甲｜2026/11/26 已开放 → 2026/12/7 17:00 截止');
  assert.equal(shareSummary(at({ ...window, name: '甲' }, '2026-12-08')), '甲｜已截止 · 2026/11/26 – 12/7 · 窗口 11 天');
  assert.equal(shareSummary(at({ name: '乙', status: 'open', dateLabel: '滚动开放 · 无固定截止' })), '乙｜滚动开放 · 无固定截止');
  assert.equal(shareSummary(at({ name: '丙', status: 'upcoming', date: '2026-11-15', closesWhenFull: true }, '2026-11-20')), '丙｜2026/11/15 已开放 → 满额即止');
  assert.equal(datesText(at({ status: 'upcoming', deadline: '2027-04-23', deadlineTime: '17:00 JST' })), '开放日待公布 → 2027/4/23 17:00 JST 截止');
});

test('every published record can be scheduled and worded', () => {
  const records = JSON.parse(fs.readFileSync('site/data/opportunities.json', 'utf8'));
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
  const rows = records.map(d => withSchedule(d, today));
  for (const d of rows) {
    assert.ok(PHASE[d.phase], d.id);
    assert.ok(plain(statusLine(d, today)), d.id);
    assert.ok(datesText(d), d.id);
    assert.doesNotMatch(plain(statusLine(d, today)) + datesText(d), /NaN|undefined|null/, d.id);
  }
  const { events, undated } = timelineEvents(rows);
  assert.equal(events.filter(e => e.primary).length + undated.length, rows.length);
});
