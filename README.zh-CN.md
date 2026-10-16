# Wizarr Telegram 助手

[English](README.md) | [繁體中文](README.zh-TW.md) | **简体中文** | [日本語](README.ja.md)

用 Telegram **回复键盘**（Reply Keyboard）操作 [Wizarr](https://github.com/wizarrrr/wizarr) API。

- 跑在 Telegram Serverless，入口在 [`tgcloud/`](tgcloud/)
- 界面支持繁體中文、简体中文、English、日本語四种语言切换，默认英文

只接受允许清单里的账号，而且只在私聊中提供功能。共用逻辑在 `src/`。

## 功能

| 键盘 | Wizarr API |
| --- | --- |
| 状态 → 用户状态 | `GET /api/status` |
| 列出 / 启用 / 禁用 / 延长 / 删除用户、重置密码 | `GET /api/users`、`POST /api/users/{id}/enable`、`disable`、`extend`、`reset-password`、`DELETE /api/users/{id}` |
| 列出 / 创建 / 删除邀请 | `GET\|POST /api/invitations`、`DELETE /api/invitations/{id}` |
| 状态 → 媒体库状态 | `GET /api/libraries` |
| 状态 → 服务器状态 | `GET /api/servers` |

创建邀请会依次询问：服务器、邀请链接有效期、账号期限、媒体库、下载 / 直播 / 上传。禁用与删除都要再按一次确认。列出或创建邀请时，会再发送该邀请网址的二维码（可在「⚙️ 设置 → 📱 QR code」关闭）。只有一台已验证服务器时会自动使用该台；多台时会列出 #ID 与名称对照，可多选后一次邀请多台。

快速邀请会立即创建邀请，不用再选择服务器：跟随设置默认媒体库时勾选的服务器与媒体库；从未设置时则涵盖所有已验证的服务器（Emby、Plex 等）。默认值为：链接 7 天、账号无限制，下载、直播与上传皆关闭，媒体库为全部已启用的媒体库。这些默认值都能在主菜单的「⚙️ 设置 → ⚡ 快速邀请设置」调整：链接有效期、账号期限、权限、默认媒体库（逐台选择服务器与旗下媒体库，选完一台可再加入其他服务器；服务器缺少所选媒体库时不会创建），以及是否沿用代码。链接到期前再按会沿用同一组代码（永不过期的链接会一直沿用），但更改任何设置后会新建一组；关闭沿用后每次都会创建新邀请。设置与代码记在 SQLite。

Wizarr 在禁用失败时可能改为删除账号，确认画面会先说明这件事。邀请网址若是 `/j/...` 这类相对路径，会补上 `WIZARR_PUBLIC_URL`。

## 多语言

界面支持繁體中文、简体中文、English、日本語，默认英文。第一次使用时机器人会要求选择语言，之后随时可在「⚙️ 设置 → 🌐 语言」切换。语言偏好记在每位用户的 SQLite session。

每种语言是一个独立文件，放在 `src/i18n/`（`en.ts`、`zh-TW.ts`、`zh-CN.ts`、`ja.ts`）。语言文件只放纯字符串数据（模板用 `{占位符}`），共用逻辑集中在 `src/i18n/build.ts` 的 `buildCatalog()`；数据结构由 `CatalogStrings` 定义，漏填任何字符串都会在编译期报错。新增语言的步骤：

1. 在 `src/i18n/` 新增 `<语言代码>.ts`，参考现有文件用 `buildCatalog()` 导出一份完整数据。
2. 在 `src/i18n.ts` 导入该文件，把语言代码加进 `LANGS`、`CATALOGS` 与 `LANG_LABELS`。
3. 执行 `npm test` 与 `npm run typecheck` 确认。

## Telegram Serverless

程序跑在 Telegram 自己的基础设施上，入口在 [`tgcloud/`](tgcloud/)。共用逻辑仍在 `src/`。`npm run tg:build` 会把程序编成 `tgcloud/lib/bot.js`，并依 `serverless/.env` 写出 `tgcloud/lib/config.js`。这两个文件含连接资料，已列入 `.gitignore`。

Wizarr 必须能从公网连到。

1. 在 @BotFather 打开 bot → Serverless，启用后到 CLI Access 复制 Access token。这组 token 与 bot token 不同。
2. 复制 `serverless/.env.example` 为 `serverless/.env`，填入 Wizarr 地址、API key 与允许的 Telegram ID。
3. 部署：

```bash
npx tgcloud login
npm run tg:build
npx tgcloud push
npx tgcloud migrate --safe
npx tgcloud webhook sync
```

也可以在 GitHub Actions 手动执行 [Deploy Telegram Serverless](.github/workflows/deploy-serverless.yml)。Secrets：

| Secret | 说明 |
| --- | --- |
| `TGCLOUD_TOKEN` | BotFather → Serverless → CLI Access 的 token，格式 `app:…` |
| `TELEGRAM_ADMIN_IDS` | 允许操作的 Telegram ID，逗号分隔 |
| `WIZARR_URL` | 公开的 Wizarr 地址 |
| `WIZARR_API_KEY` | Wizarr API key |
| `WIZARR_PUBLIC_URL` | 邀请链接用的对外网址 |
| `TIMEZONE` | 选填。日期显示的 IANA 时区，默认 `Asia/Hong_Kong` |

不需要 `TELEGRAM_BOT_TOKEN` 与 `TELEGRAM_WEBHOOK_SECRET`。平台代为调用 Bot API，并自己管理 webhook。对话状态存在 SQLite 的 `records` 表，第一次部署要跑 `migrate` 建立它。

## 本机开发

需要 Node.js 22 或以上。

```bash
npm ci
npm test
npm run typecheck
cp serverless/.env.example serverless/.env
npm run tg:build
```

`npm run tg:bundle` 会产出 `tgcloud/lib/bot.js`。`npm run tg:build` 还会依 `serverless/.env` 写出 `tgcloud/lib/config.js`。

## 许可

[MIT](LICENSE)
