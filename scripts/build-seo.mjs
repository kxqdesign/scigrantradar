// Zero-dependency static SEO & GEO generator for scigrantradar.com.
// Reads site/data/opportunities.json, site/data/sources.json, and site/data/update-log.json,
// then generates crawlable static pages, JSON-LD, sitemap.xml, llms.txt, llms-full.txt,
// feed.xml (Atom), calendar.ics (iCalendar), and pre-rendered HTML sections in site/index.html.
//
// Usage:
//   node scripts/build-seo.mjs
//   node scripts/build-seo.mjs --today=2026-11-28
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE_DIR = path.join(ROOT, 'site');
const ORIGIN = 'https://scigrantradar.com';
const SITE_NAME = '科研基金雷达';
const SITE_NAME_EN = 'SciGrant Radar';
const LICENSE_URL = 'https://creativecommons.org/licenses/by-nc/4.0/deed.zh-hans';
const LICENSE_URL_EN = 'https://creativecommons.org/licenses/by-nc/4.0/';
const REPO_URL = 'https://github.com/kxqdesign/scigrantradar';
const AUTHOR_URL = 'https://kxqdesign.com/';
const SHARE_IMAGE = `${ORIGIN}/assets/share-card.png`;

const todayArg = process.argv.find(a => a.startsWith('--today='))?.slice('--today='.length);
const SKIP_INDEX = process.argv.includes('--skip-index');
const TODAY = todayArg && /^\d{4}-\d{2}-\d{2}$/.test(todayArg)
  ? todayArg
  : new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });

// Reuse site/schedule.js and site/geography.js directly so status, dates, and geography labels match app.js 1:1.
const sharedContext = vm.createContext({ Date, Intl, Math, Object, Array, String, Number, RegExp });
const { withSchedule, datesText, PHASE, scopeLabel, countryTab, AREAS } = vm.runInContext(
  ['geography.js', 'schedule.js'].map(f => fs.readFileSync(path.join(SITE_DIR, f), 'utf8')).join('\n')
  + '\n;({ withSchedule, datesText, PHASE, scopeLabel, countryTab, AREAS })',
  sharedContext,
);

const rawRecords = JSON.parse(fs.readFileSync(path.join(SITE_DIR, 'data', 'opportunities.json'), 'utf8'));
const sourcesList = JSON.parse(fs.readFileSync(path.join(SITE_DIR, 'data', 'sources.json'), 'utf8'));
const updateLog = JSON.parse(fs.readFileSync(path.join(SITE_DIR, 'data', 'update-log.json'), 'utf8'));

const runs = Array.isArray(updateLog.runs) ? updateLog.runs : [];
const latestRunDate = runs[0]?.date || TODAY;
const latestRunIso = runs[0]?.at || `${TODAY}T00:00:00.000Z`;

const PRIORITY = { open: 0, upcoming: 1, verify: 2, closed: 3 };
const DISCIPLINE_LABEL = { natural: '自然科学', social: '社会科学（含人文）' };
const DISCIPLINE_LABEL_EN = { natural: 'Natural Sciences & Engineering', social: 'Social Sciences & Humanities' };
const PHASE_EN = { open: 'Open', soon: 'Closing Soon', upcoming: 'Upcoming', verify: 'To Verify', closed: 'Closed' };

const records = rawRecords
  .map(d => withSchedule(d, TODAY))
  .sort((a, b) =>
    PRIORITY[a.status] - PRIORITY[b.status]
    || (a.nextDate || '9999-99-99').localeCompare(b.nextDate || '9999-99-99')
    || a.id.localeCompare(b.id)
  );

const CATEGORY_SLUGS = {
  '科研基金': { slug: 'fund', en: 'Research Grants', desc: '国家级、省市级与交叉学科科研基金项目汇总，含申请资格、资助额度与历年截止时间。' },
  '青年人才': { slug: 'talent', en: 'Early-Career Talent Programs', desc: '面向青年学者、高校青年教师与科研骨干的人才托举及青年科学基金项目目录。' },
  '博士后': { slug: 'postdoc', en: 'Postdoctoral Fellowships', desc: '国内外博士后科研资助、创新人才支持计划与海外知名博士后奖学金汇总。' },
  '交流合作': { slug: 'exchange', en: 'Academic Exchange & Collaboration', desc: '双边与多边国际科研合作、访问学者、联合培养及学术交流资助项目。' },
  '国际资助': { slug: 'international', en: 'International Research Funding', desc: '海外基金会、多国科研机构及跨国研究资助项目，标注中国及国际申请人资格。' },
  '指南征集': { slug: 'call', en: 'Call for Proposals & Guidelines', desc: '基金委及各科技主管部门的项目指南建议征集与重点方向意见征集通知。' },
  '专家机会': { slug: 'expert', en: 'Expert & Reviewer Opportunities', desc: '国内外科研机构评审专家库、项目评估与学术顾问招募机会。' },
};

const PROVINCE_SLUGS = {
  '江苏': 'jiangsu',
  '浙江': 'zhejiang',
  '上海': 'shanghai',
  '北京': 'beijing',
  '广东': 'guangdong',
  '安徽': 'anhui',
  '陕西': 'shaanxi',
  '湖北': 'hubei',
  '四川': 'sichuan',
  '黑龙江': 'heilongjiang',
  '湖南': 'hunan',
  '辽宁': 'liaoning',
  '香港': 'hong-kong',
  '澳门': 'macao',
  '台湾': 'taiwan',
};

const CITY_SLUGS = {
  '南京': 'nanjing', '苏州': 'suzhou', '无锡': 'wuxi', '常州': 'changzhou',
  '杭州': 'hangzhou', '宁波': 'ningbo', '温州': 'wenzhou',
  '广州': 'guangzhou', '深圳': 'shenzhen', '韶关': 'shaoguan',
  '合肥': 'hefei', '西安': 'xian', '武汉': 'wuhan', '成都': 'chengdu',
  '哈尔滨': 'harbin', '长沙': 'changsha', '沈阳': 'shenyang', '大连': 'dalian',
};

const COUNTRY_HUBS = [
  { key: '英国', slug: 'uk', name: '英国科研基金与博士后项目', en: 'United Kingdom Grants & Fellowships', desc: '英国皇家学会、UKRI、Wellcome 等面向中国及国际研究者的科研基金、博士后与访问资助汇总。' },
  { key: '德国', slug: 'germany', name: '德国科研基金与博士后项目', en: 'Germany Grants & Fellowships', desc: '洪堡基金会、DFG、DAAD 等德国科研资助、青年团队及博士后奖学金目录。' },
  { key: '欧洲', slug: 'europe', name: '欧洲（含欧盟与欧陆各国）科研项目', en: 'Europe & EU Research Funding', desc: '欧盟 MSCA、ERC、EMBO 及瑞士、荷兰、法国、丹麦、瑞典等欧洲国家科研与博士后资助汇总。' },
  { key: '新加坡', slug: 'singapore', name: '新加坡科研基金与博士后项目', en: 'Singapore Research Grants & Fellowships', desc: '新加坡 NRF、A*STAR、MOE 等科研基金、青年学者与博士后机会汇总。' },
  { key: '其他', slug: 'other', name: '日本、多国及其他境外科研项目', en: 'Japan & Multinational Research Funding', desc: '日本 JSPS、HFSP、Rufford 及跨国/多目的地科研基金与博士后奖学金汇总。' },
];

const AUDIENCE_HUBS = [
  { slug: 'phd', name: '博士生与应届博士', match: ['博士生', '应届博士'], desc: '适合在读博士生与应届毕业博士申请的奖学金、暑期科研、联合培养与博士后起步资助。' },
  { slug: 'postdoc', name: '博士后研究者', match: ['博士后'], desc: '适合在站及拟进站博士后申请的中国博士后科学基金、省市补贴及海外博士后奖学金。' },
  { slug: 'early-career', name: '青年研究者', match: ['青年研究者'], desc: '面向高校青年教师、助理教授与科研新锐的青年科学基金、青年人才托举与独立课题资助。' },
  { slug: 'faculty', name: '在职科研人员与团队负责人', match: ['在职科研人员', '团队负责人'], desc: '面向高校与科研院所在职研究者及 PI 的面上、重点、重大、国际合作及指南征集项目。' },
  { slug: 'master', name: '硕士生', match: ['硕士生'], desc: '面向在读硕士研究生开放的科研资助、野外研究基金及学术交流项目。' },
];

const GENERATED_DIRS = [
  'grant', 'category', 'region', 'country', 'audience', 'deadlines',
  'open', 'national', 'overseas', 'hmt', 'sources', 'about', 'en',
];

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeJsonLd = obj => JSON.stringify(obj).replace(/</g, '\\u003c');
const clip = (s, n = 155) => {
  const clean = String(s ?? '').replace(/\s+/g, ' ').trim();
  return clean.length <= n ? clean : clean.slice(0, n - 1).trimEnd() + '…';
};
const maxDate = items => {
  const dates = items.map(x => x.verified).filter(Boolean).sort();
  return dates.at(-1) || latestRunDate;
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeOut(relPath, content) {
  const full = path.join(SITE_DIR, relPath);
  ensureDir(path.dirname(full));
  fs.writeFileSync(full, content, 'utf8');
}

function statusBadgeHtml(d, en = false) {
  const label = en ? (PHASE_EN[d.phase] || d.phase) : (PHASE[d.phase] || d.status);
  return `<span class="badge badge-${esc(d.phase)}">${esc(label)}</span>`;
}

function breadcrumbJsonLd(crumbs) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map(([name, urlPath], i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name,
      item: urlPath.startsWith('http') ? urlPath : `${ORIGIN}${urlPath}`,
    })),
  };
}

function faqJsonLd(faqs) {
  return {
    '@type': 'FAQPage',
    mainEntity: faqs.map(([q, a]) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
}

function renderShell({
  lang = 'zh-CN',
  title,
  description,
  canonicalPath,
  currentNav = '',
  breadcrumbs = [],
  bodyHtml,
  jsonLdGraph = [],
  extraHead = '',
  isEnglish = false,
}) {
  const canonicalUrl = `${ORIGIN}${canonicalPath}`;
  const navItems = isEnglish
    ? [
        ['/', 'Interactive Radar (中文)'],
        ['/open/', 'Open Calls'],
        ['/overseas/', 'International'],
        ['/national/', 'China National'],
        ['/deadlines/', 'Deadlines'],
        ['/sources/', 'Sources'],
        ['/about/', 'Methodology'],
        ['/en/', 'English'],
      ]
    : [
        ['/', '交互式雷达'],
        ['/open/', '开放中'],
        ['/national/', '全国性'],
        ['/overseas/', '境外机会'],
        ['/deadlines/', '截止日历'],
        ['/sources/', '官方来源'],
        ['/about/', '核验说明'],
        ['/en/', 'EN'],
      ];

  const crumbHtml = breadcrumbs.length
    ? `<nav class="breadcrumbs" aria-label="${isEnglish ? 'Breadcrumb' : '面包屑导航'}">${breadcrumbs
        .map(([label, href], i) =>
          i === breadcrumbs.length - 1
            ? `<span aria-current="page">${esc(label)}</span>`
            : `<a href="${esc(href)}">${esc(label)}</a><span aria-hidden="true">›</span>`
        )
        .join('')}</nav>`
    : '';

  const ldScript = jsonLdGraph.length
    ? `<script type="application/ld+json">${safeJsonLd({ '@context': 'https://schema.org', '@graph': jsonLdGraph })}</script>`
    : '';

  return `<!doctype html>
<html lang="${esc(lang)}">
<head>
<meta charset="utf-8">
<script src="/redirect.js"></script>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonicalUrl)}">
<link rel="license" href="${isEnglish ? LICENSE_URL_EN : LICENSE_URL}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" type="image/png" href="/assets/radar-star.png">
<link rel="apple-touch-icon" href="/assets/radar-star.png">
<link rel="alternate" type="application/atom+xml" title="${SITE_NAME} · Atom Feed" href="${ORIGIN}/feed.xml">
<link rel="alternate" type="text/markdown" title="${SITE_NAME_EN} AI Summary" href="${ORIGIN}/llms.txt">
<meta name="theme-color" content="#182e31">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE_NAME} · ${SITE_NAME_EN}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonicalUrl)}">
<meta property="og:image" content="${SHARE_IMAGE}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="${isEnglish ? 'en_US' : 'zh_CN'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${SHARE_IMAGE}">
${extraHead}
<link rel="stylesheet" href="/seo-pages.css">
${ldScript}
</head>
<body>
<a class="skip" href="#main">${isEnglish ? 'Skip to main content' : '跳到正文'}</a>
<header class="site-header">
  <div class="header-inner">
    <a class="brand" href="${isEnglish ? '/en/' : '/'}">
      <img src="/assets/radar-star.png" width="38" height="38" alt="${SITE_NAME}">
      <span class="brand-text"><strong>${SITE_NAME}</strong><small>SCIGRANT RADAR</small></span>
    </a>
    <nav class="top-nav" aria-label="${isEnglish ? 'Primary navigation' : '顶部导航'}">
      ${navItems.map(([href, label]) => `<a href="${href}"${href === currentNav ? ' aria-current="page"' : ''}>${esc(label)}</a>`).join('')}
    </nav>
  </div>
</header>
<main id="main" class="wrap">
${crumbHtml}
${bodyHtml}
</main>
<footer class="site-footer">
  <div class="footer-inner">
    <div class="footer-links">
      <a href="/">交互式筛选首页</a>
      <a href="/open/">开放中项目</a>
      <a href="/national/">全国性项目</a>
      <a href="/overseas/">境外项目</a>
      <a href="/deadlines/">月度截止日历</a>
      <a href="/sources/">官方来源目录（${sourcesList.length}）</a>
      <a href="/about/">核验方法与更新记录</a>
      <a href="/en/">English Guide</a>
      <a href="/feed.xml">Atom 订阅</a>
      <a href="/calendar.ics">日历订阅 (.ics)</a>
      <a href="/llms.txt">llms.txt</a>
      <a href="${REPO_URL}" target="_blank" rel="noopener noreferrer">GitHub 开源数据</a>
    </div>
    <p class="footer-license">本站整理的数据采用 <a rel="license noopener noreferrer" href="${LICENSE_URL}" target="_blank">CC BY-NC 4.0</a> 许可：欢迎转载与引用，请注明来源“科研基金雷达”并链接 <a href="${ORIGIN}/">scigrantradar.com</a>，不得用于商业用途。项目日期与资格要求以各资助机构官方通知原文为准。最近全库核验：${esc(latestRunDate)}。</p>
  </div>
</footer>
</body>
</html>`;
}

function renderComparisonTable(items, { en = false } = {}) {
  if (!items.length) {
    return `<p class="meta-note">${en ? 'No opportunities currently listed in this section.' : '当前分类暂无收录项目。'}</p>`;
  }
  const rows = items.map(d => {
    const scope = scopeLabel(d);
    const dateStr = datesText(d);
    return `<tr>
      <td>
        <a class="grant-link" href="/grant/${esc(d.id)}/">${esc(d.name)}</a>
        <span class="cell-muted">${esc(d.org)} · ${esc(scope)}</span>
      </td>
      <td>${esc(d.category)}</td>
      <td>${esc(d.audience.join('、'))}</td>
      <td>${esc(clip(d.support, 68))}</td>
      <td>${statusBadgeHtml(d, en)}<span class="cell-muted">${esc(dateStr)}</span></td>
      <td>${esc(d.verified)}</td>
    </tr>`;
  }).join('');

  return `<div class="table-wrap"><table class="data-table">
    <thead><tr>
      <th>${en ? 'Program & Funder' : '项目名称与发布机构'}</th>
      <th>${en ? 'Category' : '类型'}</th>
      <th>${en ? 'Audience' : '适用阶段'}</th>
      <th>${en ? 'Funding / Support' : '资助与支持'}</th>
      <th>${en ? 'Status & Dates' : '状态与时间'}</th>
      <th>${en ? 'Verified' : '核验日期'}</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

function renderStatsStrip(items, { en = false } = {}) {
  const open = items.filter(d => d.status === 'open').length;
  const upcoming = items.filter(d => d.status === 'upcoming').length;
  const verify = items.filter(d => d.status === 'verify').length;
  const closed = items.filter(d => d.status === 'closed').length;
  return `<dl class="stats-strip">
    <div class="stat-box"><dt>${en ? 'Total Listed' : '收录总数'}</dt><dd>${items.length}</dd></div>
    <div class="stat-box is-open"><dt>${en ? 'Open Now' : '开放中'}</dt><dd>${open}</dd></div>
    <div class="stat-box"><dt>${en ? 'Upcoming' : '待开放'}</dt><dd>${upcoming}</dd></div>
    <div class="stat-box"><dt>${en ? 'To Verify' : '待核实'}</dt><dd>${verify}</dd></div>
    <div class="stat-box"><dt>${en ? 'Archived / Closed' : '已截止（历年参考）'}</dt><dd>${closed}</dd></div>
  </dl>`;
}

function renderFaqSection(faqs, heading = '常见问题') {
  return `<section class="section-card">
    <h2>${esc(heading)}</h2>
    <div class="faq-list">${faqs.map(([q, a]) => `<article class="faq-item"><h3>${esc(q)}</h3><p>${esc(a)}</p></article>`).join('')}</div>
  </section>`;
}

// Track all generated HTML pages for sitemap.xml
const sitemapEntries = [];
function registerUrl(urlPath, lastmod, priority = '0.7', changefreq = 'weekly') {
  sitemapEntries.push({ loc: `${ORIGIN}${urlPath}`, lastmod: lastmod || latestRunDate, priority, changefreq });
}

// Clean previously generated directories so removed slugs do not persist
for (const dir of GENERATED_DIRS) {
  fs.rmSync(path.join(SITE_DIR, dir), { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// 1. Build 280 Individual Grant Detail Pages (/grant/<id>/index.html & .md)
// ---------------------------------------------------------------------------
function parentHubFor(d) {
  if (d.scope === 'overseas') {
    const tab = countryTab(d);
    const hub = COUNTRY_HUBS.find(c => c.key === tab) || COUNTRY_HUBS.at(-1);
    return [hub.name, `/country/${hub.slug}/`];
  }
  if (d.scope === 'hmt') return ['港澳台项目', '/hmt/'];
  if (d.scope === 'national') return ['全国性项目', '/national/'];
  const prov = d.jurisdiction?.province;
  if (prov && PROVINCE_SLUGS[prov]) return [`${prov}科研项目`, `/region/${PROVINCE_SLUGS[prov]}/`];
  return ['全国性项目', '/national/'];
}

function findRelated(d) {
  const scored = records
    .filter(x => x.id !== d.id)
    .map(x => {
      let score = 0;
      if (x.scope === d.scope) score += 3;
      if (d.jurisdiction?.province && x.jurisdiction?.province === d.jurisdiction.province) score += 5;
      if (d.jurisdiction?.country && x.jurisdiction?.country === d.jurisdiction.country) score += 4;
      if (x.category === d.category) score += 3;
      if (x.disciplines.some(v => d.disciplines.includes(v))) score += 1;
      if (x.status === 'open') score += 2;
      else if (x.status === 'upcoming') score += 1;
      return [score, x];
    })
    .sort((a, b) => b[0] - a[0] || PRIORITY[a[1].status] - PRIORITY[b[1].status])
    .slice(0, 6)
    .map(([, x]) => x);
  return scored;
}

for (const d of records) {
  const scope = scopeLabel(d);
  const dateSummary = datesText(d);
  const phaseLabel = PHASE[d.phase] || d.status;
  const disciplinesText = d.disciplines.map(v => DISCIPLINE_LABEL[v] || v).join('、');
  const audienceText = d.audience.join('、');
  const catInfo = CATEGORY_SLUGS[d.category];
  const [parentLabel, parentHref] = parentHubFor(d);

  const isOverseas = d.scope === 'overseas';
  const title = isOverseas
    ? `${d.name} — 申请资格、资助与截止日期 | ${SITE_NAME} ${SITE_NAME_EN}`
    : `${d.name}（${phaseLabel}）：申请条件、资助额度与截止时间｜${SITE_NAME}`;

  const description = clip(
    `${d.org}发布（${scope} · ${d.category}），面向${audienceText}。时间状态：${dateSummary}。资助：${d.support}。资格：${d.eligibility} 核验日期：${d.verified}。`,
    160
  );

  const tldr = `<strong>${esc(d.name)}</strong>由 <strong>${esc(d.org)}</strong> 发布，属于${esc(scope)} · ${esc(d.category)}（${esc(disciplinesText)}），面向${esc(audienceText)}。当前状态为 <strong>${esc(phaseLabel)}</strong>（${esc(dateSummary)}）。资助/支持：${esc(d.support)}。资料核验日期：${esc(d.verified)}。`;

  const faqs = [
    [
      `${d.name} 谁可以申请？有哪些资格与地域要求？`,
      `适用人群：${audienceText}。资格与限制：${d.eligibility} 地域要求：${d.geographyNote || '以官方项目指南及依托单位要求为准。'}`,
    ],
    [
      `${d.name} 的资助额度或支持形式是什么？`,
      `${d.support} 适用研究领域：${d.fields}。`,
    ],
    [
      `${d.name} 什么时候开放与截止？`,
      `当前状态：${phaseLabel}（${dateSummary}）。说明：${d.timeNote || d.dateLabel} 建议准备周期：${d.prep}。`,
    ],
    [
      `如何开始准备申请 ${d.name}？`,
      `${d.next} 申报前请直接查阅官方通知（最近核验于 ${d.verified}），并向本单位科研管理或博士后管理部门确认内部截止时间。`,
    ],
  ];

  const breadcrumbs = [
    ['首页', '/'],
    [parentLabel, parentHref],
    ...(catInfo ? [[d.category, `/category/${catInfo.slug}/`]] : []),
    [d.name, `/grant/${d.id}/`],
  ];

  const related = findRelated(d);

  const bodyHtml = `
<article>
  <header class="hero-card">
    <div class="badge-row">
      ${statusBadgeHtml(d)}
      <span class="badge">${esc(d.category)}</span>
      <span class="badge">${esc(scope)}</span>
      <span class="badge">${esc(disciplinesText)}</span>
    </div>
    <h1>${esc(d.name)}</h1>
    <p class="subtitle">发布机构：${esc(d.org)} · 适用领域：${esc(d.fields)} · 资料核验：${esc(d.verified)}</p>
    <p class="tldr-box">${tldr}</p>
    <div class="cta-row">
      <a class="btn" href="${esc(d.sources[0].url)}" target="_blank" rel="noopener noreferrer">查看官方通知原文 ↗</a>
      <a class="btn btn-secondary" href="/#o=${esc(d.id)}">在交互式雷达中打开</a>
      <a class="btn btn-secondary" href="/grant/${esc(d.id)}/index.md">Markdown 摘要 (.md)</a>
    </div>
  </header>

  <section class="section-card">
    <h2>项目核心信息</h2>
    <p>${esc(d.summary)}</p>
    <table class="facts-grid">
      <tbody>
        <tr><th>当前状态</th><td>${statusBadgeHtml(d)} ${esc(dateSummary)}</td></tr>
        <tr><th>发布与资助机构</th><td>${esc(d.org)}</td></tr>
        <tr><th>机会类型与范围</th><td>${esc(d.category)} · ${esc(scope)}</td></tr>
        <tr><th>适用学科与领域</th><td>${esc(disciplinesText)}（${esc(d.fields)}）</td></tr>
        <tr><th>面向对象</th><td>${esc(audienceText)}</td></tr>
        <tr><th>资格与限项条件</th><td>${esc(d.eligibility)}</td></tr>
        <tr><th>地域与依托单位要求</th><td>${esc(d.geographyNote || '以项目指南与依托单位要求为准。')}</td></tr>
        <tr><th>资助额度 / 参与形式</th><td>${esc(d.support)}</td></tr>
        <tr><th>日期与时间说明</th><td>${esc(d.dateLabel)}${d.timeNote ? '；' + esc(d.timeNote) : ''}</td></tr>
        <tr><th>建议准备时间</th><td>${esc(d.prep)}</td></tr>
        <tr><th>下一步行动建议</th><td>${esc(d.next)}</td></tr>
        <tr><th>核验日期与原则</th><td>${esc(d.verified)}（依据官方原文核验，不凭往年规律猜测下一轮截止日期）</td></tr>
      </tbody>
    </table>
  </section>

  <section class="section-card">
    <h2>官方来源链接</h2>
    <ul class="source-list">
      ${d.sources.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.label)} ↗</a><span class="cell-muted">${esc(new URL(s.url).hostname)}</span></li>`).join('')}
    </ul>
    ${d.sourceNote ? `<p class="meta-note">来源说明：${esc(d.sourceNote)}</p>` : ''}
    <p class="meta-note">如官方指南已更新或链接变动，欢迎在 <a href="${REPO_URL}/issues" target="_blank" rel="noopener noreferrer">GitHub Issues</a> 附官方链接反馈。</p>
  </section>

  ${renderFaqSection(faqs, '常见问题（FAQ）')}

  <section class="section-card">
    <h2>相关科研基金与项目</h2>
    <div class="related-grid">
      ${related.map(r => `<a class="mini-card" href="/grant/${esc(r.id)}/">
        <div>${statusBadgeHtml(r)}</div>
        <strong>${esc(r.name)}</strong>
        <small>${esc(r.org)} · ${esc(scopeLabel(r))}</small>
        <small>${esc(datesText(r))}</small>
      </a>`).join('')}
    </div>
  </section>
</article>`;

  const grantJsonLd = {
    '@type': 'MonetaryGrant',
    '@id': `${ORIGIN}/grant/${d.id}/#grant`,
    name: d.name,
    description: `${d.summary} 资助：${d.support} 资格：${d.eligibility}`,
    url: `${ORIGIN}/grant/${d.id}/`,
    funder: { '@type': 'Organization', name: d.org },
    areaServed: d.jurisdiction?.country || d.jurisdiction?.city || d.jurisdiction?.province || (d.region === '国内' ? '中国' : 'International'),
    sameAs: d.sources.map(s => s.url),
    dateModified: d.verified,
    license: LICENSE_URL,
  };

  const html = renderShell({
    lang: 'zh-CN',
    title,
    description,
    canonicalPath: `/grant/${d.id}/`,
    currentNav: d.scope === 'overseas' ? '/overseas/' : '/national/',
    breadcrumbs,
    bodyHtml,
    jsonLdGraph: [grantJsonLd, breadcrumbJsonLd(breadcrumbs), faqJsonLd(faqs)],
    extraHead: `<link rel="alternate" type="text/markdown" href="${ORIGIN}/grant/${d.id}/index.md">`,
  });

  writeOut(`grant/${d.id}/index.html`, html);
  registerUrl(`/grant/${d.id}/`, d.verified, d.status === 'open' || d.status === 'upcoming' ? '0.9' : '0.6', d.status === 'closed' ? 'monthly' : 'weekly');

  // Matching Markdown mirror for AI agents & retrieval pipelines
  const md = `# ${d.name}

- **Canonical URL:** ${ORIGIN}/grant/${d.id}/
- **Funder / Organization:** ${d.org}
- **Status:** ${phaseLabel} (${d.status})
- **Dates:** ${dateSummary}
- **Category:** ${d.category}
- **Scope / Geography:** ${scope}
- **Disciplines:** ${disciplinesText}
- **Fields:** ${d.fields}
- **Target Audience:** ${audienceText}
- **Last Verified:** ${d.verified}

## Summary
${d.summary}

## Eligibility & Geographic Requirements
- **Eligibility:** ${d.eligibility}
- **Geography Note:** ${d.geographyNote || '以项目指南与依托单位要求为准。'}

## Funding / Support
${d.support}

## Schedule & Preparation
- **Stored Label:** ${d.dateLabel}
${d.opensOn ? `- **Opens On:** ${d.opensOn}\n` : ''}${d.deadline ? `- **Deadline:** ${d.deadline}${d.deadlineTime ? ' ' + d.deadlineTime : ''}\n` : ''}- **Time Note:** ${d.timeNote || '以官方最新通知为准。'}
- **Recommended Prep:** ${d.prep}
- **Next Step:** ${d.next}

## Official Sources
${d.sources.map(s => `- [${s.label}](${s.url})`).join('\n')}
${d.sourceNote ? `\n> Source note: ${d.sourceNote}\n` : ''}
---
Source: 科研基金雷达 (SciGrant Radar) · ${ORIGIN}/ · License: CC BY-NC 4.0
`;
  writeOut(`grant/${d.id}/index.md`, md);
}

// ---------------------------------------------------------------------------
// 2. Build Hub Pages (Scope, Category, Region, Country, Audience)
// ---------------------------------------------------------------------------
const hubLinks = { scopes: [], categories: [], regions: [], countries: [], audiences: [], deadlines: [] };

function buildHubPage({
  urlPath,
  title,
  h1,
  description,
  intro,
  items,
  breadcrumbs,
  currentNav = '',
  faqs = [],
  relatedPills = [],
  priority = '0.8',
  isEnglish = false,
}) {
  const lastmod = maxDate(items);
  const openCount = items.filter(d => d.status === 'open').length;
  const upcomingCount = items.filter(d => d.status === 'upcoming').length;

  const defaultFaqs = faqs.length ? faqs : [
    [
      `${h1}目前有多少项正在开放或待开放？`,
      `当前共收录 ${items.length} 项相关机会，其中开放中 ${openCount} 项、待开放 ${upcomingCount} 项（最近核验日期：${lastmod}）。历年已截止项目同样保留，便于提前规划下一年度申报节奏。`,
    ],
    [
      `这些项目信息的日期和资格可靠吗？`,
      `每条记录均附官方通知原始链接与人工核验日期。本站不沿用往年日期推测新一轮截止时间，未获官方确认的新批次均标注为“待核实”或保留上轮记录供参考。`,
    ],
  ];

  const bodyHtml = `
<section class="hero-card">
  <h1>${esc(h1)}</h1>
  <p class="tldr-box">${esc(intro)}</p>
  ${renderStatsStrip(items, { en: isEnglish })}
  <div class="cta-row">
    <a class="btn" href="/">${isEnglish ? 'Open Interactive Filter Radar' : '在交互式时间线中筛选'}</a>
    <a class="btn btn-secondary" href="/calendar.ics">${isEnglish ? 'Subscribe Calendar (.ics)' : '订阅截止日历 (.ics)'}</a>
    <a class="btn btn-secondary" href="/feed.xml">${isEnglish ? 'Atom Feed' : 'Atom 订阅'}</a>
  </div>
</section>

<section class="section-card">
  <h2>${isEnglish ? `Opportunities (${items.length})` : `项目清单（共 ${items.length} 项）`}</h2>
  ${renderComparisonTable(items, { en: isEnglish })}
</section>

${relatedPills.length ? `<section class="section-card">
  <h2>${isEnglish ? 'Explore Related Hubs' : '按其他维度继续浏览'}</h2>
  <div class="pill-links">${relatedPills.map(([label, href, count]) => `<a href="${esc(href)}">${esc(label)}${count != null ? ` <span>${count}</span>` : ''}</a>`).join('')}</div>
</section>` : ''}

${renderFaqSection(defaultFaqs, isEnglish ? 'Frequently Asked Questions' : '常见问题')}
`;

  const collectionLd = {
    '@type': 'CollectionPage',
    name: h1,
    description,
    url: `${ORIGIN}${urlPath}`,
    dateModified: lastmod,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: items.length,
      itemListElement: items.slice(0, 50).map((d, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: d.name,
        url: `${ORIGIN}/grant/${d.id}/`,
      })),
    },
  };

  const html = renderShell({
    lang: isEnglish ? 'en' : 'zh-CN',
    title,
    description,
    canonicalPath: urlPath,
    currentNav,
    breadcrumbs,
    bodyHtml,
    jsonLdGraph: [collectionLd, breadcrumbJsonLd(breadcrumbs), faqJsonLd(defaultFaqs)],
    isEnglish,
  });

  writeOut(path.join(urlPath.replace(/^\//, ''), 'index.html'), html);
  registerUrl(urlPath, lastmod, priority, 'weekly');
}

// 2a. Core Scope & Status Hubs
const openAndUpcoming = records.filter(d => d.status === 'open' || d.status === 'upcoming');
const nationalRecords = records.filter(d => d.scope === 'national');
const hmtRecords = records.filter(d => d.scope === 'hmt');
const overseasRecords = records.filter(d => d.scope === 'overseas');

const scopePills = [
  ['开放中与待开放', '/open/', openAndUpcoming.length],
  ['全国性项目', '/national/', nationalRecords.length],
  ['境外机会', '/overseas/', overseasRecords.length],
  ['港澳台项目', '/hmt/', hmtRecords.length],
  ['月度截止日历', '/deadlines/', null],
];

buildHubPage({
  urlPath: '/open/',
  title: `正在开放与即将开放的科研基金项目（${openAndUpcoming.length}项）｜${SITE_NAME}`,
  h1: '正在开放与即将开放的科研基金与人才项目',
  description: `汇总当前开放中（${records.filter(d => d.status === 'open').length}项）与待开放（${records.filter(d => d.status === 'upcoming').length}项）的国内外科研基金、青年人才、博士后与国际交流项目，附官方来源与精确截止日期。`,
  intro: `本页实时汇总科研基金雷达中当前处于“开放中”与“待开放”状态的 ${openAndUpcoming.length} 项科研基金、青年人才、博士后及国际合作机会，按紧迫程度与截止日期排序，每条均附官方通知核验链接。`,
  items: openAndUpcoming,
  breadcrumbs: [['首页', '/'], ['开放中与待开放', '/open/']],
  currentNav: '/open/',
  relatedPills: scopePills,
  priority: '0.95',
});
hubLinks.scopes.push(['开放中与待开放', '/open/', openAndUpcoming.length]);

buildHubPage({
  urlPath: '/national/',
  title: `全国性科研基金与国家级人才项目汇总（${nationalRecords.length}项）｜${SITE_NAME}`,
  h1: '全国性科研基金、青年人才与博士后项目汇总',
  description: `收录国家自然科学基金（NSFC）、国家社科基金、中国博士后科学基金、国家留学基金（CSC）、科技部重点研发及教育部社科等 ${nationalRecords.length} 项全国性科研资助项目。`,
  intro: `汇总国家自然科学基金委员会（NSFC）、全国哲学社会科学工作办公室、中国博士后科学基金会、国家留学基金委（CSC）、科技部与教育部等发布的 ${nationalRecords.length} 项全国性科研资助与人才项目。`,
  items: nationalRecords,
  breadcrumbs: [['首页', '/'], ['全国性项目', '/national/']],
  currentNav: '/national/',
  relatedPills: scopePills,
  priority: '0.9',
});
hubLinks.scopes.push(['全国性项目', '/national/', nationalRecords.length]);

buildHubPage({
  urlPath: '/overseas/',
  title: `境外科研基金与海外博士后奖学金汇总（${overseasRecords.length}项）｜${SITE_NAME} ${SITE_NAME_EN}`,
  h1: '境外科研基金、海外博士后与国际资助项目汇总',
  description: `覆盖英国、德国、欧盟、新加坡、日本等地区的 ${overseasRecords.length} 项国际科研基金与博士后项目（MSCA、EMBO、HFSP、JSPS、洪堡、DAAD、牛顿基金、NRF 等），注明国籍与依托单位限制。`,
  intro: `面向在海外或拟赴境外开展研究的学者与博士后，收录覆盖英国、德国、欧洲各国、新加坡、日本及多国计划的 ${overseasRecords.length} 项境外科研基金、博士后与访问项目，清晰标注资助金额、截止时间与国籍/单位限制。`,
  items: overseasRecords,
  breadcrumbs: [['首页', '/'], ['境外机会', '/overseas/']],
  currentNav: '/overseas/',
  relatedPills: COUNTRY_HUBS.map(c => [c.name, `/country/${c.slug}/`, overseasRecords.filter(d => countryTab(d) === c.key).length]),
  priority: '0.9',
});
hubLinks.scopes.push(['境外机会', '/overseas/', overseasRecords.length]);

buildHubPage({
  urlPath: '/hmt/',
  title: `港澳台科研基金与博士后人才项目汇总（${hmtRecords.length}项）｜${SITE_NAME}`,
  h1: '香港、澳门与台湾地区科研基金及人才项目',
  description: `汇总香港、澳门、台湾地区高校及资助机构发布的 ${hmtRecords.length} 项科研基金、博士后与学术交流项目，含官方指南与核验日期。`,
  intro: `汇总面向香港、澳门及台湾地区依托高校或科研机构的 ${hmtRecords.length} 项科研资助与博士后项目，每条均标注官方申请入口与资格条件。`,
  items: hmtRecords,
  breadcrumbs: [['首页', '/'], ['港澳台项目', '/hmt/']],
  currentNav: '/national/',
  relatedPills: scopePills,
  priority: '0.75',
});
hubLinks.scopes.push(['港澳台项目', '/hmt/', hmtRecords.length]);

// 2b. Category Hubs
const allCategoryPills = Object.entries(CATEGORY_SLUGS).map(([cat, info]) => [
  cat, `/category/${info.slug}/`, records.filter(d => d.category === cat).length,
]);
for (const [cat, info] of Object.entries(CATEGORY_SLUGS)) {
  const items = records.filter(d => d.category === cat);
  if (!items.length) continue;
  buildHubPage({
    urlPath: `/category/${info.slug}/`,
    title: `${cat}项目申报汇总与时间表（${items.length}项）｜${SITE_NAME}`,
    h1: `${cat}项目汇总与申报时间表`,
    description: `${info.desc} 共收录 ${items.length} 项，附官方通知与核验日期。`,
    intro: `${info.desc} 当前共收录 ${items.length} 项，支持查看每项的申请条件、资助额度、开放/截止时间与官方指南链接。`,
    items,
    breadcrumbs: [['首页', '/'], [cat, `/category/${info.slug}/`]],
    relatedPills: allCategoryPills,
    priority: '0.85',
  });
  hubLinks.categories.push([cat, `/category/${info.slug}/`, items.length]);
}

// 2c. Regional Hubs (Provinces & Qualifying Cities)
const provinceEntries = Object.keys(AREAS)
  .map(prov => {
    const items = records.filter(d =>
      d.jurisdiction?.province === prov
      || (d.eligibleAreas || []).some(a => a.province === prov)
    );
    return { prov, slug: PROVINCE_SLUGS[prov], items };
  })
  .filter(e => e.slug && e.items.length >= 2);

const provincePills = provinceEntries.map(e => [`${e.prov}科研项目`, `/region/${e.slug}/`, e.items.length]);

for (const { prov, slug, items } of provinceEntries) {
  const isMunicipality = ['北京', '上海'].includes(prov);
  const label = isMunicipality ? `${prov}市` : `${prov}省`;
  buildHubPage({
    urlPath: `/region/${slug}/`,
    title: `${label}科研基金、人才计划与博士后项目汇总（${items.length}项）｜${SITE_NAME}`,
    h1: `${label}科研基金与人才项目申报汇总`,
    description: `汇总${label}科技厅/科委、社科规划办、人社部门及地方高校相关的 ${items.length} 项省级、市级与跨区域联合科研资助项目，附官方指南与截止日期。`,
    intro: `汇总覆盖${label}依托单位的 ${items.length} 项省级、市级及跨地区联合科研基金、青年人才与博士后项目。申请前请同时核对全国性项目与所在单位内部截止时间。`,
    items,
    breadcrumbs: [['首页', '/'], [`${prov}科研项目`, `/region/${slug}/`]],
    relatedPills: provincePills,
    priority: '0.8',
  });
  hubLinks.regions.push([prov, `/region/${slug}/`, items.length]);
}

// Qualifying city hubs (>= 3 city-specific opportunities)
const cityGroups = new Map();
for (const d of records) {
  const city = d.jurisdiction?.city;
  if (!city || !CITY_SLUGS[city]) continue;
  if (!cityGroups.has(city)) cityGroups.set(city, []);
  cityGroups.get(city).push(d);
}
for (const [city, cityOnly] of cityGroups.entries()) {
  if (cityOnly.length < 3) continue;
  const prov = cityOnly[0].jurisdiction?.province;
  const items = records.filter(d =>
    d.jurisdiction?.city === city
    || (d.eligibleAreas || []).some(a => a.province === prov && (!a.city || a.city === city))
  );
  const slug = CITY_SLUGS[city];
  buildHubPage({
    urlPath: `/region/${slug}/`,
    title: `${city}市科研基金与人才资助项目汇总（${items.length}项）｜${SITE_NAME}`,
    h1: `${city}市及覆盖该地区的科研基金与人才项目`,
    description: `包含 ${city}市级专项（${cityOnly.length}项）及覆盖${city}的${prov}省级、联合科研资助共 ${items.length} 项，附官方通知与申请资格。`,
    intro: `汇总面向${city}市依托单位的市级专项（${cityOnly.length}项）以及覆盖${city}的${prov}省级与跨地区联合项目，共 ${items.length} 项。`,
    items,
    breadcrumbs: [['首页', '/'], ...(prov && PROVINCE_SLUGS[prov] ? [[`${prov}科研项目`, `/region/${PROVINCE_SLUGS[prov]}/`]] : []), [`${city}市`, `/region/${slug}/`]],
    relatedPills: provincePills,
    priority: '0.75',
  });
  hubLinks.regions.push([`${city}市`, `/region/${slug}/`, items.length]);
}

// 2d. Destination Country Hubs
const countryPills = COUNTRY_HUBS.map(c => [
  c.key === '其他' ? '日本与多国' : c.key,
  `/country/${c.slug}/`,
  overseasRecords.filter(d => countryTab(d) === c.key).length,
]);
for (const hub of COUNTRY_HUBS) {
  const items = overseasRecords.filter(d => countryTab(d) === hub.key);
  if (!items.length) continue;
  buildHubPage({
    urlPath: `/country/${hub.slug}/`,
    title: `${hub.name}（${items.length}项）— ${hub.en}｜${SITE_NAME}`,
    h1: hub.name,
    description: `${hub.desc} 共收录 ${items.length} 项，含资助金额、申请资格与官网链接。`,
    intro: `${hub.desc} 当前收录 ${items.length} 项，保留官方英文项目名称与官网入口，便于直接检索与对比。`,
    items,
    breadcrumbs: [['首页', '/'], ['境外机会', '/overseas/'], [hub.key, `/country/${hub.slug}/`]],
    currentNav: '/overseas/',
    relatedPills: countryPills,
    priority: '0.85',
  });
  hubLinks.countries.push([hub.key === '其他' ? '日本与多国' : hub.key, `/country/${hub.slug}/`, items.length]);
}

// 2e. Audience Hubs
const audiencePills = AUDIENCE_HUBS.map(a => [
  a.name,
  `/audience/${a.slug}/`,
  records.filter(d => d.audience.some(x => a.match.includes(x))).length,
]);
for (const aud of AUDIENCE_HUBS) {
  const items = records.filter(d => d.audience.some(x => aud.match.includes(x)));
  if (!items.length) continue;
  buildHubPage({
    urlPath: `/audience/${aud.slug}/`,
    title: `${aud.name}可申请的科研基金与资助项目（${items.length}项）｜${SITE_NAME}`,
    h1: `面向${aud.name}的科研基金与资助机会`,
    description: `${aud.desc} 共收录 ${items.length} 项国内外项目，附申请条件、资助额度与截止时间。`,
    intro: `${aud.desc} 本页汇集适用人群包含“${aud.match.join('”或“')}”的 ${items.length} 项国内外项目。`,
    items,
    breadcrumbs: [['首页', '/'], [aud.name, `/audience/${aud.slug}/`]],
    relatedPills: audiencePills,
    priority: '0.8',
  });
  hubLinks.audiences.push([aud.name, `/audience/${aud.slug}/`, items.length]);
}

// ---------------------------------------------------------------------------
// 3. On-Site Monthly Deadline Roundups (/deadlines/ & /deadlines/YYYY-MM/)
// ---------------------------------------------------------------------------
const monthBuckets = new Map();
for (const d of records) {
  const dt = d.closing || d.opening;
  if (!dt) continue;
  const ym = dt.slice(0, 7);
  if (!monthBuckets.has(ym)) monthBuckets.set(ym, []);
  monthBuckets.get(ym).push(d);
}

const activeMonthKeys = [...monthBuckets.keys()]
  .filter(ym => {
    const list = monthBuckets.get(ym);
    const hasLive = list.some(d => d.status === 'open' || d.status === 'upcoming');
    return hasLive || (ym >= '2026-10' && list.length >= 2);
  })
  .sort();

const monthPills = activeMonthKeys.map(ym => {
  const [y, m] = ym.split('-');
  return [`${y}年${Number(m)}月`, `/deadlines/${ym}/`, monthBuckets.get(ym).length];
});

for (const ym of activeMonthKeys) {
  const [y, m] = ym.split('-');
  const mLabel = `${y}年${Number(m)}月`;
  const items = monthBuckets.get(ym).sort((a, b) => (a.closing || a.opening || '').localeCompare(b.closing || b.opening || ''));
  buildHubPage({
    urlPath: `/deadlines/${ym}/`,
    title: `${mLabel}截止与开放的科研基金项目清单（${items.length}项）｜${SITE_NAME}`,
    h1: `${mLabel}科研基金与人才项目申报日历`,
    description: `盘点 ${mLabel} 开放或截止的 ${items.length} 个国内外科研基金、青年人才、博士后与国际交流项目：谁能申、资助多少、何时截止。`,
    intro: `汇总 ${mLabel} 有明确官方开放或截止日期的 ${items.length} 项科研资助与人才机会。每条均核对官方通知原文，提醒注意所在单位的内部提前截止时间。`,
    items,
    breadcrumbs: [['首页', '/'], ['月度截止日历', '/deadlines/'], [mLabel, `/deadlines/${ym}/`]],
    currentNav: '/deadlines/',
    relatedPills: monthPills,
    priority: ym >= TODAY.slice(0, 7) ? '0.9' : '0.7',
  });
  hubLinks.deadlines.push([mLabel, `/deadlines/${ym}/`, items.length]);
}

// Master /deadlines/ page
const upcomingDeadlines = records
  .filter(d => (d.closing && d.closing >= TODAY) || (d.opening && d.opening >= TODAY))
  .sort((a, b) => (a.nextDate || '9999').localeCompare(b.nextDate || '9999'));

const deadlinesBody = `
<section class="hero-card">
  <h1>科研基金与人才项目月度申报日历</h1>
  <p class="tldr-box">按月份浏览当前及未来数月有明确官方开放或截止日期的科研基金、青年人才、博士后与国际交流项目。目前共有 <strong>${upcomingDeadlines.length}</strong> 项带有明确未来日期节点，可通过 <a href="/calendar.ics">iCalendar (.ics)</a> 订阅到日历应用。</p>
  <div class="pill-links">${monthPills.map(([label, href, count]) => `<a href="${esc(href)}">${esc(label)} <span>${count} 项</span></a>`).join('')}</div>
</section>
<section class="section-card">
  <h2>即将到来的确认日期节点（${upcomingDeadlines.length} 项）</h2>
  ${renderComparisonTable(upcomingDeadlines)}
</section>`;

writeOut('deadlines/index.html', renderShell({
  lang: 'zh-CN',
  title: `科研基金申报月度日历与截止时间汇总｜${SITE_NAME}`,
  description: `按月份查看 2026–2027 年国内外科研基金、青年人才与博士后项目的官方开放和截止日期，支持 iCalendar (.ics) 订阅。`,
  canonicalPath: '/deadlines/',
  currentNav: '/deadlines/',
  breadcrumbs: [['首页', '/'], ['月度截止日历', '/deadlines/']],
  bodyHtml: deadlinesBody,
  jsonLdGraph: [
    {
      '@type': 'CollectionPage',
      name: '科研基金申报月度日历',
      url: `${ORIGIN}/deadlines/`,
      dateModified: latestRunDate,
    },
    breadcrumbJsonLd([['首页', '/'], ['月度截止日历', '/deadlines/']]),
  ],
}));
registerUrl('/deadlines/', latestRunDate, '0.9', 'weekly');

// ---------------------------------------------------------------------------
// 4. Authority & Provenance Pages (/sources/ and /about/)
// ---------------------------------------------------------------------------
function classifySource(s) {
  const host = (() => { try { return new URL(s.url).hostname.toLowerCase(); } catch { return ''; } })();
  const label = s.label || '';
  if (!host.endsWith('.cn') && !host.includes('sh-italent') && !host.includes('sinoss') && !label.includes('中国') && !label.includes('省') && !label.includes('市') && !label.includes('大学') && !label.includes('学院') && !label.includes('国家')) {
    return '境外资助机构与国际平台';
  }
  if (/nsfc\.gov|nopss\.gov|chinapostdoctor|csc\.edu|most\.gov|moe\.gov|cas\.cn|csiam|sinoss|cast\.org/.test(host) || label.startsWith('国家') || label.startsWith('全国') || label.startsWith('教育部') || label.startsWith('中国博士后')) {
    return '全国性与部委官方来源';
  }
  if (host.includes('.edu.cn') || /大学|学院|研究院|研究所/.test(label)) {
    return '高校与科研院所通知入口';
  }
  if (host.endsWith('.gov.cn') || /省|市|厅|局|社科/.test(label)) {
    return '省市科技、社科与人社主管部门';
  }
  return '境外资助机构与国际平台';
}

const sourceGroupOrder = [
  '全国性与部委官方来源',
  '省市科技、社科与人社主管部门',
  '高校与科研院所通知入口',
  '境外资助机构与国际平台',
];
const groupedSources = Object.fromEntries(sourceGroupOrder.map(k => [k, []]));
for (const s of sourcesList) groupedSources[classifySource(s)].push(s);

const sourcesBody = `
<section class="hero-card">
  <h1>官方来源目录（共 ${sourcesList.length} 个核验入口）</h1>
  <p class="tldr-box">科研基金雷达每周系统核查以下 <strong>${sourcesList.length}</strong> 个官方资助门户、省市科技/社科/人社主管部门、高校科研院通知栏及国际资助机构网站。每条收录机会均直接链接至原始官方公告。</p>
  <dl class="stats-strip">
    ${sourceGroupOrder.map(g => `<div class="stat-box"><dt>${esc(g)}</dt><dd>${groupedSources[g].length}</dd></div>`).join('')}
  </dl>
</section>
${sourceGroupOrder.map(g => `<section class="section-card">
  <h2>${esc(g)}（${groupedSources[g].length}）</h2>
  <ul class="source-list">
    ${groupedSources[g].map(s => {
      const host = (() => { try { return new URL(s.url).hostname; } catch { return ''; } })();
      return `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.label)} ↗</a><span class="cell-muted">${esc(host)}</span></li>`;
    }).join('')}
  </ul>
</section>`).join('')}`;

writeOut('sources/index.html', renderShell({
  lang: 'zh-CN',
  title: `官方来源目录（${sourcesList.length}个资助机构与通知入口）｜${SITE_NAME}`,
  description: `完整列出科研基金雷达每周核查的 ${sourcesList.length} 个国家级部委、省市科技厅局、高校科研院及国际科研资助机构官方入口。`,
  canonicalPath: '/sources/',
  currentNav: '/sources/',
  breadcrumbs: [['首页', '/'], ['官方来源目录', '/sources/']],
  bodyHtml: sourcesBody,
  jsonLdGraph: [
    {
      '@type': 'CollectionPage',
      name: '科研基金雷达官方来源目录',
      description: `收录 ${sourcesList.length} 个官方科研资助发布渠道`,
      url: `${ORIGIN}/sources/`,
      dateModified: latestRunDate,
    },
    breadcrumbJsonLd([['首页', '/'], ['官方来源目录', '/sources/']]),
  ],
}));
registerUrl('/sources/', latestRunDate, '0.8', 'weekly');

// /about/ page (Methodology, E-E-A-T, Update Log, License)
const recentRuns = runs.slice(0, 10);
const aboutBody = `
<section class="hero-card">
  <h1>关于科研基金雷达 · 核验方法与开放数据说明</h1>
  <p class="tldr-box"><strong>科研基金雷达（SciGrant Radar）</strong>是一个免费、公开、无需登录的科研资助与人才项目目录，目前收录 <strong>${records.length}</strong> 项国内外机会，持续跟踪 <strong>${sourcesList.length}</strong> 个官方发布渠道。网站开源、每周更新，所有数据经自动校验与站长人工审阅后上线。</p>
  <div class="cta-row">
    <a class="btn" href="${REPO_URL}" target="_blank" rel="noopener noreferrer">GitHub 仓库 ↗</a>
    <a class="btn btn-secondary" href="${AUTHOR_URL}" target="_blank" rel="noopener noreferrer">作者学术主页 ↗</a>
    <a class="btn btn-secondary" href="/data/opportunities.json">原始 JSON 数据</a>
    <a class="btn btn-secondary" href="/llms.txt">AI 索引 (llms.txt)</a>
  </div>
</section>

<section class="section-card">
  <h2>数据核验原则（为什么不猜测截止日期）</h2>
  <ul>
    <li><strong>官方原文优先：</strong>每条记录必须附至少一个官方公告或权威机构转发链接，并记录精确核验日期（<code>verified</code>）。</li>
    <li><strong>不沿用往年日期推测新一轮：</strong>如果新一年度指南尚未发布，绝不将去年的截止日期自动顺延到今年；未确认状态统一标为“待核实”或保留上一轮记录作规划参考。</li>
    <li><strong>区分真实状态与无法访问：</strong>来源站点暂时无法访问时，不据此推断项目已截止或开放，而是保留原有核验记录并在更新日志中公开标注来源异常。</li>
    <li><strong>自动校验 + 人工审核发布：</strong>每次每周更新均通过 <code>npm run validate</code>（检查日期合法性、来源核验对应关系、禁止无故删改历史 ID）及单元测试，经维护者人工复核后合并发布。</li>
  </ul>
</section>

<section class="section-card">
  <h2>最近更新与核查记录（共 ${runs.length} 次）</h2>
  <div class="table-wrap"><table class="data-table">
    <thead><tr><th>日期</th><th>类型</th><th>结果</th><th>变更与核验</th><th>摘要</th></tr></thead>
    <tbody>
      ${recentRuns.map(r => `<tr>
        <td>${esc(r.date)}</td>
        <td>${esc(r.kind === 'initialize' ? '初始收录' : r.kind === 'correction' ? '人工更正' : '例行核查')}</td>
        <td>${esc(r.outcome === 'success' ? '完成' : '部分完成')}</td>
        <td>新增 ${Number(r.added || 0)} · 更新 ${Number(r.updated || 0)} · 核验 ${(r.checkedIds || []).length} 项</td>
        <td>${esc(r.summary)}</td>
      </tr>`).join('')}
    </tbody>
  </table></div>
</section>

<section class="section-card">
  <h2>数据许可与引用格式</h2>
  <p>本站整理的结构化数据采用 <a href="${LICENSE_URL}" target="_blank" rel="noopener noreferrer">CC BY-NC 4.0（署名-非商业性使用 4.0 国际）</a> 许可：欢迎高校课题组、学术博客、研究者及非商业工具转载与改编，请注明来源“科研基金雷达（SciGrant Radar）”并链接 <a href="${ORIGIN}/">${ORIGIN}</a>。官方通知原文版权归各发布机构所有。</p>
  <p>如需通过程序或 AI 助手引用，可直接读取 <a href="/llms.txt">/llms.txt</a>、<a href="/llms-full.txt">/llms-full.txt</a>、<a href="/feed.xml">/feed.xml</a> 或 <a href="/data/opportunities.json">/data/opportunities.json</a>。</p>
</section>`;

writeOut('about/index.html', renderShell({
  lang: 'zh-CN',
  title: `关于与核验方法 · 开放科研基金数据｜${SITE_NAME} ${SITE_NAME_EN}`,
  description: `了解科研基金雷达（SciGrant Radar）的每周官方核验流程、更新记录、开源仓库与 CC BY-NC 4.0 数据使用许可。`,
  canonicalPath: '/about/',
  currentNav: '/about/',
  breadcrumbs: [['首页', '/'], ['核验说明与关于', '/about/']],
  bodyHtml: aboutBody,
  jsonLdGraph: [
    {
      '@type': 'AboutPage',
      name: '关于科研基金雷达',
      url: `${ORIGIN}/about/`,
      dateModified: latestRunDate,
      mainEntity: {
        '@type': 'Organization',
        name: `${SITE_NAME} (${SITE_NAME_EN})`,
        url: `${ORIGIN}/`,
        sameAs: [REPO_URL, AUTHOR_URL],
      },
    },
    breadcrumbJsonLd([['首页', '/'], ['核验说明与关于', '/about/']]),
  ],
}));
registerUrl('/about/', latestRunDate, '0.8', 'weekly');

// ---------------------------------------------------------------------------
// 5. Bilingual English Portal (/en/index.html)
// ---------------------------------------------------------------------------
const enOpenOverseas = overseasRecords.filter(d => d.status === 'open' || d.status === 'upcoming');
const enInboundChina = nationalRecords.filter(d =>
  /nsfc|postdoc|csc|pifi|intergovernmental|yssp|international/i.test(d.id)
  || /国际|外国|来华|留学|博士后|青年科学基金/.test(d.name)
);

const enFaqs = [
  [
    'What is SciGrant Radar?',
    `SciGrant Radar (${ORIGIN}) is a free, open-access research funding and fellowship directory tracking ${records.length} verified opportunities across ${sourcesList.length} official portals, including ${overseasRecords.length} international fellowships (UK, Germany, EU, Singapore, Japan, and global) and ${nationalRecords.length} Chinese national schemes (NSFC, CPSF, CSC, MOST, MOE).`,
  ],
  [
    'How are grant deadlines verified?',
    `Every entry is checked weekly against official funder notices, validated automatically for schema integrity, and reviewed by a human maintainer before publication. Deadlines are never guessed or rolled forward from previous years; unconfirmed rounds remain explicitly marked.`,
  ],
  [
    'Can international researchers use SciGrant Radar to find funding in China or Europe?',
    `Yes. SciGrant Radar tracks both international fellowships across the UK (${overseasRecords.filter(d => countryTab(d) === '英国').length}), Germany (${overseasRecords.filter(d => countryTab(d) === '德国').length}), Europe (${overseasRecords.filter(d => countryTab(d) === '欧洲').length}), and Singapore (${overseasRecords.filter(d => countryTab(d) === '新加坡').length}), as well as China-based national funding such as NSFC, China Postdoctoral Science Foundation (CPSF), and bilateral calls.`,
  ],
];

const enBody = `
<section class="hero-card">
  <h1>SciGrant Radar — Verified Research Grants, Postdoc Fellowships & Funding Deadlines</h1>
  <p class="tldr-box"><strong>SciGrant Radar</strong> is a free, public, zero-login directory tracking <strong>${records.length}</strong> manually verified scientific grants, postdoctoral fellowships, early-career awards, and international exchange schemes across <strong>${sourcesList.length}</strong> official sources — including <strong>${overseasRecords.length}</strong> international programmes (UK, Germany, EU, Singapore, Japan, global) and <strong>${records.length - overseasRecords.length}</strong> Chinese national & regional schemes. Updated weekly under CC BY-NC 4.0.</p>
  ${renderStatsStrip(overseasRecords, { en: true })}
  <div class="cta-row">
    <a class="btn" href="/">Open Full Interactive Directory (中文)</a>
    <a class="btn btn-secondary" href="/llms.txt">AI Index (llms.txt)</a>
    <a class="btn btn-secondary" href="/calendar.ics">Calendar Feed (.ics)</a>
    <a class="btn btn-secondary" href="${REPO_URL}" target="_blank" rel="noopener noreferrer">Open Data on GitHub ↗</a>
  </div>
</section>

<section class="section-card">
  <h2>Browse International Funding by Destination</h2>
  <div class="pill-links">
    ${COUNTRY_HUBS.map(c => `<a href="/country/${c.slug}/">${esc(c.en)} <span>${overseasRecords.filter(d => countryTab(d) === c.key).length}</span></a>`).join('')}
  </div>
</section>

<section class="section-card">
  <h2>Currently Open & Upcoming International Grants (${enOpenOverseas.length})</h2>
  <p class="meta-note">Official English programme titles are preserved verbatim; individual pages include direct official funder URLs, eligibility, funding amounts, and last-verified dates.</p>
  ${renderComparisonTable(enOpenOverseas, { en: true })}
</section>

<section class="section-card">
  <h2>Key China National & Bilateral Schemes (${enInboundChina.length})</h2>
  <p class="meta-note">Major national programmes from NSFC, China Postdoctoral Science Foundation (CPSF), CSC, and MOST. Check individual grant pages for citizenship and host-institution rules.</p>
  ${renderComparisonTable(enInboundChina, { en: true })}
</section>

${renderFaqSection(enFaqs, 'Frequently Asked Questions')}`;

writeOut('en/index.html', renderShell({
  lang: 'en',
  title: `SciGrant Radar — Research Grants, Postdoc Fellowships & Funding Deadlines (China & International)`,
  description: `Free, weekly-verified directory of ${records.length} research grants, postdoctoral fellowships, and academic exchange opportunities across the UK, Germany, Europe, Singapore, Japan, and China (NSFC, CPSF, CSC).`,
  canonicalPath: '/en/',
  currentNav: '/en/',
  breadcrumbs: [['Home (中文)', '/'], ['English Guide', '/en/']],
  bodyHtml: enBody,
  jsonLdGraph: [
    {
      '@type': 'CollectionPage',
      name: 'SciGrant Radar English Guide',
      url: `${ORIGIN}/en/`,
      inLanguage: 'en',
      dateModified: latestRunDate,
    },
    {
      '@type': 'Dataset',
      name: 'SciGrant Radar Research Funding Opportunities Dataset',
      description: `Structured directory of ${records.length} verified research grants, early-career awards, postdoctoral fellowships, and exchange programmes.`,
      url: `${ORIGIN}/en/`,
      license: LICENSE_URL_EN,
      dateModified: latestRunDate,
      creator: { '@type': 'Person', name: 'kxqdesign', url: AUTHOR_URL },
      distribution: [
        { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: `${ORIGIN}/data/opportunities.json` },
        { '@type': 'DataDownload', encodingFormat: 'text/markdown', contentUrl: `${ORIGIN}/llms-full.txt` },
      ],
    },
    breadcrumbJsonLd([['Home', '/'], ['English Guide', '/en/']]),
    faqJsonLd(enFaqs),
  ],
  extraHead: `<link rel="alternate" hreflang="zh-CN" href="${ORIGIN}/">\n<link rel="alternate" hreflang="en" href="${ORIGIN}/en/">\n<link rel="alternate" hreflang="x-default" href="${ORIGIN}/">`,
  isEnglish: true,
}));
registerUrl('/en/', latestRunDate, '0.9', 'weekly');

// ---------------------------------------------------------------------------
// 6. Generate GEO & Machine-Readable Files: llms.txt, llms-full.txt, feed.xml, calendar.ics
// ---------------------------------------------------------------------------
const openRecords = records.filter(d => d.status === 'open');
const upcomingRecords = records.filter(d => d.status === 'upcoming');

const llmsTxt = `# 科研基金雷达 · SciGrant Radar

> Free, public, weekly-verified directory of ${records.length} research funding, early-career talent, postdoctoral fellowship, and academic exchange opportunities across China and international funders (${sourcesList.length} official sources). No login required.

- Website: ${ORIGIN}/
- English Guide: ${ORIGIN}/en/
- Open & Upcoming Calls: ${ORIGIN}/open/
- Monthly Deadline Calendar: ${ORIGIN}/deadlines/
- Official Sources Directory (${sourcesList.length} portals): ${ORIGIN}/sources/
- Verification Methodology & Update Log: ${ORIGIN}/about/
- Full Markdown Dataset (Open, Upcoming & Flagship): ${ORIGIN}/llms-full.txt
- Structured JSON Dataset: ${ORIGIN}/data/opportunities.json
- Atom Feed: ${ORIGIN}/feed.xml
- iCalendar Subscription: ${ORIGIN}/calendar.ics
- Source Code & Issue Tracker: ${REPO_URL}

## Editorial & Verification Policy
- Last dataset run: ${latestRunDate} (Reference build date: ${TODAY})
- Current counts: ${records.length} total (${openRecords.length} open, ${upcomingRecords.length} upcoming, ${records.filter(d => d.status === 'verify').length} to verify, ${records.filter(d => d.status === 'closed').length} archived/closed).
- Every record links directly to official funder notices and carries an explicit \`verified\` date.
- Deadlines are never inferred or rolled forward from prior annual cycles.
- Data License: CC BY-NC 4.0 (${LICENSE_URL_EN}). When citing, credit "科研基金雷达 (SciGrant Radar)" and link to the canonical grant URL \`${ORIGIN}/grant/<id>/\`.

## Core Directory Hubs
- [Open & Upcoming Opportunities (${openAndUpcoming.length})](${ORIGIN}/open/)
- [China National Opportunities (${nationalRecords.length})](${ORIGIN}/national/)
- [International / Overseas Opportunities (${overseasRecords.length})](${ORIGIN}/overseas/)
- [Hong Kong, Macao & Taiwan Opportunities (${hmtRecords.length})](${ORIGIN}/hmt/)
- [Monthly Deadline Calendar](${ORIGIN}/deadlines/)

## By Category
${hubLinks.categories.map(([label, href, n]) => `- [${label} (${n})](${ORIGIN}${href})`).join('\n')}

## By Destination Country / Region (International)
${hubLinks.countries.map(([label, href, n]) => `- [${label} (${n})](${ORIGIN}${href})`).join('\n')}

## By China Province / City
${hubLinks.regions.map(([label, href, n]) => `- [${label} (${n})](${ORIGIN}${href})`).join('\n')}

## By Career Stage
${hubLinks.audiences.map(([label, href, n]) => `- [${label} (${n})](${ORIGIN}${href})`).join('\n')}

## Currently Open Opportunities (Top 25)
${openRecords.slice(0, 25).map(d => `- [${d.name}](${ORIGIN}/grant/${d.id}/) (${d.org} · ${scopeLabel(d)} · ${datesText(d)} · [Markdown](${ORIGIN}/grant/${d.id}/index.md))`).join('\n')}
`;
writeOut('llms.txt', llmsTxt);

// llms-full.txt: comprehensive Markdown reference of all open, upcoming, verify, and flagship records
const formatMdRecord = d => `### ${d.name}
- URL: ${ORIGIN}/grant/${d.id}/
- Markdown: ${ORIGIN}/grant/${d.id}/index.md
- Funder: ${d.org}
- Status: ${PHASE[d.phase] || d.status} (${datesText(d)})
- Category & Scope: ${d.category} | ${scopeLabel(d)} | ${d.disciplines.map(v => DISCIPLINE_LABEL[v]).join(' / ')}
- Audience: ${d.audience.join('、')}
- Fields: ${d.fields}
- Support: ${d.support}
- Eligibility: ${d.eligibility}
- Geography: ${d.geographyNote || '以官方指南为准'}
- Official Source: ${d.sources[0].url}
- Verified: ${d.verified}
`;

const llmsFullTxt = `# SciGrant Radar (科研基金雷达) — Full Active & Reference Digest

Generated: ${TODAY} | Latest data run: ${latestRunDate} | Total records: ${records.length}
Canonical site: ${ORIGIN}/ | License: CC BY-NC 4.0 (Credit: 科研基金雷达 · scigrantradar.com)
Full JSON: ${ORIGIN}/data/opportunities.json

## 1. Open Opportunities (${openRecords.length})

${openRecords.map(formatMdRecord).join('\n')}

## 2. Upcoming Opportunities (${upcomingRecords.length})

${upcomingRecords.map(formatMdRecord).join('\n')}

## 3. To-Verify Opportunities (${records.filter(d => d.status === 'verify').length})

${records.filter(d => d.status === 'verify').map(formatMdRecord).join('\n')}

## 4. Complete Index of Archived / Historical Opportunities (${records.filter(d => d.status === 'closed').length})

${records.filter(d => d.status === 'closed').map(d => `- [${d.name}](${ORIGIN}/grant/${d.id}/) — ${d.org} | ${scopeLabel(d)} | ${datesText(d)} | Verified ${d.verified}`).join('\n')}
`;
writeOut('llms-full.txt', llmsFullTxt);

// Atom 1.0 feed (/feed.xml) — latest verified active opportunities
const xmlEsc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const feedItems = [...openRecords, ...upcomingRecords]
  .sort((a, b) => (b.verified || '').localeCompare(a.verified || '') || (a.nextDate || '9999').localeCompare(b.nextDate || '9999'))
  .slice(0, 60);

const feedXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="zh-CN">
  <title>${xmlEsc(SITE_NAME)} · ${xmlEsc(SITE_NAME_EN)}</title>
  <subtitle>${xmlEsc('每周核验的国内外科研基金、青年人才、博士后与交流合作机会目录')}</subtitle>
  <id>${ORIGIN}/feed.xml</id>
  <link href="${ORIGIN}/feed.xml" rel="self" type="application/atom+xml"/>
  <link href="${ORIGIN}/" rel="alternate" type="text/html"/>
  <updated>${xmlEsc(latestRunIso)}</updated>
  <rights>Data licensed under CC BY-NC 4.0 (${LICENSE_URL_EN})</rights>
  <author><name>${xmlEsc(SITE_NAME)}</name><uri>${ORIGIN}/</uri></author>
${feedItems.map(d => `  <entry>
    <title>${xmlEsc(`${d.name} [${PHASE[d.phase] || d.status}]`)}</title>
    <id>${ORIGIN}/grant/${xmlEsc(d.id)}/</id>
    <link href="${ORIGIN}/grant/${xmlEsc(d.id)}/" rel="alternate" type="text/html"/>
    <updated>${xmlEsc(d.verified)}T00:00:00Z</updated>
    <category term="${xmlEsc(d.category)}"/>
    <summary type="text">${xmlEsc(`${d.org} · ${scopeLabel(d)} · ${datesText(d)}。资助：${d.support}。资格：${d.eligibility}`)}</summary>
  </entry>`).join('\n')}
</feed>
`;
writeOut('feed.xml', feedXml);

// iCalendar feed (/calendar.ics) — confirmed upcoming opens & deadlines
const icsEsc = s => String(s ?? '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
const compactDate = ymd => ymd.replaceAll('-', '');
const nextCalDay = ymd => {
  const dt = new Date(ymd + 'T00:00:00Z');
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10).replaceAll('-', '');
};
const dtstamp = latestRunIso.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const icsEvents = [];
for (const d of records) {
  if (d.status === 'closed') continue;
  if (d.opening && d.opening >= TODAY) {
    icsEvents.push({
      uid: `${d.id}-open@scigrantradar.com`,
      date: d.opening,
      summary: `[开放] ${d.name}`,
      desc: `${d.org} | ${scopeLabel(d)} | ${datesText(d)} | 详情：${ORIGIN}/grant/${d.id}/ | 官方：${d.sources[0].url}`,
      url: `${ORIGIN}/grant/${d.id}/`,
    });
  }
  if (d.closing && d.closing >= TODAY) {
    icsEvents.push({
      uid: `${d.id}-close@scigrantradar.com`,
      date: d.closing,
      summary: `[截止] ${d.name}`,
      desc: `${d.org} | ${scopeLabel(d)} | ${datesText(d)} | 资助：${d.support} | 详情：${ORIGIN}/grant/${d.id}/ | 官方：${d.sources[0].url}`,
      url: `${ORIGIN}/grant/${d.id}/`,
    });
  }
}
icsEvents.sort((a, b) => a.date.localeCompare(b.date) || a.uid.localeCompare(b.uid));

const calendarIcs = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//SciGrant Radar//scigrantradar.com//ZH',
  'CALSCALE:GREGORIAN',
  'METHOD:PUBLISH',
  'X-WR-CALNAME:科研基金雷达 · SciGrant Radar',
  'X-WR-CALDESC:国内外科研基金、青年人才、博士后与交流合作项目官方开放与截止日期',
  'X-WR-TIMEZONE:Asia/Shanghai',
  ...icsEvents.flatMap(ev => [
    'BEGIN:VEVENT',
    `UID:${ev.uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${compactDate(ev.date)}`,
    `DTEND;VALUE=DATE:${nextCalDay(ev.date)}`,
    `SUMMARY:${icsEsc(ev.summary)}`,
    `DESCRIPTION:${icsEsc(ev.desc)}`,
    `URL:${ev.url}`,
    'END:VEVENT',
  ]),
  'END:VCALENDAR',
  '',
].join('\r\n');
writeOut('calendar.ics', calendarIcs);

// ---------------------------------------------------------------------------
// 7. Update site/index.html (JSON-LD, pre-rendered top open cards, crawlable directory)
// ---------------------------------------------------------------------------
const indexPath = path.join(SITE_DIR, 'index.html');
let indexHtml = fs.readFileSync(indexPath, 'utf8');

function replaceBetween(source, startMarker, endMarker, replacement) {
  const s = source.indexOf(startMarker);
  const e = source.indexOf(endMarker);
  if (s === -1 || e === -1 || e < s) {
    throw new Error(`Missing marker block ${startMarker} ... ${endMarker} in site/index.html`);
  }
  return source.slice(0, s + startMarker.length) + replacement + source.slice(e);
}

const homeJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${ORIGIN}/#website`,
      name: `${SITE_NAME} · ${SITE_NAME_EN}`,
      alternateName: ['科研基金雷达', 'SciGrant Radar'],
      url: `${ORIGIN}/`,
      inLanguage: ['zh-CN', 'en'],
      description: `免费、公开的国内外科研基金、青年人才、博士后与国际交流项目目录，收录 ${records.length} 项机会，覆盖 ${sourcesList.length} 个官方来源，每周核验更新。`,
    },
    {
      '@type': 'Dataset',
      '@id': `${ORIGIN}/#dataset`,
      name: '科研基金雷达开放数据集（SciGrant Radar Directory）',
      description: `持续每周人工核验的国内外科研基金、青年人才、博士后与学术交流机会结构化目录（${records.length} 项机会，${sourcesList.length} 个官方来源）。`,
      url: `${ORIGIN}/`,
      license: LICENSE_URL,
      dateModified: latestRunDate,
      creator: {
        '@type': 'Person',
        name: 'kxqdesign',
        url: AUTHOR_URL,
      },
      distribution: [
        { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: `${ORIGIN}/data/opportunities.json` },
        { '@type': 'DataDownload', encodingFormat: 'text/markdown', contentUrl: `${ORIGIN}/llms-full.txt` },
        { '@type': 'DataDownload', encodingFormat: 'application/atom+xml', contentUrl: `${ORIGIN}/feed.xml` },
      ],
    },
    {
      '@type': 'Organization',
      '@id': `${ORIGIN}/#organization`,
      name: `${SITE_NAME} · ${SITE_NAME_EN}`,
      url: `${ORIGIN}/`,
      logo: `${ORIGIN}/assets/radar-star.png`,
      sameAs: [REPO_URL, AUTHOR_URL],
    },
  ],
};

const headSnippet = `<link rel="alternate" hreflang="zh-CN" href="${ORIGIN}/"><link rel="alternate" hreflang="en" href="${ORIGIN}/en/"><link rel="alternate" hreflang="x-default" href="${ORIGIN}/"><link rel="alternate" type="application/atom+xml" title="${SITE_NAME} · Atom Feed" href="${ORIGIN}/feed.xml"><link rel="alternate" type="text/markdown" title="${SITE_NAME_EN} AI Summary" href="${ORIGIN}/llms.txt"><script type="application/ld+json">${safeJsonLd(homeJsonLd)}</script>`;

const preRenderedCards = openAndUpcoming.slice(0, 24).map(d =>
  `<article class="card" id="ssr-${esc(d.id)}" data-opportunity="${esc(d.id)}"><div class="card-top"><div class="card-labels"><span class="tag type-tag">${esc(d.category)}</span><span class="tag region">${esc(scopeLabel(d))}</span><span class="tag discipline">${d.disciplines.map(v => DISCIPLINE_LABEL[v]).join(' / ')}</span></div></div><div class="card-title"><h5><a href="grant/${esc(d.id)}/">${esc(d.name)}</a></h5><p class="org">${esc(d.org)}</p></div><p class="card-summary">${esc(d.summary)}</p><div class="status-row phase-${esc(d.phase)}"><span class="status-badge status-${esc(d.phase)}">${esc(PHASE[d.phase] || d.status)}</span><span class="date-text">${esc(datesText(d))}</span></div></article>`
).join('');

const relHref = p => p.replace(/^\//, '');
const directoryHtml = `<section class="seo-directory" aria-labelledby="seo-directory-title"><div class="seo-directory-head"><div><span class="eyebrow">INDEX &amp; HUBS</span><h2 id="seo-directory-title">按专题、地区与职业阶段浏览</h2><p>共收录 ${records.length} 项经官方来源核验的机会（开放中 ${openRecords.length} · 待开放 ${upcomingRecords.length}），以下为可直接收藏或检索的专题目录页。</p></div></div><div class="seo-directory-groups"><div><h3>核心范围与日历</h3><ul>${hubLinks.scopes.map(([l, h, n]) => `<li><a href="${relHref(h)}">${esc(l)}<span>${n}</span></a></li>`).join('')}<li><a href="deadlines/">月度截止日历<span>${hubLinks.deadlines.length}个月</span></a></li><li><a href="en/">English Guide<span>${overseasRecords.length}+</span></a></li></ul></div><div><h3>按机会类型</h3><ul>${hubLinks.categories.map(([l, h, n]) => `<li><a href="${relHref(h)}">${esc(l)}<span>${n}</span></a></li>`).join('')}</ul></div><div><h3>按国内省市</h3><ul>${hubLinks.regions.map(([l, h, n]) => `<li><a href="${relHref(h)}">${esc(l)}<span>${n}</span></a></li>`).join('')}</ul></div><div><h3>按境外目的地与阶段</h3><ul>${hubLinks.countries.map(([l, h, n]) => `<li><a href="${relHref(h)}">${esc(l)}<span>${n}</span></a></li>`).join('')}${hubLinks.audiences.map(([l, h, n]) => `<li><a href="${relHref(h)}">${esc(l)}<span>${n}</span></a></li>`).join('')}</ul></div><div><h3>开放数据与订阅</h3><ul><li><a href="sources/">全部官方来源<span>${sourcesList.length}</span></a></li><li><a href="about/">核验方法与更新记录</a></li><li><a href="feed.xml">Atom 订阅</a></li><li><a href="calendar.ics">日历订阅 (.ics)</a></li><li><a href="llms.txt">AI 摘要 (llms.txt)</a></li></ul></div></div></section>`;

if (!SKIP_INDEX) {
  indexHtml = replaceBetween(indexHtml, '<!-- SEO:HEAD:START -->', '<!-- SEO:HEAD:END -->', headSnippet);
  indexHtml = replaceBetween(indexHtml, '<!-- SEO:CARDS:START -->', '<!-- SEO:CARDS:END -->', preRenderedCards);
  indexHtml = replaceBetween(indexHtml, '<!-- SEO:DIRECTORY:START -->', '<!-- SEO:DIRECTORY:END -->', directoryHtml);
  fs.writeFileSync(indexPath, indexHtml, 'utf8');
}

// ---------------------------------------------------------------------------
// 8. Generate Complete sitemap.xml
// ---------------------------------------------------------------------------
const allSitemapUrls = [
  { loc: `${ORIGIN}/`, lastmod: latestRunDate, priority: '1.0', changefreq: 'daily' },
  ...sitemapEntries,
];

const seenLocs = new Set();
const dedupedSitemapUrls = allSitemapUrls.filter(u => {
  if (seenLocs.has(u.loc)) return false;
  seenLocs.add(u.loc);
  return true;
});

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${dedupedSitemapUrls.map(u => `  <url>
    <loc>${xmlEsc(u.loc)}</loc>
    <lastmod>${xmlEsc(u.lastmod)}</lastmod>
    <changefreq>${xmlEsc(u.changefreq)}</changefreq>
    <priority>${xmlEsc(u.priority)}</priority>
  </url>`).join('\n')}
</urlset>
`;
writeOut('sitemap.xml', sitemapXml);

console.log(`Built SEO & GEO assets for ${ORIGIN} (today=${TODAY}, lastRun=${latestRunDate}):`);
console.log(`  - Grant detail pages: ${records.length} HTML + ${records.length} Markdown`);
console.log(`  - Total sitemap URLs: ${dedupedSitemapUrls.length}`);
console.log(`  - Calendar events:    ${icsEvents.length}`);
console.log(`  - Atom feed entries:  ${feedItems.length}`);
