import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { splitText } from "./telegram.ts";

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
