import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isScreen, KvSessionStore, MemorySessionStore, SCREEN_PARENT } from "./session.ts";

describe("工作階段", () => {
  it("損壞的確認畫面會被捨棄", async () => {
    assert.equal(isScreen({ type: "confirm" }), false);
    assert.equal(
      isScreen({ type: "confirm", pending: { kind: "delete_user", userId: 12, username: "alice" } }),
      true,
    );
    const store = new KvSessionStore({
      async get(key) {
        return key === "session:7" ? JSON.stringify({ type: "confirm" }) : null;
      },
      async put() {},
      async delete() {},
    });
    assert.equal(await store.get("7"), null);
  });

  it("快速邀請代碼可另外保存並過期", async () => {
    const store = new MemorySessionStore();
    await store.setText("quick-invite:1", "NEW1", 60);
    assert.equal(await store.getText("quick-invite:1"), "NEW1");
    await store.setText("quick-invite:1", "OLD", -1);
    assert.equal(await store.getText("quick-invite:1"), null);
  });

  it("設定畫面的形狀會被驗證", () => {
    assert.equal(isScreen({ type: "settings" }), true);
    assert.equal(isScreen({ type: "settings_quick" }), true);
    assert.equal(isScreen({ type: "settings_expiry" }), true);
    assert.equal(isScreen({ type: "settings_duration" }), true);
    assert.equal(isScreen({ type: "settings_library_server", picked: [] }), true);
    assert.equal(isScreen({ type: "settings_library_server", picked: [pickedSample()] }), true);
    assert.equal(isScreen({ type: "settings_library_server", picked: [{ serverId: 1 }] }), false);
    assert.equal(isScreen({ type: "settings_library_server" }), false);
    assert.equal(isScreen({ type: "settings_library_more", picked: [pickedSample()] }), true);
    assert.equal(isScreen({ type: "settings_library_more" }), false);
    assert.equal(isScreen({ type: "settings_lang" }), true);
    assert.equal(
      isScreen({
        type: "settings_permissions",
        permissions: { allowDownloads: true, allowLiveTv: false, allowMobileUploads: false },
      }),
      true,
    );
    assert.equal(isScreen({ type: "settings_permissions", permissions: { allowDownloads: "yes" } }), false);
    assert.equal(isScreen({ type: "settings_permissions" }), false);
    assert.equal(
      isScreen({
        type: "settings_library_pick",
        serverId: 1,
        serverName: "Emby",
        selectedIds: [3, 12],
        page: 0,
        picked: [],
      }),
      true,
    );
    assert.equal(
      isScreen({ type: "settings_library_pick", serverId: 1, selectedIds: [3, 12], page: 0, picked: [] }),
      false,
    );
    assert.equal(
      isScreen({
        type: "settings_library_pick",
        serverId: 1,
        serverName: "Emby",
        selectedIds: "all",
        page: 0,
        picked: [],
      }),
      false,
    );
    assert.equal(
      isScreen({
        type: "settings_library_pick",
        serverId: 1,
        serverName: "Emby",
        selectedIds: [3],
        page: "0",
        picked: [],
      }),
      false,
    );
    assert.equal(
      isScreen({ type: "settings_library_pick", serverId: 1, serverName: "Emby", selectedIds: [3], page: 0 }),
      false,
    );
  });

  it("SCREEN_PARENT 涵蓋所有畫面類型", () => {
    // 每個 Screen 類型都要能被 isScreen 接受（至少一個合法樣本），否則 KV 版會靜靜掉回主選單
    const samples: Record<string, unknown> = {
      main: { type: "main" },
      users: { type: "users" },
      invites: { type: "invites" },
      status: { type: "status" },
      settings: { type: "settings" },
      settings_quick: { type: "settings_quick" },
      user_list: { type: "user_list", page: 0 },
      invite_list: { type: "invite_list", page: 0, filter: "all" },
      library_list: { type: "library_list", page: 0 },
      server_list: { type: "server_list", page: 0 },
      pick_user: { type: "pick_user", action: "enable", page: 0 },
      extend_days: { type: "extend_days", userId: 1, username: "alice" },
      invite_server: { type: "invite_server", selectedIds: [] },
      invite_expiry: { type: "invite_expiry", draft: draftSample() },
      invite_duration: { type: "invite_duration", draft: draftSample() },
      invite_library_mode: { type: "invite_library_mode", draft: draftSample() },
      invite_library_pick: { type: "invite_library_pick", draft: draftSample(), page: 0 },
      invite_permissions: { type: "invite_permissions", draft: draftSample() },
      delete_invite_pick: { type: "delete_invite_pick", page: 0 },
      settings_expiry: { type: "settings_expiry" },
      settings_duration: { type: "settings_duration" },
      settings_permissions: {
        type: "settings_permissions",
        permissions: { allowDownloads: false, allowLiveTv: false, allowMobileUploads: false },
      },
      settings_library_server: { type: "settings_library_server", picked: [] },
      settings_library_pick: {
        type: "settings_library_pick",
        serverId: 1,
        serverName: "Emby",
        selectedIds: [],
        page: 0,
        picked: [],
      },
      settings_library_more: { type: "settings_library_more", picked: [pickedSample()] },
      settings_lang: { type: "settings_lang" },
      confirm: { type: "confirm", pending: { kind: "delete_invite", invitationId: 1, code: "ABCD" } },
    };
    for (const [type, sample] of Object.entries(samples)) {
      assert.equal(isScreen(sample), true, `screen 類型 ${type} 應通過 isScreen`);
    }
    // 樣本表與 SCREEN_PARENT 同步，避免漏加新類型
    assert.deepEqual(Object.keys(samples).sort(), Object.keys(SCREEN_PARENT).sort());
  });
});

function pickedSample() {
  return { serverId: 1, serverName: "Emby", libraries: [{ name: "Movies", externalId: "mov" }] };
}

function draftSample() {
  return {
    serverIds: [1],
    serverNames: ["Emby"],
    libraryIds: [],
    libraryNames: [],
    allowDownloads: false,
    allowLiveTv: false,
    allowMobileUploads: false,
  };
}
