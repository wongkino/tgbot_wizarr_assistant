# Wizarr Telegram Assistant

**English** | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md)

Control the [Wizarr](https://github.com/wizarrrr/wizarr) API from a Telegram **reply keyboard**.

- Runs on Telegram Serverless. The entry point is [`tgcloud/`](tgcloud/)
- UI available in English, 繁體中文, 简体中文 and 日本語, defaulting to English

Only allowlisted accounts may use it, and only in private chats. Shared logic lives in `src/`.

## Features

| Keyboard | Wizarr API |
| --- | --- |
| Status → User status | `GET /api/status` |
| List / enable / disable / extend / delete users, reset password | `GET /api/users`、`POST /api/users/{id}/enable`、`disable`、`extend`、`reset-password`、`DELETE /api/users/{id}` |
| List / create / delete invites | `GET\|POST /api/invitations`、`DELETE /api/invitations/{id}` |
| Status → Library status | `GET /api/libraries` |
| Status → Server status | `GET /api/servers` |

Creating an invite walks through: server, link expiry, account duration, libraries, downloads / live TV / uploads. Disabling and deleting each ask for one more confirmation. Listing or creating invites also sends a QR code for each invite URL (can be turned off in Settings → QR code). With a single verified server it is used automatically; with several, a #ID and name list is shown with multi-select toggles, so one invite can cover multiple servers at once.

Quick invite creates an invite instantly with no server picking: it follows the servers and libraries chosen in the default-libraries setting, or covers all verified servers (Emby, Plex, etc.) when never configured. Defaults: 7-day link, unlimited account, downloads, live TV and uploads off, and all enabled libraries. All defaults can be tuned under "⚙️ Settings → ⚡ Quick invite settings" from the main menu: link expiry, account duration, permissions, default libraries (pick one server and its libraries at a time, then optionally add more servers; if the servers are missing any selected library, no invite is created), and whether to reuse codes. Pressing it again before the link expires reuses the same code (never-expiring links are always reused); changing any setting creates a new one. Turn off code reuse in Settings to create a fresh invite on every press. Settings and codes are stored in SQLite.

If Wizarr cannot disable an account it may delete it instead; the confirmation screen says so first. Invite URLs that are relative paths like `/j/...` are prefixed with `WIZARR_PUBLIC_URL`.

## Languages

The UI supports 繁體中文, 简体中文, English and 日本語, and defaults to English. The bot asks for a language on first use; it can be changed anytime under "⚙️ Settings → 🌐 Language". The preference is stored per user in SQLite.

Each language is a separate file in `src/i18n/` (`en.ts`, `zh-TW.ts`, `zh-CN.ts`, `ja.ts`). Language files contain pure string data (templates use `{placeholders}`); shared logic lives in `buildCatalog()` in `src/i18n/build.ts`. The data shape is defined by `CatalogStrings`, so a missing string fails at compile time. To add a language:

1. Create `src/i18n/<code>.ts` and export complete data via `buildCatalog()`, using the existing files as a reference.
2. Import it in `src/i18n.ts` and add the code to `LANGS`, `CATALOGS` and `LANG_LABELS`.
3. Run `npm test` and `npm run typecheck`.

## Telegram Serverless

The bot runs on Telegram's own infrastructure. The entry point is [`tgcloud/`](tgcloud/). Shared logic stays in `src/`. `npm run tg:build` compiles it to `tgcloud/lib/bot.js` and writes `tgcloud/lib/config.js` from `serverless/.env`. Both files carry connection details and are gitignored.

Wizarr must be reachable from the public internet.

1. In @BotFather open the bot → Serverless, turn it on, then copy the Access token from CLI Access. This token is separate from the bot token.
2. Copy `serverless/.env.example` to `serverless/.env` and fill in the Wizarr address, API key, and allowed Telegram IDs.
3. Deploy:

```bash
npx tgcloud login
npm run tg:build
npx tgcloud push
npx tgcloud migrate --safe
npx tgcloud webhook sync
```

You can also run [Deploy Telegram Serverless](.github/workflows/deploy-serverless.yml) manually from GitHub Actions. Secrets:

| Secret | Description |
| --- | --- |
| `TGCLOUD_TOKEN` | Token from BotFather → Serverless → CLI Access, shaped `app:…` |
| `TELEGRAM_ADMIN_IDS` | Telegram IDs allowed to operate, comma-separated |
| `WIZARR_URL` | Public Wizarr address |
| `WIZARR_API_KEY` | Wizarr API key |
| `WIZARR_PUBLIC_URL` | Public URL used for invite links |
| `TIMEZONE` | Optional. IANA time zone for dates, default `Asia/Hong_Kong` |

`TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` are not used. The platform calls the Bot API and manages the webhook. Conversation state lives in the SQLite `records` table; the first deploy has to run `migrate` to create it.

## Local development

Requires Node.js 22 or later.

```bash
npm ci
npm test
npm run typecheck
cp serverless/.env.example serverless/.env
npm run tg:build
```

`npm run tg:bundle` produces `tgcloud/lib/bot.js`. `npm run tg:build` also writes `tgcloud/lib/config.js` from `serverless/.env`.

## License

[MIT](LICENSE)
