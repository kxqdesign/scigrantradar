# 科研基金雷达 · SciGrant Radar

<https://scigrantradar.com>

一份面向科研人员的资助与人才项目目录：科研基金、青年人才、博士后与交流合作机会。可按学科、资助来源和地域筛选，查看资格、时间线和官方指南。网站免费、公开，无需登录。

## 数据如何更新

1. 每周由一个自动收集程序查阅官方来源，按 [docs/update-guide.md](docs/update-guide.md) 整理新增与更正，提交一份合并请求。
2. 自动检查运行数据校验和测试。
3. 站长审阅后合并，网站随即自动发布。未经审阅的数据不会上线。

每条记录都附有官方来源链接和核验日期。核验日期只在该条记录确实被重新核对时才会更新。

## 发现错误？

欢迎[提交 issue](../../issues)，请附上官方通知的链接。

## 支持小站

网站免费。如果它帮你省了些时间，欢迎微信扫码赞赏。

<img src="site/assets/wechat-reward.jpg" alt="科研基金雷达 · 微信赞赏码" width="260">

## 本地运行

需要 Node.js 22 或更高版本，无需安装任何依赖。

```bash
npm run preview
```

```bash
npm test
```

```bash
npm run validate
```

`npm run validate -- --base origin/main` 会额外与主分支比较，检查是否有记录被删除、改动是否都对应到一次登记过的检查。

## 目录

- `site/`：网站本身，原样发布，没有构建步骤。数据在 `site/data/`。
- `scripts/validate.mjs`：数据校验。
- `tests/`：测试。
- `docs/update-guide.md`：每周收集的工作指引。
- `docs/launch-checklist.md`：上线步骤。

---

## English

SciGrant Radar is a free, public directory of research funding, early-career, postdoctoral and exchange opportunities. The interface is currently in Chinese.

The data is refreshed weekly: an automated collector reads official sources and opens a pull request following [docs/update-guide.md](docs/update-guide.md); automated checks validate it; the maintainer reviews and merges, which publishes the site. Nothing is published without review.

Found a mistake? Please [open an issue](../../issues) with a link to the official notice.

The site is free. If it saves you time, you are welcome to leave a tip with the WeChat code shown above.

The site is plain static files in `site/` with no build step and no dependencies. `npm run preview` serves it locally; `npm test` and `npm run validate` run the checks.
