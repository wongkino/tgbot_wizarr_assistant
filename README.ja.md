# Wizarr Telegram アシスタント

[English](README.md) | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md) | **日本語**

Telegram の**返信キーボード**（Reply Keyboard）で [Wizarr](https://github.com/wizarrrr/wizarr) API を操作します。

- Telegram Serverless で動作します。入口は [`tgcloud/`](tgcloud/) です
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

クイック招待はサーバー選択なしで即座に招待を作成します：既定ライブラリの設定で選択したサーバーとライブラリに従い、未設定の場合はすべての認証済みサーバー（Emby・Plex など）を対象にします。既定値は：リンク 7 日、アカウント無制限、ダウンロード・ライブ・アップロードはすべてオフ、ライブラリはすべての有効なライブラリです。これらの既定値はメインメニューの「⚙️ 設定 → ⚡ クイック招待設定」で変更できます：リンク有効期限、アカウント期限、権限、既定ライブラリ（サーバーを 1 台ずつ選んでそのライブラリを選択し、選んだ後に他のサーバーも追加できます。サーバーに選択したライブラリがない場合は作成されません）、コード使い回しのオン/オフ。リンクの期限内に再度押すと同じコードを使い回し（無期限リンクは常に使い回します）、設定を変えると新しいコードを作成します。使い回しをオフにすると、毎回新しい招待を作成します。設定とコードは SQLite に保存されます。

Wizarr は無効化に失敗するとアカウントを削除する場合があり、確認画面で先にその旨を表示します。招待 URL が `/j/...` のような相対パスの場合は `WIZARR_PUBLIC_URL` を補います。

## 多言語

UI は繁體中文・简体中文・English・日本語に対応し、デフォルトは英語です。初回使用時にボットが言語を尋ね、以後は「⚙️ 設定 → 🌐 言語」からいつでも切り替えられます。言語設定はユーザーごとに SQLite の session に保存されます。

各言語は `src/i18n/` の独立したファイル（`en.ts`、`zh-TW.ts`、`zh-CN.ts`、`ja.ts`）です。言語ファイルは純粋な文字列データのみ（テンプレートは `{プレースホルダー}` 形式）で、共通ロジックは `src/i18n/build.ts` の `buildCatalog()` に集約されています。データ構造は `CatalogStrings` で定義され、文字列の欠落はコンパイル時にエラーになります。言語を追加する手順：

1. `src/i18n/<言語コード>.ts` を作成し、既存ファイルを参考に `buildCatalog()` で完全なデータをエクスポートする。
2. `src/i18n.ts` でそのファイルをインポートし、言語コードを `LANGS`、`CATALOGS`、`LANG_LABELS` に追加する。
3. `npm test` と `npm run typecheck` を実行して確認する。

## Telegram Serverless

ボットは Telegram 自身のインフラで動きます。入口は [`tgcloud/`](tgcloud/) です。共通ロジックは `src/` のままです。`npm run tg:build` が `tgcloud/lib/bot.js` を作り、`serverless/.env` から `tgcloud/lib/config.js` を書き出します。この 2 ファイルには接続情報が入るため `.gitignore` に入っています。

Wizarr は公開ネットワークから到達できる必要があります。

1. @BotFather でボット → Serverless を開き、有効化して CLI Access の Access token をコピーします。ボット token とは別です。
2. `serverless/.env.example` を `serverless/.env` にコピーし、Wizarr のアドレス、API key、許可する Telegram ID を記入します。
3. デプロイ：

```bash
npx tgcloud login
npm run tg:build
npx tgcloud push
npx tgcloud migrate --safe
npx tgcloud webhook sync
```

GitHub Actions から [Deploy Telegram Serverless](.github/workflows/deploy-serverless.yml) を手動実行することもできます。Secrets：

| Secret | 説明 |
| --- | --- |
| `TGCLOUD_TOKEN` | BotFather → Serverless → CLI Access の token。形式は `app:…` |
| `TELEGRAM_ADMIN_IDS` | 操作を許可する Telegram ID。カンマ区切り |
| `WIZARR_URL` | 公開された Wizarr のアドレス |
| `WIZARR_API_KEY` | Wizarr API key |
| `WIZARR_PUBLIC_URL` | 招待リンクに使う外部 URL |
| `TIMEZONE` | 任意。日付表示の IANA タイムゾーン。既定は `Asia/Hong_Kong` |

`TELEGRAM_BOT_TOKEN` と `TELEGRAM_WEBHOOK_SECRET` は不要です。プラットフォームが Bot API を呼び、webhook も管理します。会話状態は SQLite の `records` テーブルに保存されます。初回デプロイでは `migrate` でこのテーブルを作成します。

## ローカル開発

Node.js 24（Active LTS、現在 24.22.1。`.nvmrc` を参照）が必要です。

```bash
npm ci
npm test
npm run typecheck
cp serverless/.env.example serverless/.env
npm run tg:build
```

`npm run tg:bundle` は `tgcloud/lib/bot.js` を生成します。`npm run tg:build` はさらに `serverless/.env` から `tgcloud/lib/config.js` を書き出します。

## ライセンス

[MIT](LICENSE)
