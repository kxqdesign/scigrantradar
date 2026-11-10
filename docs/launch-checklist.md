# 上线清单

按顺序做。前四步让新站上线；第五步之后才处理旧站。各平台的界面文字可能与下面略有出入，以实际页面为准。

## 1. 把仓库推到 GitHub

1. 在 GitHub 新建一个**公开**仓库，名称 `scigrantradar`。不要勾选自动生成 README、.gitignore 或许可证。
2. 在本机的仓库目录里运行（把 `<用户名>` 换成你的 GitHub 用户名）：

```bash
git remote add origin https://github.com/<用户名>/scigrantradar.git
```

```bash
git push -u origin main
```

3. 打开仓库的 Actions 页面，确认名为 `check` 的检查通过。

## 2. 用 Cloudflare Pages 发布

1. 登录 Cloudflare，进入 Workers & Pages，新建一个 Pages 项目，选择"连接到 Git"，授权并选中 `scigrantradar` 仓库。
2. 构建设置：
   - 生产分支：`main`
   - 框架预设：无
   - 构建命令：留空
   - 构建输出目录：`site`
3. 保存并部署。完成后会得到一个 `<项目名>.pages.dev` 地址，打开它确认网站正常。

## 3. 绑定域名

1. **`scigrantradar.com`**：在 Cloudflare 里"添加站点"，输入 `scigrantradar.com`，选免费套餐。Cloudflare 会给出两个域名服务器地址；到你购买域名的注册商那里，把域名服务器改成这两个。生效通常需要几分钟到几小时。
2. 回到 Pages 项目的"自定义域"，依次添加 `scigrantradar.com` 和 `www.scigrantradar.com`。解析记录会自动创建。
3. 用无痕窗口打开 `https://scigrantradar.com`，确认能直接看到网站；打开 `https://www.scigrantradar.com`，确认会跳到不带 www 的地址。

## 4. 保护主分支

仓库 Settings → Branches（或 Rules）→ 为 `main` 添加规则：

- 合并前必须通过拉取请求。
- 必须通过状态检查，并选中 `check`。

这样数据只能经由"合并请求 + 检查通过 + 你点合并"进入线上。

## 5. 验证新站

- 无痕窗口、手机各打开一次 `https://scigrantradar.com`。
- 请一两位在国内的朋友打开试试，记下是否能打开、快慢如何。
- 试一次完整流程：在 GitHub 网页上对 `README.md` 做一处小修改并提交合并请求，确认检查通过、合并后网站自动重新发布。

## 6. 切换旧地址（新站确认无误后再做）

1. 在 Pages 项目的"自定义域"里添加 `researchradar.kxqdesign.com`。
2. 到 `kxqdesign.com` 的解析服务商那里，把 `researchradar` 这条记录改为 CNAME，指向 `<项目名>.pages.dev`。
3. 生效后，访问旧地址会自动跳到 `https://scigrantradar.com`。

注意：这一步做完，旧地址就不再通往原来的站点了。

## 7. 停用旧的更新任务和旧站点

- 停用原来那个每周自动更新的定时任务，避免它继续往旧站写数据。
- 下线原来的旧站点。

这两件事的时机由你决定，建议在第 6 步完成并观察几天之后。

## 8. 接上每周收集

给负责收集的自动程序两样东西：

- 对这个仓库的访问权限（能建分支、能提交合并请求；不需要合并权限）。
- 一句固定的任务说明：**"按仓库里的 `docs/update-guide.md` 完成本周的数据更新。"**

设为每周运行一次。之后你每周要做的就是打开那份合并请求，看一眼，点合并。
