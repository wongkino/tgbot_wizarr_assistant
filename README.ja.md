# Wizarr Telegram アシスタント

[English](README.md) | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md) | **日本語**

Telegram の**返信キーボード**（Reply Keyboard）で [Wizarr](https://github.com/wizarrrr/wizarr) API を操作します。

- Docker 版は [`docker/`](docker/)。常駐実行、デフォルトは long polling
- Worker 版は [`worker/`](worker/)。GitHub Action で Cloudflare にデプロイ
- UI は English・繁體中文・简体中文・日本語の 4 言語に切替可能。デフォルトは英語

許可リストにあるアカウントのみ、個人チャットでのみ利用できます。共通ロジックは `src/` にあります。

## 機能

| キーボード | Wizarr API |
| --- | --- |
| ステータス → ユーザー状態 | `GET /api/status` |
| ユーザーの一覧 / 有効化 / 無効化 / 延長 / 削除、パスワード再設定 | `GET /api/users`、`POST /api/users/{id}/enable`、`disable`、`extend`、`reset-password`、`DELETE /api/users/{id}` |
| 招待の一覧 / 作成 / 削除 | `GET\|POST /api/invitations`、`DELETE /api/invitations/{id}` |
| ステータス → ライブラリ状態 | `GET /api/libraries` |
| ステータス → サーバー状態 | `GET /api/servers` |

招待の作成は、サーバー → リンク有効期限 → アカウント期限 → ライブラリ → ダウンロード / ライブ / アップロードの順に聞きます。無効化と削除は確認ボタンをもう一度押す必要があります。招待の一覧・作成時には招待 URL の QR code も送信します（「⚙️ 設定 → 📱 QR code」でオフにできます）。認証済みサーバーが 1 台だけなら自動的にそのサーバーを使用し、複数ある場合は #ID と名前の一覧を表示して複数選択でき、1 回の招待で複数台をまとめてカバーできます。

クイック招待はサーバー選択なしで即座に招待を作成します：既定ライブラリの設定で選択したサーバーとライブラリに従い、未設定の場合はすべての認証済みサーバー（Emby・Plex など）を対象にします。既定値は：リンク 7 日、アカウント無制限、ダウンロード・ライブ・アップロードはすべてオフ、ライブラリはすべての有効なライブラリです。これらの既定値はメインメニューの「⚙️ 設定 → ⚡ クイック招待設定」で変更できます：リンク有効期限、アカウント期限、権限、既定ライブラリ（サーバーを 1 台ずつ選んでそのライブラリを選択し、選んだ後に他のサーバーも追加できます。サーバーに選択したライブラリがない場合は作成されません）、コード使い回しのオン/オフ。リンクの期限内に再度押すと同じコードを使い回し（無期限リンクは常に使い回します）、設定を変えると新しいコードを作成します。使い回しをオフにすると、毎回新しい招待を作成します。設定とコードは Worker 版では KV に保存され、Docker 版は再起動すると既定値に戻ります。

Wizarr は無効化に失敗するとアカウントを削除する場合があり、確認画面で先にその旨を表示します。招待 URL が `/j/...` のような相対パスの場合は `WIZARR_PUBLIC_URL` を補います。

## 多言語

UI は繁體中文・简体中文・English・日本語に対応し、デフォルトは英語です。初回使用時にボットが言語を尋ね、以後は「⚙️ 設定 → 🌐 言語」からいつでも切り替えられます。言語設定はユーザーごとに session store（Worker 版では KV）に保存されます。

各言語は `src/i18n/` の独立したファイル（`en.ts`、`zh-TW.ts`、`zh-CN.ts`、`ja.ts`）です。言語ファイルは純粋な文字列データのみ（テンプレートは `{プレースホルダー}` 形式）で、共通ロジックは `src/i18n/build.ts` の `buildCatalog()` に集約されています。データ構造は `CatalogStrings` で定義され、文字列の欠落はコンパイル時にエラーになります。言語を追加する手順：

1. `src/i18n/<言語コード>.ts` を作成し、既存ファイルを参考に `buildCatalog()` で完全なデータをエクスポートする。
2. `src/i18n.ts` でそのファイルをインポートし、言語コードを `LANGS`、`CATALOGS`、`LANG_LABELS` に追加する。
3. `npm test` と `npm run typecheck` を実行して確認する。

## Docker

Wizarr が LAN 内にある場合はこちらを使います。コンテナには `host.docker.internal` が設定済みで、ホスト上の Wizarr に接続できます。

```bash
cp docker/.env.example docker/.env
docker compose -f docker/docker-compose.yml up -d
```

これは手動の **docker** GitHub Action でビルドされた `linux/amd64` イメージ `ghcr.io/wongkino/tgbot_wizarr_assistant:latest` を pull します。パッケージが private の場合は先に `docker login ghcr.io` を実行してください。ソースからビルドする場合は `docker/docker-compose.yml` のコメントアウトされた `build:` 設定に切り替え、`up -d --build` を実行します。

`MODE=polling` の場合、外部に開放するポートは不要です。コンテナから Telegram に能動的に接続します。このモードでは `/telegram` webhook エンドポイントは無効化されるため、ポートが公開されても `GET /health` のみに応答します。

webhook に変える場合は `docker/.env` の `MODE` を `webhook` にし、手前に HTTPS リバースプロキシを置いて webhook を設定します：

```bash
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -d "url=https://bot.example.com/telegram" \
  -d "secret_token=${TELEGRAM_WEBHOOK_SECRET}" \
  -d 'allowed_updates=["message"]'
```

| 変数 | 説明 |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | BotFather の token |
| `TELEGRAM_ADMIN_IDS` | 操作を許可する Telegram の数値 ID（カンマ区切り）。空の場合は送信者の ID を返すだけ |
| `TELEGRAM_WEBHOOK_SECRET` | Webhook シークレット。polling では省略可、webhook では必須 |
| `WIZARR_URL` | Wizarr のアドレス（例：`http://host.docker.internal:5690`） |
| `WIZARR_API_KEY` | Wizarr → Settings → API Keys |
| `WIZARR_PUBLIC_URL` | 招待リンクに使う外部 URL |
| `MODE` | `polling` または `webhook` |
| `PORT` | HTTP ポート。デフォルト `8080`。`GET /health` でヘルスチェック可能 |
| `TIMEZONE` | 日付表示に使う IANA タイムゾーン。デフォルト `Asia/Hong_Kong` |

自分の ID がわからない場合は、`TELEGRAM_ADMIN_IDS` を空のまま起動してボットに `/start` を送ると ID が返ります。`docker/.env` に書いてからコンテナを再ビルドしてください。

## Cloudflare Worker

Worker から公衆インターネット経由で Wizarr に到達できる必要があります。Wizarr が LAN のみで動いている場合は Docker を使うか、先に Cloudflare Tunnel で Wizarr を公開してください。

デプロイは `main` への push で、[`.github/workflows/deploy-worker.yml`](.github/workflows/deploy-worker.yml) が処理します。Action はまずテストを実行し、`tgbot-wizarr-assistant-SESSIONS` という KV を作成または再利用して Worker をデプロイし、Telegram の webhook を `https://tgbot-wizarr-assistant.<アカウント>.workers.dev/telegram` に向けます。

GitHub リポジトリの Settings → Secrets and variables → Actions で以下の secrets を作成してください：

| Secret | 説明 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Workers Scripts と Workers KV Storage の編集権限が必要 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare アカウント ID |
| `TELEGRAM_BOT_TOKEN` | BotFather の token |
| `TELEGRAM_ADMIN_IDS` | 操作を許可する Telegram ID（カンマ区切り） |
| `TELEGRAM_WEBHOOK_SECRET` | Webhook シークレット（必須） |
| `WIZARR_URL` | 公開された Wizarr アドレス |
| `WIZARR_API_KEY` | Wizarr API key |
| `WIZARR_PUBLIC_URL` | 招待リンクに使う外部 URL |
| `TIMEZONE` | 省略可。日付表示の IANA タイムゾーン。デフォルト `Asia/Hong_Kong` |

API token は Cloudflare ダッシュボードの My Profile → API Tokens で作成できます。あとは `main` に push するか、Actions ページで Deploy Worker を手動実行してください。

ローカルでのデバッグは `worker/.dev.vars.example` を `worker/.dev.vars` にコピーして `npm run cf:dev` を実行します。

## ローカル開発

Node.js 22 以上が必要です。

```bash
npm ci
npm test
npm run typecheck
cp docker/.env.example docker/.env
npm run dev
```

`npm run build` は Docker イメージ用の `dist/node.mjs` を生成します。

## ライセンス

[MIT](LICENSE)
