# Wizarr Telegram 助理

[English](README.md) | **繁體中文** | [简体中文](README.zh-CN.md) | [日本語](README.ja.md)

用 Telegram **回覆鍵盤**（Reply Keyboard）操作 [Wizarr](https://github.com/wizarrrr/wizarr) API。

- 跑在 Telegram Serverless，入口在 [`tgcloud/`](tgcloud/)
- 介面支援繁體中文、简体中文、English、日本語四種語言切換，預設英文

只接受允許清單裡的帳號，而且只在私訊中提供功能。共用邏輯在 `src/`。

## 功能

| 鍵盤 | Wizarr API |
| --- | --- |
| 狀態 → 使用者狀態 | `GET /api/status` |
| 列出 / 啟用 / 停用 / 延長 / 刪除使用者、重設密碼 | `GET /api/users`、`POST /api/users/{id}/enable`、`disable`、`extend`、`reset-password`、`DELETE /api/users/{id}` |
| 列出 / 建立 / 刪除邀請 | `GET\|POST /api/invitations`、`DELETE /api/invitations/{id}` |
| 狀態 → 媒體庫狀態 | `GET /api/libraries` |
| 狀態 → 伺服器狀態 | `GET /api/servers` |

建立邀請會依序詢問：伺服器、邀請連結有效期、帳號期限、媒體庫、下載 / 直播 / 上傳。停用與刪除都要再按一次確認。列出或建立邀請時，會再送出該邀請網址的 QR code（可在「⚙️ 設定 → 📱 QR code」關閉）。只有一台已驗證伺服器時會自動使用該台；多台時會列出 #ID 與名稱對照，可複選後一次邀請多台。

快速邀請會立即建立邀請，不用再選擇伺服器：跟隨設定預設媒體庫時勾選的伺服器與媒體庫；從未設定時則涵蓋所有已驗證的伺服器（Emby、Plex 等）。預設值為：連結 7 天、帳號無限制，下載、直播與上傳皆關閉，媒體庫為全部已啟用的媒體庫。這些預設值都能在主選單的「⚙️ 設定 → ⚡ 快速邀請設定」調整：連結有效期、帳號期限、權限、預設媒體庫（逐台選擇伺服器與旗下媒體庫，選完一台可再加入其他伺服器；伺服器缺少所選媒體庫時不會建立），以及是否沿用代碼。連結到期前再按會沿用同一組代碼（永不過期的連結會一直沿用），但更改任何設定後會新建一組；關閉沿用後每次都會建立新邀請。設定與代碼記在 SQLite。

Wizarr 在停用失敗時可能改為刪除帳號，確認畫面會先說明這件事。邀請網址若是 `/j/...` 這類相對路徑，會補上 `WIZARR_PUBLIC_URL`。

## 多語言

介面支援繁體中文、简体中文、English、日本語，預設英文。第一次使用時機器人會要求選擇語言，之後隨時可在「⚙️ 設定 → 🌐 語言」切換。語言偏好記在每位使用者的 SQLite session。

每種語言是一個獨立檔案，放在 `src/i18n/`（`en.ts`、`zh-TW.ts`、`zh-CN.ts`、`ja.ts`）。語言檔只放純字串資料（模板用 `{佔位符}`），共用邏輯集中在 `src/i18n/build.ts` 的 `buildCatalog()`；資料結構由 `CatalogStrings` 定義，漏填任何字串都會在編譯期報錯。新增語言的步驟：

1. 在 `src/i18n/` 新增 `<語言代碼>.ts`，參考現有檔案用 `buildCatalog()` 匯出一份完整資料。
2. 在 `src/i18n.ts` 匯入該檔案，把語言代碼加進 `LANGS`、`CATALOGS` 與 `LANG_LABELS`。
3. 執行 `npm test` 與 `npm run typecheck` 確認。

## Telegram Serverless

程式跑在 Telegram 自己的基礎設施上，入口在 [`tgcloud/`](tgcloud/)。共用邏輯仍在 `src/`。`npm run tg:build` 會把程式編成 `tgcloud/lib/bot.js`，並依 `serverless/.env` 寫出 `tgcloud/lib/config.js`。這兩個檔含連線資料，已列入 `.gitignore`。

Wizarr 必須能從公網連到。

1. 在 @BotFather 打開 bot → Serverless，啟用後到 CLI Access 複製 Access token。這組 token 與 bot token 不同。
2. 複製 `serverless/.env.example` 為 `serverless/.env`，填入 Wizarr 位址、API key 與允許的 Telegram ID。
3. 部署：

```bash
npx tgcloud login
npm run tg:build
npx tgcloud push
npx tgcloud migrate --safe
npx tgcloud webhook sync
```

也可以在 GitHub Actions 手動執行 [Deploy Telegram Serverless](.github/workflows/deploy-serverless.yml)。Secrets：

| Secret | 說明 |
| --- | --- |
| `TGCLOUD_TOKEN` | BotFather → Serverless → CLI Access 的 token，格式 `app:…` |
| `TELEGRAM_ADMIN_IDS` | 允許操作的 Telegram ID，逗號分隔 |
| `WIZARR_URL` | 公開的 Wizarr 位址 |
| `WIZARR_API_KEY` | Wizarr API key |
| `WIZARR_PUBLIC_URL` | 邀請連結用的對外網址 |
| `TIMEZONE` | 選填。日期顯示的 IANA 時區，預設 `Asia/Hong_Kong` |

不需要 `TELEGRAM_BOT_TOKEN` 與 `TELEGRAM_WEBHOOK_SECRET`。平台代為呼叫 Bot API，並自己管理 webhook。對話狀態存在 SQLite 的 `records` 表，第一次部署要跑 `migrate` 建立它。

## 本機開發

需要 Node.js 22 或以上。

```bash
npm ci
npm test
npm run typecheck
cp serverless/.env.example serverless/.env
npm run tg:build
```

`npm run tg:bundle` 會產出 `tgcloud/lib/bot.js`。`npm run tg:build` 還會依 `serverless/.env` 寫出 `tgcloud/lib/config.js`。

## 授權

[MIT](LICENSE)
