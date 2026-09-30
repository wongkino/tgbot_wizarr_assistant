import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { encode } from "uqr";

import { qrPng } from "./qr.ts";

describe("邀請 QR code", () => {
  it("把網址編成正方形 PNG", async () => {
    const url = "https://wizarr.example/j/ABCD";
    const png = await qrPng(url);
    assert.deepEqual(Array.from(png.subarray(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
    const width = view.getUint32(16);
    const height = view.getUint32(20);
    assert.equal(width, height);
    assert.equal(width, encode(url, { ecc: "M", border: 4 }).size * 8);
    assert.deepEqual(png, await qrPng(url));
    assert.notDeepEqual(png, await qrPng("https://wizarr.example/j/OTHER"));
  });
});
