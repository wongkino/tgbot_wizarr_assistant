import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatDate, parseTimestamp, setDateTimeZone } from "./format.ts";
import { catalogFor } from "./i18n.ts";

describe("parseTimestamp", () => {
  it("沒有時區的日期時間依 UTC 解讀", () => {
    assert.equal(parseTimestamp("2026-10-01T04:00:00"), Date.parse("2026-10-01T04:00:00Z"));
    assert.equal(parseTimestamp("2026-10-01 04:00:00"), Date.parse("2026-10-01T04:00:00Z"));
    assert.equal(parseTimestamp("2026-10-01T04:00:00Z"), Date.parse("2026-10-01T04:00:00Z"));
    assert.equal(parseTimestamp("2026-10-01T12:00:00+08:00"), Date.parse("2026-10-01T04:00:00Z"));
    assert.equal(parseTimestamp("2026-10-01"), Date.parse("2026-10-01"));
    assert.ok(Number.isNaN(parseTimestamp("not-a-date")));
  });

  it("顯示時把 UTC 換成設定的時區", () => {
    setDateTimeZone("Asia/Hong_Kong");
    const text = formatDate(catalogFor("zh-TW"), "2026-10-01T04:00:00");
    assert.match(text, /12:00/);
    assert.equal(formatDate(catalogFor("zh-TW"), null), "無期限");
  });
});
