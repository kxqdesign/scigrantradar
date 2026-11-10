// Checks the data files before they are published.
//
//   node scripts/validate.mjs                 rules that hold for the files on their own
//   node scripts/validate.mjs --base <ref>    also compare with the same files at a git ref
//
// Every problem is reported as "[code] message". Exit status 1 if there is any.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const RECORDS_PATH = 'site/data/opportunities.json';
export const LOG_PATH = 'site/data/update-log.json';
export const MAX_RUNS = 104;

const REQUIRED_TEXT = ['name', 'org', 'category', 'fields', 'dateLabel', 'summary', 'eligibility', 'support', 'prep', 'next'];
const STATUSES = ['open', 'upcoming', 'closed', 'verify'];
const SCOPES = ['national', 'province', 'city', 'joint', 'overseas'];
const REGIONS = ['国内', '国际'];
const DISCIPLINES = ['natural', 'social'];
const RUN_KINDS = ['initialize', 'research', 'correction'];
const OUTCOMES = ['success', 'partial'];
const SOURCE_RESULTS = ['checked', 'unavailable'];

export function todayInShanghai(now = new Date()) {
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
}

const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const isText = (v, max = 8000) => typeof v === 'string' && v.trim() !== '' && v.length <= max;
const isCount = v => Number.isInteger(v) && v >= 0;

function isRealDate(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const parsed = new Date(v + 'T00:00:00Z');
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === v;
}

function isSafeUrl(v) {
  if (typeof v !== 'string') return false;
  try {
    const u = new URL(v);
    return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password;
  } catch { return false; }
}

// Key order does not make two records different.
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (isObject(value)) return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
const same = (a, b) => canonical(a) === canonical(b);

export function validateRecord(d, today) {
  if (!isObject(d)) return ['[record:shape] 记录必须是一个对象'];
  const errors = [];
  const at = typeof d.id === 'string' && d.id ? d.id : '(无 ID)';
  const fail = (code, message) => errors.push(`[record:${code}] ${at}：${message}`);

  if (!isText(d.id, 120) || !/^[a-z0-9][a-z0-9_-]*$/.test(d.id)) fail('id', 'ID 只能由小写字母、数字、连字符和下划线组成，且不超过 120 个字符');
  for (const key of REQUIRED_TEXT) if (!isText(d[key])) fail('text', `缺少必填字段 ${key}，或内容过长`);
  if (!STATUSES.includes(d.status)) fail('status', 'status 必须是 open、upcoming、closed 或 verify');
  if (!SCOPES.includes(d.scope)) fail('scope', 'scope 必须是 national、province、city、joint 或 overseas');
  if (!REGIONS.includes(d.region)) fail('region', 'region 必须是"国内"或"国际"');
  if (SCOPES.includes(d.scope) && REGIONS.includes(d.region) && (d.scope === 'overseas') !== (d.region === '国际')) fail('region-scope', 'region 与 scope 不一致：overseas 对应"国际"，其余对应"国内"');
  if (!Array.isArray(d.disciplines) || !d.disciplines.length || d.disciplines.some(x => !DISCIPLINES.includes(x))) fail('disciplines', 'disciplines 必须是非空数组，取值 natural 或 social');
  if (!Array.isArray(d.audience) || !d.audience.length || d.audience.some(x => typeof x !== 'string' || !x)) fail('audience', 'audience 必须是非空的字符串数组');

  if (!Array.isArray(d.sources) || !d.sources.length) fail('sources', '至少需要一个官方来源');
  else for (const source of d.sources) {
    if (!isObject(source) || !isText(source.label, 500)) fail('source-label', '来源缺少名称');
    if (!isObject(source) || !isSafeUrl(source.url)) fail('source-url', `来源链接无效：${isObject(source) ? source.url : source}`);
  }

  for (const key of ['date', 'deadline', 'opensOn', 'verified']) {
    if (d[key] != null && d[key] !== '' && !isRealDate(d[key])) fail('date', `${key} 不是真实存在的 YYYY-MM-DD 日期：${d[key]}`);
  }
  if (!d.verified) fail('verified', '缺少核验日期 verified');
  else if (isRealDate(d.verified) && d.verified > today) fail('verified-future', `核验日期 ${d.verified} 晚于今天（北京时间 ${today}）`);
  if (isRealDate(d.opensOn) && isRealDate(d.deadline) && d.opensOn > d.deadline) fail('interval', '开放日期晚于截止日期');

  if (['province', 'city'].includes(d.scope) && !d.jurisdiction?.province) fail('province', '省级和市级项目必须填写 jurisdiction.province');
  if (d.scope === 'city' && !d.jurisdiction?.city) fail('city', '市级项目必须填写 jurisdiction.city');
  if (d.scope === 'joint' && (!Array.isArray(d.eligibleAreas) || !d.eligibleAreas.length)) fail('eligible-areas', '联合项目必须列出 eligibleAreas');
  if (JSON.stringify(d).length > 32000) fail('size', '单条记录过大');
  return errors;
}

export function validateRun(run, today) {
  if (!isObject(run)) return ['[run:shape] 运行记录必须是一个对象'];
  const errors = [];
  const at = typeof run.id === 'string' && run.id ? run.id : '(无 ID)';
  const fail = (code, message) => errors.push(`[run:${code}] ${at}：${message}`);

  if (!isText(run.id, 120) || !/^[a-zA-Z0-9_-]+$/.test(run.id)) fail('id', '运行 ID 只能由字母、数字、连字符和下划线组成');
  if (!RUN_KINDS.includes(run.kind)) fail('kind', 'kind 必须是 initialize、research 或 correction');
  if (!isRealDate(run.date)) fail('date', 'date 必须是真实存在的 YYYY-MM-DD 日期');
  else if (run.date > today) fail('date-future', `运行日期 ${run.date} 晚于今天（北京时间 ${today}）`);
  if (typeof run.at !== 'string' || Number.isNaN(Date.parse(run.at))) fail('at', 'at 必须是 ISO 时间');
  if (!isText(run.summary, 2000)) fail('summary', '缺少摘要，或摘要过长');
  if (!OUTCOMES.includes(run.outcome)) fail('outcome', 'outcome 必须是 success 或 partial');
  if (!isCount(run.added) || !isCount(run.updated)) fail('counts', 'added 和 updated 必须是非负整数');

  for (const key of ['checkedIds', 'checkedSources', 'issues']) if (!Array.isArray(run[key])) fail('lists', `${key} 必须是数组`);
  const sources = Array.isArray(run.checkedSources) ? run.checkedSources : [];
  const issues = Array.isArray(run.issues) ? run.issues : [];
  if (Array.isArray(run.checkedIds) && run.checkedIds.some(id => typeof id !== 'string' || !id)) fail('lists', 'checkedIds 只能包含记录 ID');
  for (const source of sources) {
    if (!isObject(source) || !isSafeUrl(source.url) || !isText(source.label, 500) || !SOURCE_RESULTS.includes(source.result)) fail('checked-source', '检查过的来源需要有效链接、名称，以及 checked 或 unavailable 的结果');
  }
  for (const issue of issues) {
    if (!isObject(issue) || !isSafeUrl(issue.url) || !isText(issue.message, 1500)) fail('issue', '问题需要有效链接和说明');
  }

  if (run.kind === 'research') {
    if (!sources.length) fail('no-sources', '例行收集必须登记至少一个检查过的来源');
    if (run.outcome === 'success' && (issues.length || sources.some(s => s?.result === 'unavailable'))) fail('outcome-success', '有无法访问的来源或未解决的问题时，outcome 必须是 partial');
  }
  if (run.kind === 'correction') {
    if (!Array.isArray(run.correctedIds) || !run.correctedIds.length || run.correctedIds.some(id => typeof id !== 'string' || !id)) fail('corrected-ids', '人工更正必须在 correctedIds 中列出被更正的记录');
  }
  return errors;
}

export function validate({ records, log, baseRecords = null, baseLog = null, today = todayInShanghai() }) {
  const errors = [];
  if (!Array.isArray(records)) return ['[records:shape] 机会数据必须是一个数组'];
  if (!isObject(log) || !Array.isArray(log.runs)) return ['[log:shape] 更新记录必须是 {"runs": [...]} 的形式'];
  const runs = log.runs;

  for (const record of records) errors.push(...validateRecord(record, today));
  for (const run of runs) errors.push(...validateRun(run, today));

  const ids = new Set();
  for (const record of records) {
    if (!isObject(record)) continue;
    if (ids.has(record.id)) errors.push(`[records:duplicate-id] ${record.id}：ID 重复`);
    ids.add(record.id);
  }

  const runIds = new Set();
  for (const run of runs) {
    if (!isObject(run)) continue;
    if (runIds.has(run.id)) errors.push(`[log:duplicate-run] ${run.id}：运行 ID 重复`);
    runIds.add(run.id);
    for (const key of ['checkedIds', 'correctedIds']) {
      for (const id of Array.isArray(run[key]) ? run[key] : []) {
        if (!ids.has(id)) errors.push(`[log:unknown-id] ${run.id}：${key} 中的 ${id} 不是已有记录`);
      }
    }
  }
  if (runs.length > MAX_RUNS) errors.push(`[log:too-long] 更新记录超过 ${MAX_RUNS} 条，请从最旧的一端删减`);
  for (let i = 1; i < runs.length; i++) {
    if (Date.parse(runs[i - 1]?.at) < Date.parse(runs[i]?.at)) { errors.push('[log:order] 更新记录必须按时间从新到旧排列'); break; }
  }

  if (Array.isArray(baseRecords)) errors.push(...compareWithBase({ records, runs, baseRecords, baseRuns: Array.isArray(baseLog?.runs) ? baseLog.runs : [] }));
  return errors;
}

function compareWithBase({ records, runs, baseRecords, baseRuns }) {
  const errors = [];
  const current = new Map(records.filter(isObject).map(d => [d.id, d]));
  const before = new Map(baseRecords.filter(isObject).map(d => [d.id, d]));

  for (const id of before.keys()) if (!current.has(id)) errors.push(`[base:removed-id] ${id}：已有记录不能删除或改名`);

  const baseRunIds = new Set(baseRuns.map(run => run?.id));
  const newRuns = runs.filter(run => isObject(run) && !baseRunIds.has(run.id));
  const kept = runs.slice(newRuns.length);
  if (runs.slice(0, newRuns.length).some(run => baseRunIds.has(run?.id)) || kept.length > baseRuns.length || kept.some((run, i) => !same(run, baseRuns[i]))) {
    errors.push('[base:history] 已有的运行记录不能修改或调换顺序；新记录加在最前面，只能从最旧的一端删减');
  }

  const added = [], updated = [];
  for (const [id, record] of current) {
    if (!before.has(id)) added.push(record);
    else if (!same(record, before.get(id))) updated.push(record);
  }
  const changed = [...added, ...updated];
  if (changed.length && !newRuns.length) {
    errors.push(`[base:no-run] 有 ${changed.length} 条记录被新增或修改，但没有新增运行记录`);
    return errors;
  }

  for (const record of changed) {
    const urls = Array.isArray(record.sources) ? record.sources.map(s => s?.url) : [];
    const covered = newRuns.some(run => {
      if (run.kind === 'correction') return Array.isArray(run.correctedIds) && run.correctedIds.includes(record.id);
      if (run.kind !== 'research') return false;
      const checked = (Array.isArray(run.checkedSources) ? run.checkedSources : []).filter(s => s?.result === 'checked').map(s => s.url);
      return record.verified === run.date && urls.some(url => checked.includes(url));
    });
    if (!covered) errors.push(`[base:unverified-change] ${record.id}：被改动的记录必须对应一条新的运行记录——核验日期等于该次运行的日期，并引用该次运行中登记为 checked 的来源；人工更正则须列入 correctedIds`);
  }

  const sum = key => newRuns.reduce((total, run) => total + (isCount(run[key]) ? run[key] : 0), 0);
  if (newRuns.length && (sum('added') !== added.length || sum('updated') !== updated.length)) {
    errors.push(`[base:counts] 运行记录写的是新增 ${sum('added')}、修改 ${sum('updated')}，实际是新增 ${added.length}、修改 ${updated.length}`);
  }
  return errors;
}

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function readJsonAt(ref, path) {
  try {
    return JSON.parse(execFileSync('git', ['show', `${ref}:${path}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }));
  } catch { return null; }
}

function main(argv) {
  const baseIndex = argv.indexOf('--base');
  const base = baseIndex === -1 ? null : argv[baseIndex + 1];
  if (baseIndex !== -1 && !base) { console.error('用法：node scripts/validate.mjs [--base <git 引用>]'); return 2; }

  let records, log;
  try { records = readJson(RECORDS_PATH); log = readJson(LOG_PATH); }
  catch (error) { console.error(`[files:unreadable] 数据文件无法读取或不是合法的 JSON：${error.message}`); return 1; }

  let baseRecords = null, baseLog = null;
  if (base) {
    try { execFileSync('git', ['rev-parse', '--verify', '--quiet', `${base}^{commit}`], { stdio: 'ignore' }); }
    catch { console.error(`找不到用于比较的 git 引用：${base}`); return 2; }
    baseRecords = readJsonAt(base, RECORDS_PATH);
    baseLog = readJsonAt(base, LOG_PATH);
  }

  const errors = validate({ records, log, baseRecords, baseLog });
  if (errors.length) {
    for (const error of errors) console.error(error);
    console.error(`\n校验未通过：${errors.length} 个问题。`);
    return 1;
  }
  console.log(`校验通过：${records.length} 条记录，${log.runs.length} 条运行记录` + (baseRecords ? `，已与 ${base} 比较。` : '。'));
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main(process.argv.slice(2));
