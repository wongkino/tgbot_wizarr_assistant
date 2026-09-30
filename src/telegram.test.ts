import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createTelegramClient } from "./telegram.ts";

describe("Telegram 圖片", () => {
  it("以 PNG 檔案送出邀請 QR code", async () => {
    let form: FormData | undefined;
    const fetchImpl: typeof fetch = async (_input, init) => {
      form = init?.body instanceof FormData ? init.body : undefined;
      return Response.json({ ok: true, result: {} });
    };
    await createTelegramClient("token", fetchImpl).sendPhoto(9, Uint8Array.from([1, 2, 3]), "代碼：<code>ABCD</code>");
    assert.ok(form);
    assert.equal(form.get("chat_id"), "9");
    assert.equal(form.get("parse_mode"), "HTML");
    assert.match(String(form.get("caption")), /ABCD/);
    const photo = form.get("photo");
    assert.ok(photo instanceof File);
    assert.equal(photo.name, "invite-qr.png");
    assert.equal(photo.type, "image/png");
    assert.deepEqual(new Uint8Array(await photo.arrayBuffer()), Uint8Array.from([1, 2, 3]));
  });
});
