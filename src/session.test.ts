import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isScreen, KvSessionStore, MemorySessionStore } from "./session.ts";

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
    assert.equal(isScreen({ type: "settings_expiry" }), true);
    assert.equal(isScreen({ type: "settings_duration" }), true);
    assert.equal(isScreen({ type: "settings_library_server" }), true);
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
    assert.equal(isScreen({ type: "settings_library_pick", serverId: 1, selectedIds: [3, 12], page: 0 }), true);
    assert.equal(isScreen({ type: "settings_library_pick", serverId: 1, selectedIds: "all", page: 0 }), false);
    assert.equal(isScreen({ type: "settings_library_pick", serverId: 1, selectedIds: [3], page: "0" }), false);
  });
});
