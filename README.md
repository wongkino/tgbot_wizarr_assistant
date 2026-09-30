# Wizarr Telegram Assistant

**English** | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md)

Control the [Wizarr](https://github.com/wizarrrr/wizarr) API from a Telegram **reply keyboard**.

- Docker edition in [`docker/`](docker/): long-running, long polling by default
- Worker edition in [`worker/`](worker/): deployed to Cloudflare by a GitHub Action
- UI available in English, 繁體中文, 简体中文 and 日本語, defaulting to English

Only allowlisted accounts may use it, and only in private chats. Shared logic lives in `src/`.

## Features

| Keyboard | Wizarr API |
| --- | --- |
| Status | `GET /api/status` |
| List / enable / disable / extend / delete users, reset password | `GET /api/users`、`POST /api/users/{id}/enable`、`disable`、`extend`、`reset-password`、`DELETE /api/users/{id}` |
| List / create / delete invites | `GET\|POST /api/invitations`、`DELETE /api/invitations/{id}` |
| Libraries | `GET /api/libraries` |
| Servers | `GET /api/servers` |

Creating an invite walks through: server, link expiry, account duration, libraries, downloads / live TV / uploads. Disabling and deleting each ask for one more confirmation. Listing or creating invites also sends a QR code for each invite URL. With a single verified server it is used automatically; with several, a #ID and name list is shown to pick from.

Quick invite creates an invite instantly, using verified Emby servers only. Defaults: 7-day link, unlimited account, downloads, live TV and uploads off, libraries 動畫-已完結, 動畫-連載中, 電影, 電視 (if any is missing, no invite is created). All defaults can be tuned in "⚙️ Settings" from the main menu: link expiry, account duration, permissions, and default libraries (custom or all enabled libraries). Pressing it again before the link expires reuses the same code; changing any setting creates a new one. Settings and codes are stored in KV on the Worker edition; the Docker edition resets to defaults on restart.

If Wizarr cannot disable an account it may delete it instead; the confirmation screen says so first. Invite URLs that are relative paths like `/j/...` are prefixed with `WIZARR_PUBLIC_URL`.

## Languages

The UI supports 繁體中文, 简体中文, English and 日本語, and defaults to English. The bot asks for a language on first use; it can be changed anytime under "⚙️ Settings → 🌐 Language". The preference is stored per user in the session store (KV on the Worker edition).

Each language is a separate file in `src/i18n/` (`en.ts`, `zh-TW.ts`, `zh-CN.ts`, `ja.ts`). Language files contain pure string data (templates use `{placeholders}`); shared logic lives in `buildCatalog()` in `src/i18n/build.ts`. The data shape is defined by `CatalogStrings`, so a missing string fails at compile time. To add a language:

1. Create `src/i18n/<code>.ts` and export complete data via `buildCatalog()`, using the existing files as a reference.
2. Import it in `src/i18n.ts` and add the code to `LANGS`, `CATALOGS` and `LANG_LABELS`.
3. Run `npm test` and `npm run typecheck`.

## Docker

Use this when Wizarr is on a LAN. The container includes `host.docker.internal`, so it can reach Wizarr running on the host.

```bash
cp docker/.env.example docker/.env
docker compose -f docker/docker-compose.yml up -d --build
```

With `MODE=polling` no inbound ports are needed; the container connects out to Telegram.

To use a webhook instead, set `MODE` to `webhook` in `docker/.env`, put an HTTPS reverse proxy in front, and register the webhook:

```bash
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -d "url=https://bot.example.com/telegram" \
  -d "secret_token=${TELEGRAM_WEBHOOK_SECRET}" \
  -d 'allowed_updates=["message"]'
```

| Variable | Description |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | Token from BotFather |
| `TELEGRAM_ADMIN_IDS` | Telegram numeric IDs allowed to operate, comma-separated. When empty, the bot only replies with the sender's ID |
| `TELEGRAM_WEBHOOK_SECRET` | Webhook secret. Optional for polling; required for webhook |
| `WIZARR_URL` | Wizarr address, e.g. `http://host.docker.internal:5690` |
| `WIZARR_API_KEY` | Wizarr → Settings → API Keys |
| `WIZARR_PUBLIC_URL` | Public URL used for invite links |
| `MODE` | `polling` or `webhook` |
| `PORT` | HTTP port, default `8080`. `GET /health` is a health check |

If you don't know your ID yet, leave `TELEGRAM_ADMIN_IDS` empty, start the bot, and send `/start`; it replies with your ID. Then write it into `docker/.env` and rebuild the container.

## Cloudflare Worker

The Worker must be able to reach Wizarr from the public internet. If Wizarr only listens on a LAN, use Docker instead, or expose Wizarr through Cloudflare Tunnel first.

Deployment is a push to `main`, handled by [`.github/workflows/deploy-worker.yml`](.github/workflows/deploy-worker.yml). The Action runs tests first, creates or reuses a KV namespace named `tgbot-wizarr-assistant-SESSIONS`, deploys the Worker, and points the Telegram webhook at `https://tgbot-wizarr-assistant.<account>.workers.dev/telegram`.

Create these secrets under Settings → Secrets and variables → Actions in the GitHub repository:

| Secret | Description |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Needs edit permission for Workers Scripts and Workers KV Storage |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |
| `TELEGRAM_BOT_TOKEN` | Token from BotFather |
| `TELEGRAM_ADMIN_IDS` | Telegram IDs allowed to operate, comma-separated |
| `TELEGRAM_WEBHOOK_SECRET` | Webhook secret, required |
| `WIZARR_URL` | Public Wizarr address |
| `WIZARR_API_KEY` | Wizarr API key |
| `WIZARR_PUBLIC_URL` | Public URL used for invite links |

The API token can be created under My Profile → API Tokens in the Cloudflare dashboard. Then push to `main`, or run Deploy Worker manually from the Actions page.

For local debugging, copy `worker/.dev.vars.example` to `worker/.dev.vars` and run `npm run cf:dev`.

## Local development

Requires Node.js 22 or later.

```bash
npm ci
npm test
npm run typecheck
cp docker/.env.example docker/.env
npm run dev
```

`npm run build` produces `dist/node.mjs` for the Docker image.
