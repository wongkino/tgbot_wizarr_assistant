# Wizarr Telegram 助手

[English](README.md) | [繁體中文](README.zh-TW.md) | **简体中文** | [日本語](README.ja.md)

用 Telegram **回复键盘**（Reply Keyboard）操作 [Wizarr](https://github.com/wizarrrr/wizarr) API。

- Docker 版在 [`docker/`](docker/)，长驻运行，默认 long polling
- Worker 版在 [`worker/`](worker/)，由 GitHub Action 部署到 Cloudflare
- 界面支持繁體中文、简体中文、English、日本語四种语言切换，默认英文

只接受允许清单里的账号，而且只在私聊中提供功能。共用逻辑在 `src/`。

## 功能

| 键盘 | Wizarr API |
| --- | --- |
| 状态 | `GET /api/status` |
| 列出 / 启用 / 禁用 / 延长 / 删除用户、重置密码 | `GET /api/users`、`POST /api/users/{id}/enable`、`disable`、`extend`、`reset-password`、`DELETE /api/users/{id}` |
| 列出 / 创建 / 删除邀请 | `GET\|POST /api/invitations`、`DELETE /api/invitations/{id}` |
| 媒体库 | `GET /api/libraries` |
| 服务器 | `GET /api/servers` |

创建邀请会依次询问：服务器、邀请链接有效期、账号期限、媒体库、下载 / 直播 / 上传。禁用与删除都要再按一次确认。列出或创建邀请时，会再发送该邀请网址的二维码。只有一台已验证服务器时会自动使用该台；多台时会列出 #ID 与名称对照，可多选后一次邀请多台。

快速邀请会立即创建邀请，只使用已验证的 Emby。默认值为：链接 7 天、账号无限制，下载、直播与上传皆关闭，媒体库为全部已启用的媒体库。这些默认值都能在主菜单的「⚙️ 设置」调整：链接有效期、账号期限、权限，以及默认媒体库（可改为自定义媒体库；服务器缺少所选媒体库时不会创建）。链接到期前再按会沿用同一组代码，但更改任何设置后会新建一组。设置与代码在 Worker 版记在 KV，Docker 版重启后会还原默认值。

Wizarr 在禁用失败时可能改为删除账号，确认画面会先说明这件事。邀请网址若是 `/j/...` 这类相对路径，会补上 `WIZARR_PUBLIC_URL`。

## 多语言

界面支持繁體中文、简体中文、English、日本語，默认英文。第一次使用时机器人会要求选择语言，之后随时可在「⚙️ 设置 → 🌐 语言」切换。语言偏好记在每位用户的 session store（Worker 版在 KV）。

每种语言是一个独立文件，放在 `src/i18n/`（`en.ts`、`zh-TW.ts`、`zh-CN.ts`、`ja.ts`）。语言文件只放纯字符串数据（模板用 `{占位符}`），共用逻辑集中在 `src/i18n/build.ts` 的 `buildCatalog()`；数据结构由 `CatalogStrings` 定义，漏填任何字符串都会在编译期报错。新增语言的步骤：

1. 在 `src/i18n/` 新增 `<语言代码>.ts`，参考现有文件用 `buildCatalog()` 导出一份完整数据。
2. 在 `src/i18n.ts` 导入该文件，把语言代码加进 `LANGS`、`CATALOGS` 与 `LANG_LABELS`。
3. 执行 `npm test` 与 `npm run typecheck` 确认。

## Docker

Wizarr 在局域网内时用这个方式。容器已加入 `host.docker.internal`，可连到宿主机上的 Wizarr。

```bash
cp docker/.env.example docker/.env
docker compose -f docker/docker-compose.yml up -d
```

这会拉取预建的 `linux/amd64` 镜像 `ghcr.io/wongkino/tgbot_wizarr_assistant:latest`（由 repo 的 **docker** GitHub Action 手动构建发布）。若套件设为 private，请先 `docker login ghcr.io`。要改从源代码构建，改用 `docker/docker-compose.yml` 里注释的 `build:` 设置，并执行 `up -d --build`。

`MODE=polling` 时不需要对外端口。Telegram 会由容器主动连线。

若要改成 webhook，把 `docker/.env` 的 `MODE` 设为 `webhook`，在前面放好 HTTPS 反向代理，并设置 webhook：

```bash
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -d "url=https://bot.example.com/telegram" \
  -d "secret_token=${TELEGRAM_WEBHOOK_SECRET}" \
  -d 'allowed_updates=["message"]'
```

| 变量 | 说明 |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | BotFather 的 token |
| `TELEGRAM_ADMIN_IDS` | 允许操作的 Telegram 数字 ID，逗号分隔。留空时只会回复对方的 ID |
| `TELEGRAM_WEBHOOK_SECRET` | Webhook 密钥。polling 可不填；webhook 必填 |
| `WIZARR_URL` | Wizarr 地址，例如 `http://host.docker.internal:5690` |
| `WIZARR_API_KEY` | Wizarr → Settings → API Keys |
| `WIZARR_PUBLIC_URL` | 邀请链接用的对外网址 |
| `MODE` | `polling` 或 `webhook` |
| `PORT` | HTTP 端口，默认 `8080`。`GET /health` 可做健康检查 |

第一次不知道自己的 ID 时，先让 `TELEGRAM_ADMIN_IDS` 留空并启动，对机器人发 `/start`，它会回复 ID。写进 `docker/.env` 后再重建容器。

## Cloudflare Worker

Worker 必须能从公网连到 Wizarr。Wizarr 只听局域网时请改用 Docker，或先用 Cloudflare Tunnel 把 Wizarr 公开出来。

安装方式是推上 `main`，由 [`.github/workflows/deploy-worker.yml`](.github/workflows/deploy-worker.yml) 部署。Action 会先跑测试，创建或沿用名为 `tgbot-wizarr-assistant-SESSIONS` 的 KV，再部署 Worker，并把 Telegram webhook 指到 `https://tgbot-wizarr-assistant.<账号>.workers.dev/telegram`。

在 GitHub 仓库的 Settings → Secrets and variables → Actions 创建这些 secrets：

| Secret | 说明 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | 需要 Workers Scripts 与 Workers KV Storage 的编辑权限 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账号 ID |
| `TELEGRAM_BOT_TOKEN` | BotFather 的 token |
| `TELEGRAM_ADMIN_IDS` | 允许操作的 Telegram ID，逗号分隔 |
| `TELEGRAM_WEBHOOK_SECRET` | Webhook 密钥，必填 |
| `WIZARR_URL` | 公开的 Wizarr 地址 |
| `WIZARR_API_KEY` | Wizarr API key |
| `WIZARR_PUBLIC_URL` | 邀请链接用的对外网址 |

API token 可在 Cloudflare 仪表板的 My Profile → API Tokens 创建。然后把代码推上 `main`，或在 Actions 页手动执行 Deploy Worker。

本地调试可复制 `worker/.dev.vars.example` 为 `worker/.dev.vars`，再执行 `npm run cf:dev`。

## 本机开发

需要 Node.js 22 或以上。

```bash
npm ci
npm test
npm run typecheck
cp docker/.env.example docker/.env
npm run dev
```

`npm run build` 会产出 `dist/node.mjs`，给 Docker 镜像使用。
