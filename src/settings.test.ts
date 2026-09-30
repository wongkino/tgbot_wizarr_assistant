import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MemorySessionStore } from "./session.ts";
import {
  defaultQuickSettings,
  loadQuickSettings,
  parseQuickSettings,
  sameQuickSettings,
  saveQuickSettings,
} from "./settings.ts";

describe("快速邀請設定", () => {
  it("空的儲存空間會回傳預設值", async () => {
    const store = new MemorySessionStore();
    assert.deepEqual(await loadQuickSettings(store), defaultQuickSettings());
  });

  it("儲存後可讀回相同設定", async () => {
    const store = new MemorySessionStore();
    const settings = {
      ...defaultQuickSettings(),
      expiresInDays: 30 as const,
      duration: "30",
      unlimited: false,
      allowDownloads: true,
      serverIds: [1, 2],
      libraries: null,
    };
    await saveQuickSettings(store, settings);
    assert.deepEqual(await loadQuickSettings(store), settings);
  });

  it("損壞的 JSON 會回退到預設值", async () => {
    const store = new MemorySessionStore();
    await store.setText("settings:quick-invite", "{not json", 60);
    assert.deepEqual(await loadQuickSettings(store), defaultQuickSettings());
    await store.setText("settings:quick-invite", JSON.stringify({ expiresInDays: 5 }), 60);
    assert.deepEqual(await loadQuickSettings(store), defaultQuickSettings());
  });

  it("sameQuickSettings 對媒體庫順序不敏感", () => {
    const a = {
      ...defaultQuickSettings(),
      libraries: [
        { name: "Movies", externalId: "mov" },
        { name: "Anime", externalId: "ani" },
      ],
    };
    const b = { ...a, libraries: [...a.libraries].reverse() };
    assert.equal(sameQuickSettings(a, b), true);
    assert.equal(sameQuickSettings(a, { ...a, expiresInDays: 30 }), false);
    assert.equal(sameQuickSettings(a, { ...a, unlimited: false }), false);
    assert.equal(sameQuickSettings(a, { ...a, allowDownloads: true }), false);
    assert.equal(sameQuickSettings(a, { ...a, libraries: null }), false);
    const withServers = { ...a, serverIds: [2, 1] };
    assert.equal(sameQuickSettings(withServers, { ...a, serverIds: [1, 2] }), true);
    assert.equal(sameQuickSettings(withServers, { ...a, serverIds: [1] }), false);
    assert.equal(sameQuickSettings(withServers, { ...a, serverIds: null }), false);
    assert.equal(
      sameQuickSettings(a, { ...a, libraries: [...a.libraries, { name: "Music", externalId: null }] }),
      false,
    );
  });

  it("parseQuickSettings 拒絕無效的媒體庫比對器", () => {
    const settings = defaultQuickSettings();
    assert.equal(parseQuickSettings({ ...settings, libraries: [{ name: "", externalId: null }] }), null);
    assert.equal(parseQuickSettings({ ...settings, libraries: [{ name: "Movies", externalId: 4 }] }), null);
    assert.equal(parseQuickSettings({ ...settings, libraries: "all" }), null);
    assert.equal(parseQuickSettings({ ...settings, expiresInDays: 8 }), null);
    assert.equal(parseQuickSettings({ ...settings, serverIds: [0] }), null);
    assert.equal(parseQuickSettings({ ...settings, serverIds: "all" }), null);
    const parsed = parseQuickSettings(JSON.parse(JSON.stringify(settings)));
    assert.deepEqual(parsed, settings);
  });

  it("舊版設定沒有 serverIds 欄位也能解析", () => {
    const settings = { ...defaultQuickSettings(), serverIds: [1, 2] };
    const legacy = JSON.parse(JSON.stringify(settings)) as Record<string, unknown>;
    delete legacy.serverIds;
    assert.deepEqual(parseQuickSettings(legacy), { ...settings, serverIds: null });
  });
});
