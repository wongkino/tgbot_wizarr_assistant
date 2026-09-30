import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createTelegramClient, splitText } from "./telegram.ts";

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

describe("splitText", () => {
  it("短訊息不切塊", () => {
    assert.deepEqual(splitText("hello"), ["hello"]);
  });

  it("切塊時補齊跨塊的 HTML 標籤", () => {
    const body = "x".repeat(5000);
    const chunks = splitText(`<b>${body}</b>`);
    assert.equal(chunks.length, 2);
    assert.ok(chunks[0]?.endsWith("</b>"), "第一塊結尾要補上 </b>");
    assert.ok(chunks[1]?.startsWith("<b>"), "第二塊開頭要補回 <b>");
    const strip = (value: string) => value.replace(/<\/?b>/g, "");
    assert.equal(chunks.map(strip).join(""), body, "去掉標籤後內容不變");
  });

  it("不會切在標籤中間", () => {
    const text = `${"x".repeat(3890)}<a href="https://example.com/${"u".repeat(50)}">link</a>`;
    const chunks = splitText(text);
    assert.equal(chunks.length, 2);
    assert.ok(!chunks[0]?.includes("<"), "第一塊不含未完成的標籤");
    assert.ok(chunks[1]?.startsWith('<a href="https://example.com/'));
  });

  it("巢狀標籤依相反順序關閉", () => {
    const body = "y".repeat(5000);
    const chunks = splitText(`<b><code>${body}</code></b>`);
    assert.equal(chunks.length, 2);
    assert.ok(chunks[0]?.endsWith("</code></b>"));
    assert.ok(chunks[1]?.startsWith("<b><code>"));
  });
});
