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
});
