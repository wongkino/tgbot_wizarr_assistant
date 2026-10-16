import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ConfigError, loadConfig, loadServerlessConfig, parseAdminIds, splitWizarrUrl } from "./config.ts";

describe("splitWizarrUrl", () => {
  it("補上 /api，並保留對外根網址", () => {
    assert.deepEqual(splitWizarrUrl("http://host:5690"), {
      apiBase: "http://host:5690/api",
      publicBase: "http://host:5690",
    });
  });

  it("已含 /api 時不重複，並支援子路徑", () => {
    assert.deepEqual(splitWizarrUrl("https://host/api/"), {
      apiBase: "https://host/api",
      publicBase: "https://host",
    });
    assert.deepEqual(splitWizarrUrl("https://host/wizarr"), {
      apiBase: "https://host/wizarr/api",
      publicBase: "https://host/wizarr",
    });
  });

  it("拒絕不完整網址", () => {
    assert.throws(() => splitWizarrUrl("wizarr.local"), ConfigError);
    assert.throws(() => splitWizarrUrl("ftp://host"), /必須是 http 或 https/);
  });

  it("去掉引號與變數名稱後仍能解析", () => {
    assert.equal(splitWizarrUrl('"https://host/api/"').publicBase, "https://host");
    assert.equal(splitWizarrUrl("WIZARR_URL=http://host:5690").apiBase, "http://host:5690/api");
  });
});

describe("loadConfig", () => {
  it("解析管理員 ID 與公開網址", () => {
    const config = loadConfig({
      TELEGRAM_BOT_TOKEN: "token",
      TELEGRAM_ADMIN_IDS: "7, 8",
      WIZARR_URL: "http://host:5690",
      WIZARR_API_KEY: "key",
      WIZARR_PUBLIC_URL: "https://invite.example/",
      MODE: "webhook",
      PORT: "9090",
      TELEGRAM_WEBHOOK_SECRET: "secret",
    });
    assert.deepEqual([...config.adminIds], [7, 8]);
    assert.equal(config.wizarrPublicUrl, "https://invite.example");
    assert.equal(config.mode, "webhook");
    assert.equal(config.port, 9090);
  });

  it("缺少 token 或 ID 格式錯誤時拒絕啟動", () => {
    assert.throws(() => loadConfig({ WIZARR_URL: "http://host", WIZARR_API_KEY: "k" }), /TELEGRAM_BOT_TOKEN/);
    assert.throws(
      () =>
        loadConfig({
          TELEGRAM_BOT_TOKEN: "token",
          WIZARR_URL: "http://host",
          WIZARR_API_KEY: "k",
          MODE: "webhook",
        }),
      /TELEGRAM_WEBHOOK_SECRET/,
    );
    assert.throws(() => parseAdminIds("12, abc"), /abc/);
  });

  it("Serverless 不需要 bot token，仍驗證 Wizarr 位址", () => {
    const config = loadServerlessConfig({
      adminIds: "7",
      wizarrUrl: "https://wizarr.example/api/",
      wizarrApiKey: "key",
      timeZone: "Asia/Taipei",
    });
    assert.equal(config.telegramToken, "serverless");
    assert.equal(config.mode, "polling");
    assert.equal(config.wizarrApiBase, "https://wizarr.example/api");
    assert.equal(config.timeZone, "Asia/Taipei");
    assert.throws(() => loadServerlessConfig({ wizarrUrl: "wizarr.local", wizarrApiKey: "key" }), ConfigError);
  });

  it("TIMEZONE 預設 Asia/Hong_Kong，可自訂並會驗證", () => {
    const base = { TELEGRAM_BOT_TOKEN: "token", WIZARR_URL: "http://host", WIZARR_API_KEY: "key" };
    assert.equal(loadConfig(base).timeZone, "Asia/Hong_Kong");
    assert.equal(loadConfig({ ...base, TIMEZONE: "Asia/Taipei" }).timeZone, "Asia/Taipei");
    assert.throws(() => loadConfig({ ...base, TIMEZONE: "Mars/Olympus" }), /TIMEZONE/);
  });
});
