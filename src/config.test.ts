import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ConfigError, loadServerlessConfig, parseAdminIds, splitWizarrUrl } from "./config.ts";

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

describe("loadServerlessConfig", () => {
  it("解析管理員 ID 與公開網址", () => {
    const config = loadServerlessConfig({
      adminIds: "7, 8",
      wizarrUrl: "http://host:5690",
      wizarrApiKey: "key",
      wizarrPublicUrl: "https://invite.example/",
      timeZone: "Asia/Taipei",
    });
    assert.deepEqual([...config.adminIds], [7, 8]);
    assert.equal(config.wizarrPublicUrl, "https://invite.example");
    assert.equal(config.wizarrApiBase, "http://host:5690/api");
    assert.equal(config.timeZone, "Asia/Taipei");
  });

  it("缺少 API key 或 ID 格式錯誤時拒絕啟動", () => {
    assert.throws(() => loadServerlessConfig({ wizarrUrl: "http://host" }), /WIZARR_API_KEY/);
    assert.throws(
      () => loadServerlessConfig({ wizarrUrl: "http://host", wizarrApiKey: "k", adminIds: "12, abc" }),
      /abc/,
    );
    assert.throws(() => parseAdminIds("12, abc"), /abc/);
  });

  it("仍驗證 Wizarr 位址", () => {
    const config = loadServerlessConfig({
      adminIds: "7",
      wizarrUrl: "https://wizarr.example/api/",
      wizarrApiKey: "key",
    });
    assert.equal(config.wizarrApiBase, "https://wizarr.example/api");
    assert.throws(() => loadServerlessConfig({ wizarrUrl: "wizarr.local", wizarrApiKey: "key" }), ConfigError);
  });

  it("TIMEZONE 預設 Asia/Hong_Kong，可自訂並會驗證", () => {
    const base = { wizarrUrl: "http://host", wizarrApiKey: "key" };
    assert.equal(loadServerlessConfig(base).timeZone, "Asia/Hong_Kong");
    assert.throws(() => loadServerlessConfig({ ...base, timeZone: "Mars/Olympus" }), /TIMEZONE/);
  });
});
