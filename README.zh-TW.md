# Wizarr Telegram 助理

[English](README.md) | **繁體中文** | [简体中文](README.zh-CN.md) | [日本語](README.ja.md)

用 Telegram **回覆鍵盤**（Reply Keyboard）操作 [Wizarr](https://github.com/wizarrrr/wizarr) API。

- Docker 版在 [`docker/`](docker/)，長駐執行，預設 long polling
- Worker 版在 [`worker/`](worker/)，由 GitHub Action 部署到 Cloudflare
- 介面支援繁體中文、简体中文、English、日本語四種語言切換，預設英文

只接受允許清單裡的帳號，而且只在私訊中提供功能。共用邏輯在 `src/`。

## 功能

| 鍵盤 | Wizarr API |
| --- | --- |
| 狀態 | `GET /api/status` |
| 列出 / 啟用 / 停用 / 延長 / 刪除使用者、重設密碼 | `GET /api/users`、`POST /api/users/{id}/enable`、`disable`、`extend`、`reset-password`、`DELETE /api/users/{id}` |
| 列出 / 建立 / 刪除邀請 | `GET\|POST /api/invitations`、`DELETE /api/invitations/{id}` |
| 媒體庫 | `GET /api/libraries` |
| 伺服器 | `GET /api/servers` |

建立邀請會依序詢問：伺服器、邀請連結有效期、帳號期限、媒體庫、下載 / 直播 / 上傳。停用與刪除都要再按一次確認。列出或建立邀請時，會再送出該邀請網址的 QR code。只有一台已驗證伺服器時會自動使用該台；多台時會列出 #ID 與名稱對照，可複選後一次邀請多台。

快速邀請會立即建立邀請，只使用已驗證的伺服器（Emby、Plex 等）。預設值為：連結 7 天、帳號無限制，下載、直播與上傳皆關閉，媒體庫為全部已啟用的媒體庫。這些預設值都能在主選單的「⚙️ 設定」調整：連結有效期、帳號期限、權限，以及預設媒體庫（可改為自訂媒體庫，可複選多台伺服器、媒體庫會合併顯示；伺服器缺少所選媒體庫時不會建立）。連結到期前再按會沿用同一組代碼，但更改任何設定後會新建一組。設定與代碼在 Worker 版記在 KV，Docker 版重啟後會還原預設值。

Wizarr 在停用失敗時可能改為刪除帳號，確認畫面會先說明這件事。邀請網址若是 `/j/...` 這類相對路徑，會補上 `WIZARR_PUBLIC_URL`。

## 多語言

介面支援繁體中文、简体中文、English、日本語，預設英文。第一次使用時機器人會要求選擇語言，之後隨時可在「⚙️ 設定 → 🌐 語言」切換。語言偏好記在每位使用者的 session store（Worker 版在 KV）。

每種語言是一個獨立檔案，放在 `src/i18n/`（`en.ts`、`zh-TW.ts`、`zh-CN.ts`、`ja.ts`）。語言檔只放純字串資料（模板用 `{佔位符}`），共用邏輯集中在 `src/i18n/build.ts` 的 `buildCatalog()`；資料結構由 `CatalogStrings` 定義，漏填任何字串都會在編譯期報錯。新增語言的步驟：

1. 在 `src/i18n/` 新增 `<語言代碼>.ts`，參考現有檔案用 `buildCatalog()` 匯出一份完整資料。
2. 在 `src/i18n.ts` 匯入該檔案，把語言代碼加進 `LANGS`、`CATALOGS` 與 `LANG_LABELS`。
3. 執行 `npm test` 與 `npm run typecheck` 確認。

## Docker

Wizarr 在區網內時用這個方式。容器已加入 `host.docker.internal`，可連到宿主機上的 Wizarr。

```bash
cp docker/.env.example docker/.env
docker compose -f docker/docker-compose.yml up -d
```

這會拉取預建的 `linux/amd64` 映像 `ghcr.io/wongkino/tgbot_wizarr_assistant:latest`（由 repo 的 **docker** GitHub Action 手動建置發佈）。若套件設為 private，請先 `docker login ghcr.io`。要改從原始碼建置，改用 `docker/docker-compose.yml` 裡註解的 `build:` 設定，並執行 `up -d --build`。

`MODE=polling` 時不需要對外出埠。Telegram 會由容器主動連線。

若要改成 webhook，把 `docker/.env` 的 `MODE` 設為 `webhook`，在前面放好 HTTPS 反向代理，並設定 webhook：

```bash
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -d "url=https://bot.example.com/telegram" \
  -d "secret_token=${TELEGRAM_WEBHOOK_SECRET}" \
  -d 'allowed_updates=["message"]'
```

| 變數 | 說明 |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | BotFather 的 token |
| `TELEGRAM_ADMIN_IDS` | 允許操作的 Telegram 數字 ID，逗號分隔。留空時只會回覆對方的 ID |
| `TELEGRAM_WEBHOOK_SECRET` | Webhook 密鑰。polling 可不填；webhook 必填 |
| `WIZARR_URL` | Wizarr 位址，例如 `http://host.docker.internal:5690` |
| `WIZARR_API_KEY` | Wizarr → Settings → API Keys |
| `WIZARR_PUBLIC_URL` | 邀請連結用的對外網址 |
| `MODE` | `polling` 或 `webhook` |
| `PORT` | HTTP 埠，預設 `8080`。`GET /health` 可做健康檢查 |

第一次不知道自己的 ID 時，先讓 `TELEGRAM_ADMIN_IDS` 留空並啟動，對機器人傳 `/start`，它會回覆 ID。寫進 `docker/.env` 後再重建容器。

## Cloudflare Worker

Worker 必須能從公網連到 Wizarr。Wizarr 只聽區網時請改用 Docker，或先用 Cloudflare Tunnel 把 Wizarr 公開出來。

安裝方式是推上 `main`，由 [`.github/workflows/deploy-worker.yml`](.github/workflows/deploy-worker.yml) 部署。Action 會先跑測試，建立或沿用名為 `tgbot-wizarr-assistant-SESSIONS` 的 KV，再部署 Worker，並把 Telegram webhook 指到 `https://tgbot-wizarr-assistant.<帳號>.workers.dev/telegram`。

在 GitHub 倉庫的 Settings → Secrets and variables → Actions 建立這些 secrets：

| Secret | 說明 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | 需要 Workers Scripts 與 Workers KV Storage 的編輯權限 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 帳號 ID |
| `TELEGRAM_BOT_TOKEN` | BotFather 的 token |
| `TELEGRAM_ADMIN_IDS` | 允許操作的 Telegram ID，逗號分隔 |
| `TELEGRAM_WEBHOOK_SECRET` | Webhook 密鑰，必填 |
| `WIZARR_URL` | 公開的 Wizarr 位址 |
| `WIZARR_API_KEY` | Wizarr API key |
| `WIZARR_PUBLIC_URL` | 邀請連結用的對外網址 |

API token 可在 Cloudflare 儀表板的 My Profile → API Tokens 建立。然後把程式推上 `main`，或在 Actions 頁手動執行 Deploy Worker。

本地除錯可複製 `worker/.dev.vars.example` 為 `worker/.dev.vars`，再執行 `npm run cf:dev`。

## 本機開發

需要 Node.js 22 或以上。

```bash
npm ci
npm test
npm run typecheck
cp docker/.env.example docker/.env
npm run dev
```

`npm run build` 會產出 `dist/node.mjs`，給 Docker 映像使用。

## 授權

[MIT](LICENSE)
